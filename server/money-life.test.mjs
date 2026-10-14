import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { D1RoundStore } from '../cloudflare/store.mjs';
import { moneyLifeQuiz } from '../src/content/money-life.ts';
let runtime; let db;
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  const sql = await readFile(new URL('../cloudflare/migrations/0001_rounds.sql', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../cloudflare/migrations/0002_lifecycle.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
}, 30000);
afterAll(async () => { await runtime?.dispose(); });
const token = () => randomBytes(32).toString('hex');
const blank = () => Object.fromEntries(moneyLifeQuiz.questions.map((q) => [q.id, 'not-shared']));
describe.each(['Node', 'D1'])('%s 生活金錢回合保存與保密', (mode) => {
  it('缺答拒絕、替換未分享、提交前保密、解鎖雙向結果及快照固定', async () => {
    const catalog = [structuredClone(moneyLifeQuiz)];
    const store = mode === 'Node' ? new RoundStore(':memory:', { catalog }) : new D1RoundStore(db, { catalog });
    try {
      const a = token(); const b = token();
      const { id } = await store.create({ quizId: 'money-life', nickname: '工程 A', consent: true, privateToken: a });
      catalog[0].moneyLife.crossPairs[0].adviceByWanted['cost-scope'] = '不應追套的新提案';
      const answersA = { ...blank(), 'money-proposal-want': 'cost-scope', 'money-proposal-do': 'meaning' };
      const answersB = { ...blank(), 'money-proposal-want': 'meaning', 'money-proposal-do': 'meaning' };
      const partial = { ...answersA }; delete partial['money-plan-work'];
      await store.save(id, a, { answers: partial, revision: 0 });
      await expect(Promise.resolve().then(() => store.submit(id, a))).rejects.toMatchObject({ code: 'INCOMPLETE' });
      await store.save(id, a, { answers: { ...answersA, 'money-pooling-boundary': 'this-plan-only' }, revision: 1 });
      await store.save(id, a, { answers: answersA, revision: 2 });
      expect((await store.status(id, a)).own.answers['money-pooling-boundary']).toBe('not-shared');
      const invitation = (await store.submit(id, a)).invitationToken;
      expect(await store.invitationPreview(invitation)).toMatchObject({ questionCount: 12, hasMoneyLifeAnalysis: true });
      expect(await store.invitationPreview(invitation)).not.toHaveProperty('moneyLifeAnalysis');
      await store.claim({ invitationToken: invitation, nickname: '工程 B', consent: true, privateToken: b });
      const status = await store.status(id, b);
      expect(status.peer).not.toHaveProperty('answers'); expect(status).not.toHaveProperty('moneyLifeAnalysis');
      await expect(Promise.resolve().then(() => store.results(id, a))).rejects.toMatchObject({ status: 423 });
      await store.save(id, b, { answers: answersB, revision: 0 }); await store.submit(id, b);
      const result = await store.results(id, a);
      expect(result).toEqual(await store.results(id, b));
      expect(result.moneyLifeAnalysis.pairs.find((f) => f.id === 'proposal-information-A').state).toBe('different');
      expect(result.moneyLifeAnalysis.pairs.find((f) => f.id === 'proposal-information-B').state).toBe('same');
      expect(JSON.stringify(result)).not.toContain('不應追套的新提案');
      expect(result.participants[0].answers['money-pooling-boundary']).toBe('not-shared');
      expect(result).not.toHaveProperty('comparison'); expect(result).not.toHaveProperty('pairAnalysis');
      await expect(Promise.resolve().then(() => store.results(id, token()))).rejects.toMatchObject({ status: 401 });
      await expect(Promise.resolve().then(() => store.save(id, a, { answers: {}, revision: 3 }))).rejects.toMatchObject({ code: 'ROUND_LOCKED' });
    } finally { if (mode === 'Node') store.close(); }
  });
});
