import { describe, expect, it } from 'vitest';
import { longDistanceQuiz } from '../content/long-distance';
import { coreValuesExample } from '../content/quizzes';
import { analyzeDistance } from './long-distance';
import { validateQuiz } from './quiz';

const blank = () => Object.fromEntries(longDistanceQuiz.questions.map((q) => [q.id, 'prefer-not-share']));
const choices = () => ({
  a: { ...blank(), 'ldr-busy-wanted': 'before', 'ldr-busy-actual': 'after', 'ldr-support-wanted': 'listen', 'ldr-support-actual': 'solutions', 'ldr-visit-wanted': 'weekly', 'ldr-visit-capacity': 'monthly', 'ldr-call-arrangement': 'fixed' },
  b: { ...blank(), 'ldr-busy-wanted': 'after', 'ldr-busy-actual': 'after', 'ldr-support-wanted': 'solutions', 'ldr-support-actual': 'solutions', 'ldr-visit-wanted': 'monthly', 'ldr-visit-capacity': 'monthly', 'ldr-call-arrangement': 'fixed' },
});
describe('遠距分析的語意與邊界', () => {
  it('完整保留 24 題原稿及來源，沒有數值計分', () => {
    expect(validateQuiz(longDistanceQuiz)).toEqual([]);
    expect(longDistanceQuiz.questions).toHaveLength(24);
    expect(longDistanceQuiz.scoring).toBeUndefined();
    expect(longDistanceQuiz.questions.every((q) => q.evidence.status === 'research-informed')).toBe(true);
  });
  it('A 的期待對 B 做法；B 的期待對 A 做法，反向各有自己的結果', () => {
    const { a, b } = choices(); const r = analyzeDistance(longDistanceQuiz, a, b)!;
    expect(r.differences.find((f) => f.id === 'busy-response-A')?.evidence.map((e) => [e.slot, e.questionId, e.label])).toEqual([
      ['A', 'ldr-busy-wanted', '忙之前先說一聲'], ['B', 'ldr-busy-actual', '忙完後再完整回覆'],
    ]);
    expect(r.common.some((f) => f.id === 'busy-response-B')).toBe(true);
    expect(r.differences.find((f) => f.id === 'support-A')?.advice).toContain('我現在想先說完');
    expect(r.common.some((f) => f.id === 'support-B')).toBe(true);
    expect(r.conditions.find((f) => f.id === 'visits-A')?.state).toBe('different');
    expect(r.conditions.find((f) => f.id === 'visits-B')?.state).toBe('common');
    expect([...r.common, ...r.differences].some((f) => f.kind === 'within-person')).toBe(false);
    expect(r.common.find((f) => f.id === 'preference-ldr-call-arrangement')?.advice).toContain('固定時段');
    expect(r).not.toHaveProperty('score');
    expect(r.suggestions).toHaveLength(6);
    expect(r.suggestions.every((f) => f.advice && f.sourceIds.length && f.evidence.length === 2)).toBe(true);
  });
  it('不同通話偏好不偏袒 A 的安排，近期經驗不當成共同偏好', () => {
    const { a, b } = choices(); b['ldr-call-arrangement'] = 'spontaneous';
    const r = analyzeDistance(longDistanceQuiz, a, b)!;
    const call = r.differences.find((f) => f.id === 'preference-ldr-call-arrangement')!;
    expect(call.advice).not.toContain('都方便的固定時段');
    expect(r.context.some((f) => f.id === 'context-ldr-contact-actual')).toBe(true);
  });
  it('兩人都暫不分享不被當共同點；完全無可比較回答不生成建議', () => {
    const r = analyzeDistance(longDistanceQuiz, blank(), blank())!;
    expect(r.common).toEqual([]); expect(r.differences).toEqual([]); expect(r.suggestions).toEqual([]);
    expect(r.context.every((f) => f.advice === null)).toBe(true);
  });
  it('不適用、未遇到、未知做法與彈性安排均保留情境，不判成落差', () => {
    const { a, b } = choices();
    b['ldr-support-actual'] = 'other'; b['ldr-busy-actual'] = 'no-opportunity'; a['ldr-visit-wanted'] = 'flexible';
    const r = analyzeDistance(longDistanceQuiz, a, b)!;
    for (const id of ['support-A', 'busy-response-A', 'visits-A']) {
      expect([...r.context, ...r.conditions].find((f) => f.id === id)?.advice).toBeNull();
      expect(r.suggestions.some((f) => f.id === id)).toBe(false);
    }
  });
  it('缺答、非法答案、未知規則與斷裂映射會拒絕；舊快照無規則就不分析', () => {
    const { a, b } = choices(); const partial: Record<string, string> = { ...a }; delete partial['ldr-support-wanted'];
    expect(() => analyzeDistance(longDistanceQuiz, partial, b)).toThrow('完整合法');
    expect(() => analyzeDistance(longDistanceQuiz, { ...a, 'ldr-support-wanted': 'invalid' }, b)).toThrow('完整合法');
    const changed = structuredClone(longDistanceQuiz); changed.analysis!.version = '2.0.0' as '1.0.0';
    expect(() => analyzeDistance(changed, a, b)).toThrow('版本');
    changed.analysis!.version = '1.0.0'; changed.analysis!.pairs[0].wantedQuestionId = 'missing';
    expect(validateQuiz(changed)).toContain('雙人分析找不到題目或配對題目重複');
    expect(analyzeDistance(coreValuesExample, {}, {})).toBeUndefined();
  });
  it('規則與提案依傳入快照，新題庫的修改不改舊提案', () => {
    const { a, b } = choices(); const old = structuredClone(longDistanceQuiz);
    const newer = structuredClone(longDistanceQuiz); newer.analysis!.pairs[0].optionAdvice!.before = '新版測試提案';
    expect(analyzeDistance(newer, a, b)!.differences.find((f) => f.id === 'busy-response-A')?.advice).toContain('新版測試提案');
    expect(analyzeDistance(old, a, b)!.differences.find((f) => f.id === 'busy-response-A')?.advice).not.toContain('新版測試提案');
  });
});
