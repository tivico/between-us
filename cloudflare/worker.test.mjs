import { afterAll, beforeAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import worker from './worker.mjs';
import { D1RoundStore } from './store.mjs';

let runtime; let db;
const token = () => randomBytes(32).toString('hex');
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  const sql = await readFile(new URL('./migrations/0001_rounds.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map((part) => part.trim()).filter(Boolean).map((part) => db.prepare(part)));
}, 30000);
afterAll(async () => { await runtime?.dispose(); });
const store = () => new D1RoundStore(db);
async function call(path, { method = 'GET', credential, body, origin, contentType = 'application/json' } = {}) {
  const headers = {};
  if (credential) headers.Authorization = `Bearer ${credential}`;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = contentType;
  const response = await worker.fetch(new Request(`https://between-us.example${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), { DB: db });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function create() {
  const a = token(); const input = { quizId: 'core-values', nickname: '測試 A', consent: true, privateToken: a };
  const { id } = await store().create(input); return { id, a, input };
}
async function submitA(id, a) {
  const quiz = (await store().status(id, a)).quiz;
  const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
  await store().save(id, a, { answers, revision: 0 });
  return { invitation: (await store().submit(id, a)).invitationToken, answers, quiz };
}

it('健康檢查實際連資料庫；API 不快取，拒絕跨來源', async () => {
  const healthy = await call('/api/health');
  expect(healthy.body).toEqual({ ok: true, mode: 'cloudflare-test' });
  expect(healthy.headers.get('Cache-Control')).toBe('no-store');
  expect((await call('/api/health', { origin: 'https://other.example' })).status).toBe(403);
});
it('兩人獨立保存、邀請與解鎖，提交前不傳對方答案，陌生憑證被擋', async () => {
  const { id, a } = await create();
  expect((await call(`/api/rounds/${id}/status`, { credential: token() })).status).toBe(401);
  expect((await call(`/api/rounds/${id}/results`, { credential: a })).status).toBe(423);
  const { invitation, answers, quiz } = await submitA(id, a);
  const preview = await call('/api/invitations/preview', { credential: invitation });
  expect(preview.body).not.toHaveProperty('answers');
  const b = token();
  expect((await call('/api/invitations/claim', { method: 'POST', body: { invitationToken: invitation, privateToken: b, nickname: '測試 B', consent: true } })).status).toBe(200);
  const statusB = await call(`/api/rounds/${id}/status`, { credential: b });
  expect(statusB.body.own.answers).toEqual({});
  expect(statusB.body.peer).toEqual({ nickname: '測試 A', submitted: true });
  expect((await call(`/api/rounds/${id}/results`, { credential: b })).status).toBe(423);
  const answersB = { ...answers, [quiz.questions[0].id]: quiz.questions[0].options[1].id };
  await call(`/api/rounds/${id}/answers`, { method: 'PUT', credential: b, body: { answers: answersB, revision: 0 } });
  expect((await call(`/api/rounds/${id}/submit`, { method: 'POST', credential: b, body: {} })).body.state).toBe('unlocked');
  const results = (await call(`/api/rounds/${id}/results`, { credential: a })).body;
  expect(results.participants.map((p) => p.answers)).toEqual([answers, answersB]);
  expect((await call(`/api/rounds/${id}/answers`, { method: 'PUT', credential: a, body: { answers: {}, revision: 1 } })).status).toBe(409);
});
it('同時建立重試不留下多餘回合；資料庫只保存憑證雜湊', async () => {
  const a = token(); const input = { quizId: 'core-values', nickname: '重試', consent: true, privateToken: a };
  const results = await Promise.all([store().create(input), store().create(input)]);
  expect(results[0]).toEqual(results[1]);
  expect((await db.prepare("SELECT count(*) AS n FROM participants WHERE nickname='重試'").first()).n).toBe(1);
  const rows = await db.prepare('SELECT * FROM participants WHERE round_id=?').bind(results[0].id).all();
  expect(JSON.stringify(rows)).not.toContain(a);
  const counts = await db.prepare('SELECT (SELECT count(*) FROM rounds) AS r,(SELECT count(*) FROM participants WHERE slot=\'A\') AS a').first();
  expect(counts.r).toBe(counts.a);
});
it('同時接受一份邀請只有一人成功；成功者重試可返回', async () => {
  const { id, a } = await create(); const { invitation } = await submitA(id, a);
  const inputs = ['甲', '乙'].map((nickname) => ({ invitationToken: invitation, nickname, consent: true, privateToken: token() }));
  const results = await Promise.allSettled(inputs.map((input) => store().claim(input)));
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const winner = results.findIndex((r) => r.status === 'fulfilled');
  expect(await store().claim(inputs[winner])).toEqual({ id });
});
it('同時保存不同答案拒絕過時更新；不完整與不合法答案不能提交', async () => {
  const { id, a } = await create();
  const answers = [{ 'values-work-choice': 'autonomy' }, { 'values-work-choice': 'security' }];
  const results = await Promise.allSettled(answers.map((value) => store().save(id, a, { answers: value, revision: 0 })));
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const saved = (await store().status(id, a)).own.answers;
  expect(await store().save(id, a, { answers: saved, revision: 0 })).toEqual({ revision: 1 });
  await expect(store().submit(id, a)).rejects.toMatchObject({ code: 'INCOMPLETE' });
  await expect(store().save(id, a, { answers: { wrong: 'wrong' }, revision: 1 })).rejects.toMatchObject({ code: 'INVALID_ANSWERS' });
});
it('驗證 HTTP JSON 格式、大小、同意分享與未準備主題', async () => {
  expect((await call('/api/rounds', { method: 'POST', body: '{broken' })).status).toBe(400);
  expect((await call('/api/rounds', { method: 'POST', body: 'x'.repeat(32769) })).status).toBe(413);
  expect((await call('/api/rounds', { method: 'POST', body: {}, contentType: 'text/plain' })).status).toBe(415);
  const input = { quizId: 'core-values', nickname: '人', privateToken: token(), consent: false };
  expect((await call('/api/rounds', { method: 'POST', body: input })).body.code).toBe('CONSENT_REQUIRED');
  expect((await call('/api/rounds', { method: 'POST', body: { ...input, consent: true, quizId: 'long-distance' } })).body.code).toBe('TOPIC_UNAVAILABLE');
});
