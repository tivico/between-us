import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { D1RoundStore } from '../cloudflare/store.mjs';
import { longDistanceQuiz } from '../src/content/long-distance.ts';
let runtime; let db;
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  const sql = await readFile(new URL('../cloudflare/migrations/0001_rounds.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
}, 30000);
afterAll(async () => { await runtime?.dispose(); });
const token = () => randomBytes(32).toString('hex');
const blank = () => Object.fromEntries(longDistanceQuiz.questions.map((q) => [q.id, 'prefer-not-share']));
describe.each(['Node', 'D1'])('%s 的 24 題保存、保密與快照分析', (mode) => {
  it('未完成拒絕、提交前看不到分析或對方答案、雙方解鎖結果一致；改題庫不追套', async () => {
    const catalog = [structuredClone(longDistanceQuiz)];
    const store = mode === 'Node' ? new RoundStore(':memory:', { catalog }) : new D1RoundStore(db, { catalog });
    try {
      const a = token(); const b = token();
      const { id } = await store.create({ quizId: 'long-distance', nickname: '工程 A', consent: true, privateToken: a });
      catalog[0].analysis.pairs[0].optionAdvice.before = '後來的新題庫提案';
      const answersA = { ...blank(), 'ldr-busy-wanted': 'before', 'ldr-busy-actual': 'after' };
      const answersB = { ...blank(), 'ldr-busy-wanted': 'after', 'ldr-busy-actual': 'after' };
      const partial = { ...answersA }; delete partial['ldr-future-revisit'];
      await store.save(id, a, { answers: partial, revision: 0 });
      await expect(Promise.resolve().then(() => store.submit(id, a))).rejects.toMatchObject({ code: 'INCOMPLETE' });
      await store.save(id, a, { answers: answersA, revision: 1 });
      const invitation = (await store.submit(id, a)).invitationToken;
      const preview = await store.invitationPreview(invitation);
      expect(preview).toMatchObject({ questionCount: 24, hasPairAnalysis: true, hasValueScore: false });
      expect(preview).not.toHaveProperty('pairAnalysis'); expect(preview).not.toHaveProperty('answers');
      await store.claim({ invitationToken: invitation, nickname: '工程 B', consent: true, privateToken: b });
      const status = await store.status(id, b);
      expect(status.own.answers).toEqual({}); expect(status.peer).not.toHaveProperty('answers'); expect(status).not.toHaveProperty('pairAnalysis');
      await expect(Promise.resolve().then(() => store.results(id, a))).rejects.toMatchObject({ status: 423 });
      await store.save(id, b, { answers: answersB, revision: 0 }); await store.submit(id, b);
      const result = await store.results(id, a);
      expect(result).toEqual(await store.results(id, b));
      expect(result.pairAnalysis.differences.find((f) => f.id === 'busy-response-A').advice).toContain('提前說一聲');
      expect(JSON.stringify(result.pairAnalysis)).not.toContain('後來的新題庫提案');
      expect(result.pairAnalysis.common.some((f) => f.id === 'busy-response-B')).toBe(true);
      expect(result).not.toHaveProperty('comparison');
      await expect(Promise.resolve().then(() => store.results(id, token()))).rejects.toMatchObject({ status: 401 });
      await expect(Promise.resolve().then(() => store.save(id, a, { answers: {}, revision: 2 }))).rejects.toMatchObject({ code: 'ROUND_LOCKED' });
    } finally { if (mode === 'Node') store.close(); }
  });
  it('舊快照沒有 analysis 時，不依新 registry 加入分析', async () => {
    const old = structuredClone(longDistanceQuiz); delete old.analysis;
    const store = mode === 'Node' ? new RoundStore(':memory:', { catalog: [old] }) : new D1RoundStore(db, { catalog: [old] });
    try {
      const a = token(); const b = token();
      const { id } = await store.create({ quizId: 'long-distance', nickname: '歷史 A', consent: true, privateToken: a });
      await store.save(id, a, { answers: blank(), revision: 0 }); const invitation = (await store.submit(id, a)).invitationToken;
      await store.claim({ invitationToken: invitation, nickname: '歷史 B', consent: true, privateToken: b });
      await store.save(id, b, { answers: blank(), revision: 0 }); await store.submit(id, b);
      expect(await store.results(id, a)).not.toHaveProperty('pairAnalysis');
    } finally { if (mode === 'Node') store.close(); }
  });
});
