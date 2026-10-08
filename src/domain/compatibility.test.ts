import { describe, expect, it } from 'vitest';
import { coreValuesQuiz } from '../content/core-values';
import { coreValuesExample } from '../content/quizzes';
import { validateQuiz } from './quiz';
import { compareValues, scoreValues } from './compatibility';

function pattern(ratings: number[]) {
  return Object.fromEntries(coreValuesQuiz.scoring!.values.flatMap((value, index) => value.questionIds.map((id) => [id, coreValuesQuiz.questions[0].options[ratings[index] - 1].id])));
}
const alternating = Array.from({ length: 19 }, (_, index) => index % 6 + 1);
describe('PVQ-RR 計分與探索性比較', () => {
  it('完整對應 57 題，六選項使用明確原數值，19 類各三題', () => {
    expect(validateQuiz(coreValuesQuiz)).toEqual([]);
    const profile = scoreValues(coreValuesQuiz, pattern(alternating));
    expect(profile.mrat).toBeCloseTo(64 / 19);
    expect(profile.values[0].mean).toBe(1);
    expect(profile.values[5].mean).toBe(6);
    expect(profile.values[0].centered).toBeCloseTo(1 - 64 / 19);
    expect(profile.values.reduce((sum, value) => sum + value.centered, 0)).toBeCloseTo(0);
    const malformed = structuredClone(coreValuesQuiz);
    malformed.scoring!.values[1].questionIds = malformed.scoring!.values[0].questionIds;
    expect(() => scoreValues(malformed, pattern(alternating))).toThrow('快照');
  });
  it('相同與整體平移的相對輪廓都是 100，交換雙方不影響結果', () => {
    const low = Array.from({ length: 19 }, (_, index) => index % 5 + 1);
    const a = pattern(low); const b = pattern(low.map((rating) => rating + 1));
    expect(compareValues(coreValuesQuiz, a, a)?.score).toBe(100);
    expect(compareValues(coreValuesQuiz, a, b)?.score).toBeCloseTo(100);
    expect(compareValues(coreValuesQuiz, b, a)?.meanGap).toBeCloseTo(0);
  });
  it('可手算的差距依等權重公式計算，不以相同選項比例代替', () => {
    const swapped = [...alternating]; [swapped[0], swapped[5]] = [swapped[5], swapped[0]];
    const result = compareValues(coreValuesQuiz, pattern(alternating), pattern(swapped))!;
    expect(result.meanGap).toBeCloseTo(10 / 19);
    expect(result.score).toBeCloseTo(100 * (1 - 2 / 19));
    expect(result.values[0].gap).toBe(5);
  });
  it('任何未分化輪廓都不給總分；缺答或未知選項不補值', () => {
    const flat = pattern(Array(19).fill(4));
    expect(compareValues(coreValuesQuiz, flat, flat)?.score).toBeNull();
    expect(compareValues(coreValuesQuiz, flat, pattern(alternating))?.reason).toBe('undifferentiated');
    const missing = pattern(alternating); delete missing['pvqrr-57'];
    expect(() => scoreValues(coreValuesQuiz, missing)).toThrow('完整合法');
    expect(() => scoreValues(coreValuesQuiz, { ...pattern(alternating), 'pvqrr-01': 'unknown' })).toThrow('完整合法');
    expect(compareValues(coreValuesExample, {}, {})).toBeUndefined();
  });
  it('相反輪廓分數有界且對稱；相對負值不被改成零', () => {
    const a = pattern(alternating); const b = pattern(alternating.map((rating) => 7 - rating));
    const result = compareValues(coreValuesQuiz, a, b)!;
    expect(result.score).toBeGreaterThanOrEqual(0); expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeCloseTo(compareValues(coreValuesQuiz, b, a)!.score!);
    expect(result.profiles[0].values[0].centered).toBeLessThan(0);
  });
});
