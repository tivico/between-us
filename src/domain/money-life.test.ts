import { describe, expect, it } from 'vitest';
import { moneyLifeQuiz } from '../content/money-life';
import bank from '../../docs/quizzes/money-life-candidate.json';
import { coreValuesExample } from '../content/quizzes';
import { analyzeMoneyLife } from './money-life';
import { validateQuiz, type QuizDefinition } from './quiz';
const blank = () => Object.fromEntries(moneyLifeQuiz.questions.map((q) => [q.id, 'not-shared']));
describe('一起生活的選擇：描述性結果與邊界', () => {
  it('完整接入已同意的12題，題幹／選項不改，沒有量表分數', () => {
    expect(validateQuiz(moneyLifeQuiz)).toEqual([]);
    expect(moneyLifeQuiz.questions).toHaveLength(12);
    for (const [index, q] of moneyLifeQuiz.questions.entries()) {
      expect(q.prompt).toBe(bank.questions[index].prompt);
      expect(q.options.map((o) => o.id)).toEqual(bank.questions[index].options.map((o) => o.id));
      expect(q.options.map((o) => o.label)).toEqual(bank.questions[index].options.map((o) => o.kind === 'not-shared' ? '未分享' : o.label));
    }
    expect(moneyLifeQuiz.scoring).toBeUndefined();
  });
  it('平分偏好相同不覆蓋不參加／不集中，條件與範圍沒有相同判定', () => {
    const a = { ...blank(), 'money-split-principle': 'equal-amount', 'money-over-capacity': 'not-participating', 'money-pooling-boundary': 'none-separate' };
    const b = { ...blank(), 'money-split-principle': 'equal-amount', 'money-pooling-boundary': 'this-plan-only' };
    const r = analyzeMoneyLife(moneyLifeQuiz, a, b)!;
    expect(r.preferences[0].state).toBe('same');
    expect(r.constraints[0]).toMatchObject({ state: null, discussion: null });
    expect(r.constraints[0].evidence[0].label).toContain('先不參加');
    expect(r.boundaries[0]).toMatchObject({ state: null, discussion: null });
    expect(r.boundaries[0].evidence[0].label).toContain('目前都不集中');
    expect(r).not.toHaveProperty('score');
  });
  it('A期待對B做法，B期待對A做法，各方向獨立', () => {
    const a = { ...blank(), 'money-proposal-want': 'cost-scope', 'money-proposal-do': 'meaning' };
    const b = { ...blank(), 'money-proposal-want': 'meaning', 'money-proposal-do': 'meaning' };
    const r = analyzeMoneyLife(moneyLifeQuiz, a, b)!;
    expect(r.pairs[0]).toMatchObject({ state: 'different', wantedSlot: 'A', providedSlot: 'B', advice: expect.stringContaining('有哪些費用') });
    expect(r.pairs[1]).toMatchObject({ state: 'same', wantedSlot: 'B', providedSlot: 'A' });
  });
  it('窮舉180種配對：兩人其他、未分享或沒經歷不比較、不給提案', () => {
    let count = 0;
    for (const pair of moneyLifeQuiz.moneyLife!.crossPairs) {
      const wanted = moneyLifeQuiz.questions.find((q) => q.id === pair.wantedQuestionId)!;
      const provided = moneyLifeQuiz.questions.find((q) => q.id === pair.providedQuestionId)!;
      for (const w of wanted.options) for (const p of provided.options) {
        const r = analyzeMoneyLife(moneyLifeQuiz, { ...blank(), [wanted.id]: w.id }, { ...blank(), [provided.id]: p.id })!;
        const finding = r.pairs.find((f) => f.id === `${pair.id}-A`)!;
        if (w.kind !== 'choice' || p.kind !== 'choice') expect(finding).toMatchObject({ state: 'context', advice: null, discussion: null });
        else expect(finding).toMatchObject({ state: w.id === p.id ? 'same' : 'different', advice: pair.adviceByWanted[w.id] });
        expect(r.pairs.find((f) => f.id === `${pair.id}-B`)!.state).toBe('context');
        count++;
      }
    }
    expect(count).toBe(180);
  });
  it('未知流程只呈現原選項，全未分享不硬湊比較／提案', () => {
    const r = analyzeMoneyLife(moneyLifeQuiz, { ...blank(), 'money-plan-change': 'current-scope' }, blank())!;
    expect(r.processes[1]).toMatchObject({ state: null, discussion: null });
    expect(r.processes[1].evidence[0].label).toBe(moneyLifeQuiz.questions.find((q) => q.id === 'money-plan-change')!.options.find((o) => o.id === 'current-scope')!.label);
    const empty = analyzeMoneyLife(moneyLifeQuiz, blank(), blank())!;
    expect(empty.pairs.every((f) => f.state === 'context' && f.advice === null)).toBe(true);
    expect(empty.preferences.every((f) => f.state === 'context')).toBe(true);
    expect([...empty.constraints, ...empty.boundaries].every((f) => f.evidence.every((e) => e.label === '未分享'))).toBe(true);
  });
  it('拒絕缺答、非法答案、不支援版本、條件混進偏好及錯誤配對', () => {
    const partial = blank(); delete partial['money-plan-work'];
    expect(() => analyzeMoneyLife(moneyLifeQuiz, partial, blank())).toThrow('完整合法');
    expect(() => analyzeMoneyLife(moneyLifeQuiz, { ...blank(), 'money-plan-work': 'bad' }, blank())).toThrow('完整合法');
    for (const mutate of [
      (q: QuizDefinition) => { q.moneyLife!.version = '2.0.0' as '1.0.0'; },
      (q: QuizDefinition) => { q.moneyLife!.crossPairs[0].wantedQuestionId = 'money-over-capacity'; },
      (q: QuizDefinition) => { [q.moneyLife!.preferenceQuestionIds[0], q.moneyLife!.constraintQuestionIds[0]] = [q.moneyLife!.constraintQuestionIds[0], q.moneyLife!.preferenceQuestionIds[0]]; },
      (q: QuizDefinition) => { delete q.moneyLife!.crossPairs[0].adviceByWanted.meaning; },
      (q: QuizDefinition) => { q.questions[1].options[0].id = 'wrong'; },
    ]) {
      const q = structuredClone(moneyLifeQuiz); mutate(q);
      expect(() => analyzeMoneyLife(q, blank(), blank())).toThrow('快照');
    }
    expect(analyzeMoneyLife(coreValuesExample, {}, {})).toBeUndefined();
  });
  it('只讀傳入快照，舊提案與舊條件不被新輪追改', () => {
    const old = structuredClone(moneyLifeQuiz), newer = structuredClone(moneyLifeQuiz);
    newer.moneyLife!.crossPairs[0].adviceByWanted.meaning = '新版提案';
    const a = { ...blank(), 'money-proposal-want': 'meaning' }, b = { ...blank(), 'money-proposal-do': 'meaning' };
    expect(analyzeMoneyLife(newer, a, b)!.pairs[0].advice).toBe('新版提案');
    expect(analyzeMoneyLife(old, a, b)!.pairs[0].advice).not.toBe('新版提案');
  });
});
