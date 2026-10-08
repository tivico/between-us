import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { quizzes } from '../src/content/quizzes.ts';

export class RoundError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new RoundError(code, message, status); };
const digest = (token) => createHash('sha256').update(token).digest('hex');
const validToken = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
const requireToken = (token) => { if (!validToken(token)) fail('UNAUTHORIZED', '私人連結不完整或已失效。', 401); };
const invitationFor = (token, id) => createHmac('sha256', token).update(`between-us:invite:v1:${id}`).digest('hex');
const nicknameFor = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24) fail('INVALID_NAME', '請填寫 1–24 字的暱稱。');
  return value.trim();
};

export class RoundStore {
  constructor(path = ':memory:', { catalog = quizzes, now = () => Date.now() } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.catalog = catalog;
    this.now = now;
    const schemaVersion = this.db.prepare('PRAGMA user_version').get().user_version;
    if (schemaVersion > 1) { this.db.close(); throw new Error('資料庫版本比此程式新，請先確認版本，不要覆寫資料。'); }
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL, invite_hash TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS participants (
        round_id TEXT NOT NULL REFERENCES rounds(id), slot TEXT NOT NULL CHECK(slot IN ('A','B')),
        token_hash TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, consent_at TEXT NOT NULL,
        submitted_at TEXT, answers TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(round_id, slot)
      );
      PRAGMA user_version = 1;
    `);
  }
  close() { this.db.close(); }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  stamp() { return new Date(this.now()).toISOString(); }
  authenticate(id, token) {
    requireToken(token);
    const own = this.db.prepare('SELECT * FROM participants WHERE round_id = ? AND token_hash = ?').get(id, digest(token));
    if (!own) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
    return own;
  }
  create({ quizId, nickname, consent, privateToken }) {
    requireToken(privateToken);
    const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    const quiz = this.catalog.find((item) => item.id === quizId);
    // 此階段只允許已有題目的草案／正式主題建立本機測試回合。
    if (!quiz || !quiz.questions.length || quiz.status === 'planned') fail('TOPIC_UNAVAILABLE', '這個主題還沒有可填答的題目。');
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM participants WHERE token_hash = ?').get(digest(privateToken));
      if (existing) {
        const round = this.db.prepare('SELECT * FROM rounds WHERE id = ?').get(existing.round_id);
        if (existing.slot !== 'A' || round.quiz_id !== quizId || existing.nickname !== name) fail('REQUEST_CONFLICT', '這次建立請求與原回合不同。', 409);
        return { id: round.id };
      }
      const id = randomUUID();
      const createdAt = this.stamp();
      this.db.prepare('INSERT INTO rounds(id,quiz_id,snapshot,created_at) VALUES(?,?,?,?)').run(id, quiz.id, JSON.stringify(quiz), createdAt);
      this.db.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)').run(id, 'A', digest(privateToken), name, createdAt);
      return { id };
    });
  }
  status(id, token) {
    const own = this.authenticate(id, token);
    const round = this.db.prepare('SELECT * FROM rounds WHERE id = ?').get(id);
    const peer = this.db.prepare('SELECT nickname,submitted_at FROM participants WHERE round_id = ? AND slot != ?').get(id, own.slot);
    const unlocked = Boolean(own.submitted_at && peer?.submitted_at);
    const state = unlocked ? 'unlocked' : own.submitted_at ? 'waiting' : 'answering';
    return {
      id, quiz: JSON.parse(round.snapshot), createdAt: round.created_at, state,
      own: { nickname: own.nickname, slot: own.slot, answers: JSON.parse(own.answers), revision: own.revision, submittedAt: own.submitted_at },
      peer: peer ? { nickname: peer.nickname, submitted: Boolean(peer.submitted_at) } : null,
      invitationToken: own.slot === 'A' && own.submitted_at ? invitationFor(token, id) : null,
    };
  }
  save(id, token, { answers, revision }) {
    return this.transaction(() => {
      const own = this.authenticate(id, token);
      if (own.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
      const quiz = JSON.parse(this.db.prepare('SELECT snapshot FROM rounds WHERE id = ?').get(id).snapshot);
      if (!answers || typeof answers !== 'object' || Array.isArray(answers) || !Number.isInteger(revision) || revision < 0) fail('INVALID_ANSWERS', '答案格式不正確。');
      const normalized = {};
      for (const key of Object.keys(answers)) {
        const question = quiz.questions.find((item) => item.id === key);
        if (!question || !question.options.some((item) => item.id === answers[key])) fail('INVALID_ANSWERS', '答案包含不屬於本輪的題目或選項。');
      }
      for (const question of quiz.questions) if (Object.hasOwn(answers, question.id)) normalized[question.id] = answers[question.id];
      const encoded = JSON.stringify(normalized);
      if (revision !== own.revision) {
        // 回應遺失後重試同一份答案可安全成功；其他分頁的不同更新需明確處理。
        if (encoded === own.answers) return { revision: own.revision };
        fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
      }
      this.db.prepare('UPDATE participants SET answers = ?, revision = revision + 1 WHERE round_id = ? AND slot = ?').run(encoded, id, own.slot);
      return { revision: own.revision + 1 };
    });
  }
  submit(id, token) {
    this.transaction(() => {
      const own = this.authenticate(id, token);
      if (own.submitted_at) return;
      const quiz = JSON.parse(this.db.prepare('SELECT snapshot FROM rounds WHERE id = ?').get(id).snapshot);
      const answers = JSON.parse(own.answers);
      if (!quiz.questions.every((question) => question.options.some((option) => option.id === answers[question.id]))) fail('INCOMPLETE', '請完成本輪所有題目再提交。');
      this.db.prepare('UPDATE participants SET submitted_at = ? WHERE round_id = ? AND slot = ?').run(this.stamp(), id, own.slot);
      if (own.slot === 'A') this.db.prepare('UPDATE rounds SET invite_hash = ? WHERE id = ?').run(digest(invitationFor(token, id)), id);
    });
    return this.status(id, token);
  }
  invitation(token) {
    requireToken(token);
    const round = this.db.prepare('SELECT * FROM rounds WHERE invite_hash = ?').get(digest(token));
    if (!round) fail('INVITATION_INVALID', '邀請連結不完整或不存在。', 404);
    return round;
  }
  invitationPreview(token) {
    const round = this.invitation(token);
    const a = this.db.prepare("SELECT nickname FROM participants WHERE round_id = ? AND slot = 'A'").get(round.id);
    const b = this.db.prepare("SELECT 1 FROM participants WHERE round_id = ? AND slot = 'B'").get(round.id);
    const quiz = JSON.parse(round.snapshot);
    return { id: round.id, hostName: a.nickname, title: quiz.title, questionCount: quiz.questions.length, claimed: Boolean(b) };
  }
  claim({ invitationToken, nickname, consent, privateToken }) {
    requireToken(privateToken);
    const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    return this.transaction(() => {
      const round = this.invitation(invitationToken);
      const existing = this.db.prepare("SELECT * FROM participants WHERE round_id = ? AND slot = 'B'").get(round.id);
      if (existing) {
        if (existing.token_hash === digest(privateToken) && existing.nickname === name) return { id: round.id };
        fail('INVITATION_CLAIMED', '這個邀請已有人加入。請使用自己的私人返回連結。', 409);
      }
      if (this.db.prepare('SELECT 1 FROM participants WHERE token_hash = ?').get(digest(privateToken))) fail('REQUEST_CONFLICT', '請使用另一個私人返回憑證。', 409);
      this.db.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)').run(round.id, 'B', digest(privateToken), name, this.stamp());
      return { id: round.id };
    });
  }
  results(id, token) {
    this.authenticate(id, token);
    const participants = this.db.prepare('SELECT slot,nickname,answers,submitted_at FROM participants WHERE round_id = ? ORDER BY slot').all(id);
    if (participants.length !== 2 || !participants.every((person) => person.submitted_at)) fail('RESULTS_LOCKED', '雙方完成後才能查看共同結果。', 423);
    const round = this.db.prepare('SELECT snapshot,created_at FROM rounds WHERE id = ?').get(id);
    return { quiz: JSON.parse(round.snapshot), createdAt: round.created_at, participants: participants.map((person) => ({ slot: person.slot, nickname: person.nickname, answers: JSON.parse(person.answers), submittedAt: person.submitted_at })) };
  }
}
