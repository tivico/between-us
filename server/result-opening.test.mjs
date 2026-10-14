import { expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { RoundStore } from './store.mjs';
import { roundQuizzes } from '../src/content/quizzes.ts';

const token = () => randomBytes(32).toString('hex');
function resultOf(quiz, answerFor) {
  const store = new RoundStore(':memory:', { catalog: [quiz] });
  const a = token(), b = token();
  try {
    const { id } = store.create({ quizId: quiz.id, nickname: '摘要 QA A', consent: true, privateToken: a });
    const answersA = answerFor(quiz, 'A'), answersB = answerFor(quiz, 'B');
    store.save(id, a, { answers: answersA, revision: 0 });
    const { invitationToken } = store.submit(id, a);
    store.claim({ invitationToken, privateToken: b, nickname: '摘要 QA B', consent: true });
    store.save(id, b, { answers: answersB, revision: 0 }); store.submit(id, b);
    return store.results(id, a);
  } finally { store.close(); }
}
it.each(roundQuizzes.filter((q) => q.status === 'ready' && q.id !== 'core-values-example'))('$id 摘要只讀本輪、保留原分析、每張卡可追溯合法選項', (quiz) => {
  const result = resultOf(quiz, (q, slot) => Object.fromEntries(q.questions.map((item, i) => [item.id, item.options[(i + (slot === 'B' ? 1 : 0)) % (q.scoring ? 6 : 2)].id])));
  const { resultOpening: opening } = result;
  expect(opening).toMatchObject({ version: '1.0.0', origin: 'reading-layer' });
  expect(opening.findings.length).toBeLessThanOrEqual(3);
  expect(JSON.stringify(opening)).not.toContain('undefined');
  expect(opening.discoveryEvidence.every((e) => quiz.questions.some((q) => q.id === e.questionId))).toBe(true);
  for (const f of [...opening.findings, { evidence: opening.discoveryEvidence, question: '整體理解' }]) {
    expect(f.question.length).toBeGreaterThan(0);
    if ('id' in f) expect(f.evidence.length).toBeGreaterThan(0);
    for (const e of f.evidence) {
      const person = result.participants.find((p) => p.slot === e.slot);
      const q = quiz.questions.find((item) => item.id === e.questionId);
      expect(e.prompt).toBe(q.prompt);
      expect(e.label).toBe(q.options.find((o) => o.id === person.answers[e.questionId]).label);
    }
  }
});
it.each(roundQuizzes.filter((q) => q.questionnaire || q.communication || q.moneyLife || q.dailyValues || q.analysis))('$id 全未分享不硬湊摘要或聊天提案', (quiz) => {
  const result = resultOf(quiz, (q) => Object.fromEntries(q.questions.map((item) => [item.id, q.analysis ? 'prefer-not-share' : 'not-shared'])));
  expect(result.resultOpening.findings).toEqual([]);
  expect(result.resultOpening.discovery).toContain('沒有足夠');
});
it('未分化核心價值不排序；face 不產生敘事，沒有差異也不硬湊', () => {
  const quiz = roundQuizzes.find((q) => q.id === 'core-values');
  const flat = resultOf(quiz, (q) => Object.fromEntries(q.questions.map((item) => [item.id, item.options[0].id])));
  expect(flat.resultOpening.findings).toEqual([]); expect(flat.resultOpening.discovery).toContain('尚未呈現差異');
  const differentiated = resultOf(quiz, (q) => Object.fromEntries(q.questions.map((item, i) => [item.id, item.options[i % 6].id])));
  expect(differentiated.resultOpening.findings.some((f) => f.category === '值得確認')).toBe(false);
  expect(differentiated.resultOpening.findings.some((f) => f.id.endsWith('-face'))).toBe(false);
});
it('生活摘要的本人界線只呈現願意分享者，不要求另一方未分享理由', () => {
  const quiz = roundQuizzes.find((q) => q.id === 'money-life');
  const result = resultOf(quiz, (q, slot) => Object.fromEntries(q.questions.map((item) => [item.id, slot === 'A' && item.id === q.moneyLife.boundaryQuestionIds[0] ? item.options[0].id : 'not-shared'])));
  expect(result.resultOpening.findings).toHaveLength(1);
  const [finding] = result.resultOpening.findings;
  expect(finding.category).toBe('各自條件'); expect(finding.evidence.map((e) => e.slot)).toEqual(['A']);
  expect(finding.fact).toContain('不要求一致或折衷');
});
