import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { D1RoundStore } from '../cloudflare/store.mjs';
import worker from '../cloudflare/worker.mjs';
import { retentionMilliseconds } from '../src/domain/retention.ts';

const token = () => randomBytes(32).toString('hex');
let runtime, db;
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  for (const name of ['0001_rounds.sql', '0002_lifecycle.sql']) {
    const sql = await readFile(new URL(`../cloudflare/migrations/${name}`, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
}, 30000);
afterAll(async () => { await runtime?.dispose(); });

for (const mode of ['Node', 'D1']) describe(`${mode} 資料生命週期`, () => {
  async function fixture() {
    let time = Date.parse('2026-10-14T00:00:00Z');
    const store = mode === 'Node' ? new RoundStore(':memory:', { now: () => time }) : new D1RoundStore(db, { now: () => time });
    const a = token(), b = token();
    const { id } = await store.create({ quizId: 'money-life', nickname: '明示 QA A', consent: true, privateToken: a });
    const quiz = (await store.status(id, a)).quiz;
    const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
    await store.save(id, a, { answers, revision: 0 });
    const invitationToken = (await store.submit(id, a)).invitationToken;
    await store.claim({ invitationToken, privateToken: b, nickname: '明示 QA B', consent: true });
    await store.save(id, b, { answers, revision: 0 });
    await store.submit(id, b);
    return { store, a, b, id, answers, invitationToken, advance: (delta) => { time += delta; }, finish: () => store.close?.(),
      run: (sql, ...args) => mode === 'Node' ? store.db.prepare(sql).run(...args) : store.statement(sql, ...args).run(),
      row: (sql, ...args) => mode === 'Node' ? store.db.prepare(sql).get(...args) : store.one(sql, ...args) };
  }
  it('退出清除本人答案／暱稱並停止共享，另一方可讀自己的資料，重試安全', async () => {
    const f = await fixture();
    try {
      await expect(Promise.resolve().then(() => f.store.withdraw(f.id, token(), { confirm: 'withdraw' }))).rejects.toMatchObject({ status: 401 });
      await expect(Promise.resolve().then(() => f.store.withdraw(f.id, f.a, {}))).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
      await f.store.withdraw(f.id, f.a, { confirm: 'withdraw' });
      expect(await f.store.withdraw(f.id, f.a, { confirm: 'withdraw' })).toEqual({ withdrawn: true });
      const erased = await f.row("SELECT answers,nickname,submitted_at FROM participants WHERE round_id=? AND slot='A'", f.id);
      expect(erased).toMatchObject({ answers: '{}', nickname: '已退出', submitted_at: null });
      const status = await f.store.status(f.id, f.b);
      expect(status.state).toBe('closed'); expect(status.own.answers).toEqual(f.answers);
      expect(status.peer).not.toHaveProperty('answers'); expect(status.invitationToken).toBeNull();
      for (const t of [f.a, f.b]) await expect(Promise.resolve().then(() => f.store.results(f.id, t))).rejects.toMatchObject({ status: 410 });
      await expect(Promise.resolve().then(() => f.store.save(f.id, f.b, { answers: f.answers, revision: 1 }))).rejects.toMatchObject({ status: 410 });
      await expect(Promise.resolve().then(() => f.store.submit(f.id, f.b))).rejects.toMatchObject({ status: 410 });
      await expect(Promise.resolve().then(() => f.store.invitationPreview(f.invitationToken))).rejects.toMatchObject({ status: 404 });
      await f.store.withdraw(f.id, f.b, { confirm: 'withdraw' });
      expect((await f.row("SELECT answers FROM participants WHERE round_id=? AND slot='B'", f.id)).answers).toBe('{}');
    } finally { f.finish(); }
  });
  it('連結更換可重試，舊返回／邀請失效，另一方及原答案／快照／期限不變', async () => {
    const f = await fixture();
    try {
      const original = await f.store.results(f.id, f.a), expiry = (await f.store.status(f.id, f.a)).expiresAt;
      const replacement = token();
      await f.store.rotate(f.id, f.a, { privateToken: replacement });
      expect(await f.store.rotate(f.id, f.a, { privateToken: replacement })).toEqual({ rotated: true });
      await expect(Promise.resolve().then(() => f.store.status(f.id, f.a))).rejects.toMatchObject({ status: 401 });
      await expect(Promise.resolve().then(() => f.store.invitationPreview(f.invitationToken))).rejects.toMatchObject({ status: 404 });
      expect(await f.store.results(f.id, replacement)).toEqual(original);
      expect(await f.store.results(f.id, f.b)).toEqual(original);
      expect((await f.store.status(f.id, replacement)).expiresAt).toBe(expiry);
      const row = await f.row("SELECT token_hash,previous_token_hash FROM participants WHERE round_id=? AND slot='A'", f.id);
      expect(JSON.stringify(row)).not.toContain(replacement); expect(JSON.stringify(row)).not.toContain(f.a);
      await expect(Promise.resolve().then(() => f.store.rotate(f.id, replacement, { privateToken: f.b }))).rejects.toMatchObject({ status: 409 });
      // B 不能拿 A 的舊 token 當作重試證據。
      await expect(Promise.resolve().then(() => f.store.rotate(f.id, f.a, { privateToken: f.b }))).rejects.toMatchObject({ status: 401 });
    } finally { f.finish(); }
  });
  it('180 天精確邊界停止讀寫、邀請、更換；清理只移除到期回合，既有無期限保留', async () => {
    const f = await fixture();
    try {
      const legacy = token();
      const { id: legacyId } = await f.store.create({ quizId: 'core-values-example', nickname: '既有 QA', consent: true, privateToken: legacy });
      await f.run('UPDATE rounds SET expires_at=NULL WHERE id=?', legacyId);
      expect((await f.store.status(f.id, f.a)).expiresAt).toBe('2027-04-12T00:00:00.000Z');
      f.advance(retentionMilliseconds - 1); expect((await f.store.status(f.id, f.a)).state).toBe('unlocked');
      f.advance(1);
      for (const call of [() => f.store.status(f.id, f.a), () => f.store.results(f.id, f.b), () => f.store.save(f.id, f.a, { answers: {}, revision: 1 }), () => f.store.submit(f.id, f.a), () => f.store.invitationPreview(f.invitationToken), () => f.store.rotate(f.id, f.a, { privateToken: token() }), () => f.store.withdraw(f.id, f.a, { confirm: 'withdraw' })]) await expect(Promise.resolve().then(call)).rejects.toMatchObject({ code: 'ROUND_EXPIRED', status: 410 });
      expect((await f.store.status(legacyId, legacy)).expiresAt).toBeNull();
      expect(await f.store.cleanupExpired()).toBeGreaterThanOrEqual(1);
      expect(await f.row('SELECT count(*) AS n FROM participants WHERE round_id=?', f.id)).toMatchObject({ n: 0 });
      expect(await f.row('SELECT count(*) AS n FROM rounds WHERE id=?', f.id)).toMatchObject({ n: 0 });
      expect((await f.store.status(legacyId, legacy)).expiresAt).toBeNull();
    } finally { f.finish(); }
  });
});

it('Node 從 schema 1 migration 保留既有快照及答案，不覆寫更高版本', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'between-us-migration-'));
  const path = join(directory, 'qa.sqlite');
  const database = new DatabaseSync(path);
  const schema = await readFile(new URL('../cloudflare/migrations/0001_rounds.sql', import.meta.url), 'utf8');
  database.exec(schema + ';PRAGMA user_version=1;');
  const id = randomUUID();
  database.prepare('INSERT INTO rounds(id,quiz_id,snapshot,created_at) VALUES(?,?,?,?)').run(id, 'qa', '{"legacy":true}', '2020-01-01');
  database.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at,answers) VALUES(?,?,?,?,?,?)').run(id, 'A', 'hash-only', '既有QA', '2020-01-01', '{"qa":"old"}');
  database.close();
  const store = new RoundStore(path);
  try {
    expect(store.db.prepare('SELECT snapshot,expires_at FROM rounds WHERE id=?').get(id)).toEqual({ snapshot: '{"legacy":true}', expires_at: null });
    expect(store.db.prepare('SELECT answers FROM participants WHERE round_id=?').get(id).answers).toBe('{"qa":"old"}');
    store.db.exec('PRAGMA user_version=3;');
  } finally { store.close(); }
  expect(() => new RoundStore(path)).toThrow('比此程式新');
  await rm(directory, { recursive: true });
});

