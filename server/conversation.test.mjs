import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { D1RoundStore } from '../cloudflare/store.mjs';
import { questionnaires } from '../src/content/questionnaires.ts';

let runtime; let db;
const token = () => randomBytes(32).toString('hex');
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  const sql = await readFile(new URL('../cloudflare/migrations/0001_rounds.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map((part) => part.trim()).filter(Boolean).map((part) => db.prepare(part)));
}, 30000);
afterAll(async () => { await runtime?.dispose(); });

it.each(['Node', 'D1'])('%s：八題組各自建立四題回合，跨題組答案被拒，缺答與特殊狀態正確處理', async (mode) => {
  const catalog = structuredClone(questionnaires);
  const store = mode === 'Node' ? new RoundStore(':memory:', { catalog }) : new D1RoundStore(db, { catalog });
  try {
    for (const quiz of catalog) {
      const a = token(); const b = token();
      const { id } = await store.create({ quizId: quiz.id, nickname: '問答 QA A', consent: true, privateToken: a });
      const initial = await store.status(id, a);
      expect(initial.quiz.questions).toHaveLength(4);
      expect(initial).not.toHaveProperty('conversation');
      const first = quiz.questions[0];
      const answerA = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
      const otherQuestion = catalog.find((q) => q.id !== quiz.id).questions[0];
      await expect(Promise.resolve().then(() => store.save(id, a, { answers: { [otherQuestion.id]: otherQuestion.options[0].id }, revision: 0 }))).rejects.toMatchObject({ code: 'INVALID_ANSWERS' });
      const partial = { [first.id]: first.options[0].id };
      await store.save(id, a, { answers: partial, revision: 0 });
      await expect(Promise.resolve().then(() => store.submit(id, a))).rejects.toMatchObject({ code: 'INCOMPLETE' });
      answerA[first.id] = 'not-shared';
      await store.save(id, a, { answers: answerA, revision: 1 });
      expect((await store.status(id, a)).own.answers[first.id]).toBe('not-shared');
      const persisted = mode === 'Node' ? store.db.prepare("SELECT answers FROM participants WHERE round_id=? AND slot='A'").get(id) : await store.one("SELECT answers FROM participants WHERE round_id=? AND slot='A'", id);
      expect(JSON.parse(persisted.answers)[first.id]).toBe('not-shared');
      const invitationToken = (await store.submit(id, a)).invitationToken;
      const preview = await store.invitationPreview(invitationToken);
      expect(preview.isQuestionnaire).toBe(true);
      expect(preview.questionCount).toBe(4);
      expect(preview).not.toHaveProperty('answers');
      expect(preview).not.toHaveProperty('conversation');
      await store.claim({ invitationToken, nickname: '問答 QA B', consent: true, privateToken: b });
      expect((await store.status(id, b)).peer).not.toHaveProperty('answers');
      await expect(Promise.resolve().then(() => store.results(id, b))).rejects.toMatchObject({ code: 'RESULTS_LOCKED' });
      const answerB = Object.fromEntries(quiz.questions.map((q, index) => [q.id, index === 1 ? q.options[1].id : index === 3 ? 'uncertain' : q.options[0].id]));
      await store.save(id, b, { answers: answerB, revision: 0 });
      await store.submit(id, b);
      const result = await store.results(id, a);
      expect(result.conversation.items.map((item) => item.status)).toEqual(['context', 'different', 'common', 'context']);
      expect(result.conversation.items[0].forB).toBeNull();
      expect(result.conversation.items[1].forA).toBe(quiz.questions[1].options[1].guidance);
      expect(result.participants[0].answers[first.id]).toBe('not-shared');
      expect(result).not.toHaveProperty('comparison');
      expect(await store.results(id, b)).toEqual(result);
      const originalAdvice = result.conversation.items[1].forA;
      quiz.questions[1].options[1].guidance = '新版 registry 不得覆寫舊回合';
      expect((await store.results(id, a)).conversation.items[1].forA).toBe(originalAdvice);
      await expect(Promise.resolve().then(() => store.save(id, a, { answers: {}, revision: 2 }))).rejects.toMatchObject({ code: 'ROUND_LOCKED' });
    }
  } finally { if (mode === 'Node') store.close(); }
}, 30000);
