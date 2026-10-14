import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { open, readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const inside = (root, path) => { const segment = relative(root, path); return !segment.startsWith('..') && !isAbsolute(segment); };
function privateOutput(path, plaintext = false) {
  if (inside(resolve(project, 'public'), path) || inside(resolve(project, 'dist'), path) || (plaintext && !inside(resolve(project, '.local'), path))) throw new Error('UNSAFE_BACKUP_DESTINATION');
}

function keyFor(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 16) throw new Error('INVALID_BACKUP_KEY');
  return scryptSync(passphrase, salt, 32);
}
function inspect(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (![1, 2].includes(version)) throw new Error('UNSUPPORTED_BACKUP_SCHEMA');
  if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('BACKUP_INTEGRITY_FAILED');
  db.prepare('SELECT id,snapshot FROM rounds LIMIT 0').all();
  db.prepare('SELECT round_id,slot,token_hash FROM participants LIMIT 0').all();
  return version;
}
async function reserve(path) {
  for (const suffix of ['-wal', '-shm']) { try { await access(path + suffix); throw new Error('DESTINATION_SIDECAR_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  await mkdir(dirname(path), { recursive: true }); const file = await open(path, 'wx', 0o600); await file.close();
}
async function removeOwnFiles(path) { for (const suffix of ['', '-wal', '-shm']) await unlink(path + suffix).catch((e) => { if (e.code !== 'ENOENT') throw e; }); }

export async function createEncryptedBackup(source, destination, passphrase) {
  const output = resolve(destination), salt = randomBytes(16), iv = randomBytes(12);
  privateOutput(output);
  if (!output.endsWith('.bubak')) throw new Error('INVALID_BACKUP_EXTENSION');
  const key = keyFor(passphrase, salt);
  if (resolve(source) === output) throw new Error('BACKUP_PATH_CONFLICT');
  const staging = resolve(project, '.local', 'backup-stage');
  await mkdir(staging, { recursive: true, mode: 0o700 });
  await reserve(output); // 不覆寫任何已存在檔案。
  const temporary = resolve(staging, `.snapshot-${randomUUID()}.sqlite`);
  let database, complete = false;
  try {
    database = new DatabaseSync(resolve(source), { readOnly: true });
    inspect(database);
    await backup(database, temporary); // SQLite一致性備份，包含已提交的WAL資料。
    const bytes = await readFile(temporary);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    await writeFile(output, JSON.stringify({ format: 'between-us-backup', version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }), { mode: 0o600 });
    complete = true;
    return { ok: true };
  } finally { database?.close(); await removeOwnFiles(temporary); if (!complete) await unlink(output); }
}

export async function restoreEncryptedBackup(source, destination, passphrase, { currentStatePath, confirmOffline = false, now = () => Date.now() } = {}) {
  if (!confirmOffline || !currentStatePath) throw new Error('CURRENT_OFFLINE_STATE_REQUIRED');
  const output = resolve(destination);
  privateOutput(output, true);
  if ([resolve(source), resolve(currentStatePath)].includes(output)) throw new Error('BACKUP_PATH_CONFLICT');
  const encoded = await readFile(source, 'utf8');
  let envelope, bytes;
  try {
    envelope = JSON.parse(encoded);
    if (envelope.format !== 'between-us-backup' || envelope.version !== 1) throw new Error();
    const salt = Buffer.from(envelope.salt, 'base64'), iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error();
    const key = keyFor(passphrase, salt), decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag); bytes = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  } catch { throw new Error('BACKUP_DECRYPT_FAILED'); }
  const latest = new DatabaseSync(resolve(currentStatePath), { readOnly: true });
  let restored, complete = false, reserved = false;
  try {
    const currentVersion = inspect(latest);
    latest.exec('BEGIN');
    const currentRounds = latest.prepare('SELECT id,snapshot,invite_hash' + (currentVersion === 2 ? ',expires_at' : '') + ' FROM rounds').all();
    const currentPeople = latest.prepare('SELECT round_id,slot,token_hash,nickname,consent_at' + (currentVersion === 2 ? ',withdrawn_at,previous_token_hash' : '') + ' FROM participants').all();
    await reserve(output); reserved = true; await writeFile(output, bytes, { mode: 0o600 });
    restored = new DatabaseSync(output);
    const version = inspect(restored);
    restored.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    if (version === 1) restored.exec('ALTER TABLE rounds ADD COLUMN expires_at TEXT; ALTER TABLE participants ADD COLUMN withdrawn_at TEXT; ALTER TABLE participants ADD COLUMN previous_token_hash TEXT; CREATE INDEX rounds_expiry ON rounds(expires_at); PRAGMA user_version=2;');
    const rounds = restored.prepare('SELECT id,snapshot FROM rounds').all();
    // 全庫先解除舊雜湊唯一鍵，處理跨回合重用已撤銷token的情形。
    for (const person of restored.prepare('SELECT round_id,slot FROM participants').all()) restored.prepare('UPDATE participants SET token_hash=? WHERE round_id=? AND slot=?').run(randomBytes(32).toString('hex'), person.round_id, person.slot);
    for (const round of rounds) {
      const current = currentRounds.find((r) => r.id === round.id);
      if (!current || (current.expires_at && current.expires_at <= new Date(now()).toISOString())) {
        restored.prepare('DELETE FROM participants WHERE round_id=?').run(round.id); restored.prepare('DELETE FROM rounds WHERE id=?').run(round.id); continue;
      }
      if (round.snapshot !== current.snapshot) throw new Error('RESTORE_SNAPSHOT_CONFLICT');
      // 原連結更換、退出與期限以「最新停寫狀態」為準，不能從舊備份復活。
      const people = currentPeople.filter((p) => p.round_id === round.id);
      restored.prepare('UPDATE rounds SET expires_at=?,invite_hash=? WHERE id=?').run(current.expires_at ?? null, people.some((p) => p.withdrawn_at) ? null : current.invite_hash, round.id);
      for (const person of restored.prepare('SELECT slot FROM participants WHERE round_id=?').all(round.id)) {
        if (!people.some((p) => p.slot === person.slot)) restored.prepare('DELETE FROM participants WHERE round_id=? AND slot=?').run(round.id, person.slot);
      }
      for (const person of people) {
        restored.prepare("INSERT OR IGNORE INTO participants(round_id,slot,token_hash,nickname,consent_at,answers,revision) VALUES(?,?,?,?,?,'{}',0)").run(round.id, person.slot, person.token_hash, person.nickname, person.consent_at);
        restored.prepare('UPDATE participants SET token_hash=?,previous_token_hash=?,withdrawn_at=? WHERE round_id=? AND slot=?').run(person.token_hash, person.previous_token_hash ?? null, person.withdrawn_at ?? null, round.id, person.slot);
        if (person.withdrawn_at) restored.prepare("UPDATE participants SET answers='{}',nickname='已退出',submitted_at=NULL WHERE round_id=? AND slot=?").run(round.id, person.slot);
      }
    }
    restored.exec('COMMIT'); inspect(restored); complete = true;
    return { ok: true, quarantined: true, schema: 2 };
  } finally {
    restored?.close(); latest.close(); if (reserved && !complete) await removeOwnFiles(output);
  }
}
