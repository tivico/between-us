import { describe, expect, it } from 'vitest';
import { communicationQuiz } from '../content/communication';
import { coreValuesExample } from '../content/quizzes';
import { analyzeCommunication } from './communication';
import { validateQuiz } from './quiz';
const blank = () => Object.fromEntries(communicationQuiz.questions.map((q) => [q.id, 'not-shared']));
describe('溝通探索的配對與版本邊界', () => {
  it('24題與12組語意完整，四題明示自編，無分數', () => {
    expect(validateQuiz(communicationQuiz)).toEqual([]);
    expect(communicationQuiz.questions).toHaveLength(24);
    expect(communicationQuiz.questions.filter((q) => q.evidence.status === 'self-authored')).toHaveLength(4);
    expect(communicationQuiz.questions.every((q) => q.prompt.includes('你') && !q.prompt.includes('這個人'))).toBe(true);
    expect(communicationQuiz.scoring).toBeUndefined();
  });
  it('A期待對B做法、B期待對A做法，摘要保留兩方向而非相同題目', () => {
    const a = { ...blank(), 'comm-timing-want': 'set-time', 'comm-timing-do': 'check-now' };
    const b = { ...blank(), 'comm-timing-want': 'check-now', 'comm-timing-do': 'right-away' };
    const result = analyzeCommunication(communicationQuiz, a, b)!;
    expect(result.findings.find((f) => f.id === 'timing-A')).toMatchObject({ state: 'different', wantedSlot: 'A', providedSlot: 'B', advice: expect.stringContaining('雙方做得到的時間') });
    expect(result.findings.find((f) => f.id === 'timing-B')).toMatchObject({ state: 'same', wantedSlot: 'B', providedSlot: 'A' });
    expect(result.summaries[0].pairId).toBe('timing');
    expect(result.findings.filter((f) => f.pairId === result.summaries[0].pairId)).toHaveLength(2);
    expect(result.summaries.slice(1).every((s) => s.pairId === null)).toBe(true);
    expect(result).not.toHaveProperty('score');
  });
  it('窮舉1080組主要／特殊選項：其他及未分享不比同類、無提案', () => {
    let count = 0;
    for (const pair of communicationQuiz.communication!.pairs) {
      const wanted = communicationQuiz.questions.find((q) => q.id === pair.wantedQuestionId)!;
      const provided = communicationQuiz.questions.find((q) => q.id === pair.providedQuestionId)!;
      for (const w of wanted.options) for (const p of provided.options) {
        const a = { ...blank(), [wanted.id]: w.id };
        const b = { ...blank(), [provided.id]: p.id };
        const finding = analyzeCommunication(communicationQuiz, a, b)!.findings.find((f) => f.id === `${pair.id}-A`)!;
        if (w.kind !== 'choice' || p.kind !== 'choice') {
          expect(finding.state).toBe('context'); expect(finding.advice).toBeNull(); expect(finding.discussion).toBeNull();
        } else {
          expect(finding.state).toBe(w.meaningId === p.meaningId ? 'same' : 'different');
          expect(finding.advice).toBe(pair.providerSuggestions[w.id]);
        }
        count++;
      }
    }
    expect(count).toBe(1080);
  });
  it('全為未分享不硬湊摘要，結果只含未分享標籤', () => {
    const r = analyzeCommunication(communicationQuiz, blank(), blank())!;
    expect(r.findings.every((f) => f.state === 'context' && f.advice === null && f.evidence.every((e) => e.label === '未分享'))).toBe(true);
    expect(r.summaries.every((s) => s.pairId === null)).toBe(true);
  });
  it('拒絕缺答、非法答案、未知版本與錯誤映射；舊無規則不分析', () => {
    const partial = blank(); delete partial['comm-timing-do'];
    expect(() => analyzeCommunication(communicationQuiz, partial, blank())).toThrow('完整合法');
    expect(() => analyzeCommunication(communicationQuiz, { ...blank(), 'comm-timing-do': 'bad' }, blank())).toThrow('完整合法');
    for (const mutate of [
      (q: typeof communicationQuiz) => { q.communication!.version = '2.0.0' as '1.0.0'; },
      (q: typeof communicationQuiz) => { q.communication!.pairs[0].wantedQuestionId = 'missing'; },
      (q: typeof communicationQuiz) => { q.questions[0].options[0].meaningId = 'wrong'; },
      (q: typeof communicationQuiz) => { delete q.communication!.pairs[0].providerSuggestions['set-time']; },
    ]) {
      const q = structuredClone(communicationQuiz); mutate(q);
      expect(() => analyzeCommunication(q, blank(), blank())).toThrow('快照');
    }
    expect(analyzeCommunication(coreValuesExample, {}, {})).toBeUndefined();
  });
  it('提案固定在傳入快照，新題庫不覆寫舊結果', () => {
    const old = structuredClone(communicationQuiz); const newer = structuredClone(communicationQuiz);
    newer.communication!.pairs[0].providerSuggestions['set-time'] = '新版提案';
    const a = { ...blank(), 'comm-timing-want': 'set-time' }; const b = { ...blank(), 'comm-timing-do': 'right-away' };
    expect(analyzeCommunication(newer, a, b)!.findings[0].advice).toBe('新版提案');
    expect(analyzeCommunication(old, a, b)!.findings[0].advice).not.toBe('新版提案');
  });
});