it('D1 的退出與並行保存／提交／加入不會恢復已刪除答案或邀請', async () => {
  const store = new D1RoundStore(db); const a = token(), b = token();
  const { id } = await store.create({ quizId: 'core-values-example', nickname: '競爭QA', consent: true, privateToken: a });
  const quiz = (await store.status(id, a)).quiz;
  const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
  await store.save(id, a, { answers, revision: 0 });
  const { invitationToken } = await store.submit(id, a);
  await Promise.allSettled([
    store.withdraw(id, a, { confirm: 'withdraw' }), store.submit(id, a),
    store.claim({ invitationToken, privateToken: b, nickname: '競爭QAB', consent: true }),
  ]);
  expect((await store.one("SELECT answers,withdrawn_at FROM participants WHERE round_id=? AND slot='A'", id)).answers).toBe('{}');
  expect((await store.one('SELECT invite_hash FROM rounds WHERE id=?', id)).invite_hash).toBeNull();
  await expect(store.results(id, a)).rejects.toMatchObject({ status: 410 });
  const c = token(); const draft = await store.create({ quizId: 'core-values-example', nickname: '草稿競爭QA', consent: true, privateToken: c });
  await Promise.allSettled([store.save(draft.id, c, { answers, revision: 0 }), store.withdraw(draft.id, c, { confirm: 'withdraw' })]);
  expect((await store.one('SELECT answers FROM participants WHERE round_id=?', draft.id)).answers).toBe('{}');
});

