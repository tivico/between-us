import { describe, expect, it } from 'vitest';
import { coreValuesQuiz } from '../content/core-values';
import { coreValuesExample } from '../content/quizzes';
import { compareValues } from './compatibility';
import { buildValueFeedback } from './value-feedback';
import { validateQuiz, type QuizDefinition } from './quiz';

function answerGroups(levels: Record<string, number>, quiz = coreValuesQuiz) {
  return Object.fromEntries(quiz.scoring!.values.flatMap((value) => value.questionIds.map((id) => [id, quiz.questions.find((q) => q.id === id)!.options[(levels[value.id] ?? 2) - 1].id])));
}
const feedback = (a: Record<string, number>, b = a, quiz = coreValuesQuiz) => buildValueFeedback(quiz, compareValues(quiz, answerGroups(a, quiz), answerGroups(b, quiz)))!;

describe('核心價值回饋的可追溯選題', () => {
  it('共同方向須兩人都高於本人平均，不把共同低分當共同重視；差異保留方向與三題', () => {
    const report = feedback({ 'self-direction-thought': 6, 'universalism-tolerance': 6, face: 6 }, { 'self-direction-thought': 6, 'universalism-tolerance': 2, face: 6 });
    expect(report.common.map((item) => item.id)).toEqual(['self-direction-thought']);
    expect(report.differences[0]).toMatchObject({ id: 'universalism-tolerance', higher: 'A', questionIds: ['pvqrr-14', 'pvqrr-34', 'pvqrr-57'] });
    expect(report.common.some((item) => item.id === 'power-resources')).toBe(false);
    expect([...report.common, ...report.differences].some((item) => item.id === 'face')).toBe(false);
  });
  it('完全相同的相對輪廓沒有差異，少於三個共同方向不硬湊', () => {
    const report = feedback({ 'self-direction-thought': 6 });
    expect(report.common).toHaveLength(1);
    expect(report.differences).toEqual([]);
  });
  it('兩人優先方向不交集時，不製造共同點；同分差距穩定排序並明示', () => {
    const report = feedback({ 'self-direction-thought': 6, stimulation: 6 }, { 'self-direction-action': 6, hedonism: 6 });
    expect(report.common).toEqual([]);
    expect(report.differences.map((item) => item.id)).toEqual(['self-direction-thought', 'self-direction-action', 'stimulation']);
    expect(report.differencesTied).toBe(true);
  });
  it('任一輪廓未分化時不排序，仍回可閱讀的明示原因', () => {
    const report = feedback({}, { 'self-direction-thought': 6 });
    expect(report.reason).toBe('undifferentiated');
    expect(report.common).toEqual([]); expect(report.differences).toEqual([]);
    expect(report.priorities).toEqual({ A: [], B: [] });
  });
  it('只為原 0.3.0 完整對應加固定閱讀層；不支援的舊快照與三題不套用', () => {
    const legacy: QuizDefinition = structuredClone(coreValuesQuiz); delete legacy.feedback; legacy.version = '0.3.0';
    const report = feedback({ 'self-direction-thought': 6 }, undefined, legacy);
    expect(report.origin).toBe('legacy-reading-layer');
    expect(legacy).not.toHaveProperty('feedback'); expect(legacy.version).toBe('0.3.0');
    const mismatched = structuredClone(legacy);
    [mismatched.scoring!.values[0].questionIds, mismatched.scoring!.values[1].questionIds] = [mismatched.scoring!.values[1].questionIds, mismatched.scoring!.values[0].questionIds];
    expect(feedback({ 'self-direction-thought': 6 }, undefined, mismatched)).toBeUndefined();
    expect(buildValueFeedback(coreValuesExample)).toBeUndefined();
  });
  it('回饋對應與題號／來源不符時阻擋快照；自訂新回合內容保持可追溯', () => {
    const changed = structuredClone(coreValuesQuiz);
    changed.feedback!.perspectives[0].questionIds[0] = 'pvqrr-02';
    expect(validateQuiz(changed).some((error) => error.includes('題號不符'))).toBe(true);
    changed.feedback!.sourceId = 'missing';
    expect(validateQuiz(changed).some((error) => error.includes('契約不完整'))).toBe(true);
    const valid = structuredClone(coreValuesQuiz);
    valid.feedback!.perspectives[0].scenario = '本輪固定情境';
    expect(feedback({ 'self-direction-thought': 6 }, undefined, valid).common[0].scenario).toBe('本輪固定情境');
  });
});