it('Worker scheduled 實際清除過期資料，無期限回合不受影響', async () => {
  const store = new D1RoundStore(db); const a = token();
  const { id } = await store.create({ quizId: 'core-values-example', nickname: '排程QA', consent: true, privateToken: a });
  await store.statement('UPDATE rounds SET expires_at=? WHERE id=?', '2000-01-01T00:00:00.000Z', id).run();
  await worker.scheduled({}, { DB: db });
  expect(await store.one('SELECT count(*) AS n FROM rounds WHERE id=?', id)).toMatchObject({ n: 0 });
});

it('D1 同一更換請求並行可安全重試，不同新憑證競爭只有一份生效', async () => {
  const store = new D1RoundStore(db);
  const a = token(), replacement = token();
  const { id } = await store.create({ quizId: 'core-values-example', nickname: '同一請求QA', consent: true, privateToken: a });
  const same = await Promise.all([store.rotate(id, a, { privateToken: replacement }), store.rotate(id, a, { privateToken: replacement })]);
  expect(same).toEqual([{ rotated: true }, { rotated: true }]);
  await expect(store.status(id, a)).rejects.toMatchObject({ status: 401 });
  const choices = [token(), token()];
  const different = await Promise.allSettled(choices.map((privateToken) => store.rotate(id, replacement, { privateToken })));
  expect(different.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const winner = different.findIndex((r) => r.status === 'fulfilled');
  expect((await store.status(id, choices[winner])).own.nickname).toBe('同一請求QA');
  await expect(store.status(id, choices[1-winner])).rejects.toMatchObject({ status: 401 });
});

it('D1 0002 套在已有資料的 schema1，保留答案、快照及無期限狀態', async () => {
  const isolated = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  try {
    const database = await isolated.getD1Database('DB');
    const apply = async (name) => {
      const sql = await readFile(new URL(`../cloudflare/migrations/${name}`, import.meta.url), 'utf8');
      await database.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => database.prepare(s)));
    };
    await apply('0001_rounds.sql');
    const id = randomUUID();
    await database.batch([
      database.prepare('INSERT INTO rounds(id,quiz_id,snapshot,created_at) VALUES(?,?,?,?)').bind(id, 'legacy-qa', '{"legacy":true}', '2020-01-01'),
      database.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at,answers) VALUES(?,?,?,?,?,?)').bind(id, 'A', 'hash-only', '既有D1 QA', '2020-01-01', '{"qa":"old"}'),
    ]);
    await apply('0002_lifecycle.sql');
    expect(await database.prepare('SELECT snapshot,expires_at FROM rounds WHERE id=?').bind(id).first()).toEqual({ snapshot: '{"legacy":true}', expires_at: null });
    expect(await database.prepare('SELECT answers,withdrawn_at,previous_token_hash FROM participants WHERE round_id=?').bind(id).first()).toEqual({ answers: '{"qa":"old"}', withdrawn_at: null, previous_token_hash: null });
  } finally { await isolated.dispose(); }
});
