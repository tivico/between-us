import { validateQuiz, type QuizDefinition, type ResponseKind } from './quiz.ts';
import type { AnalysisEvidence, AnalysisSlot } from './long-distance.ts';

export interface MoneyReading {
  questionId: string; title: string; evidence: AnalysisEvidence[];
  // 本人條件／範圍與討論起點沒有相同／不同判定。
  state: 'same' | 'different' | 'context' | null;
  discussion: string | null;
}
export interface MoneyPairFinding {
  id: string; title: string; wantedSlot: AnalysisSlot; providedSlot: AnalysisSlot;
  state: 'same' | 'different' | 'context'; evidence: AnalysisEvidence[];
  advice: string | null; discussion: string | null;
}
export interface MoneyLifeAnalysis {
  kind: 'money-life-descriptive'; ruleVersion: '1.0.0';
  constraints: MoneyReading[]; boundaries: MoneyReading[]; preferences: MoneyReading[]; processes: MoneyReading[];
  pairs: MoneyPairFinding[];
}

// 只由兩種 store 在授權且雙方提交後呼叫，全部依本輪快照。
export function analyzeMoneyLife(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): MoneyLifeAnalysis | undefined {
  if (!quiz.moneyLife) return undefined;
  if (validateQuiz(quiz).length) throw new Error('生活金錢分析快照不完整或版本不支援');
  for (const answers of [a, b]) {
    if (Object.keys(answers).length !== quiz.questions.length || quiz.questions.some((q) => !q.options.some((o) => o.id === answers[q.id]))) throw new Error('需完整合法答案才能分析');
  }
  return analyzeMoneyLifeV1(quiz, a, b);
}

// 保留 V1；新演算法另增分支，不能追改舊快照。
function analyzeMoneyLifeV1(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): MoneyLifeAnalysis {
  const rule = quiz.moneyLife!;
  const answers = { A: a, B: b };
  const question = (id: string) => quiz.questions.find((q) => q.id === id)!;
  const option = (id: string, slot: AnalysisSlot) => question(id).options.find((o) => o.id === answers[slot][id])!;
  const evidence = (id: string, slot: AnalysisSlot, role: string): AnalysisEvidence => ({ slot, questionId: id, prompt: question(id).prompt, label: option(id, slot).label, role });
  const compare = (left: { id: string; kind?: ResponseKind }, right: { id: string; kind?: ResponseKind }) => left.kind !== 'choice' || right.kind !== 'choice' ? 'context' as const : left.id === right.id ? 'same' as const : 'different' as const;
  const read = (ids: string[], role: string, comparable = false): MoneyReading[] => ids.map((id) => ({
    questionId: id, title: question(id).prompt, evidence: (['A', 'B'] as const).map((slot) => evidence(id, slot, role)),
    state: comparable ? compare(option(id, 'A'), option(id, 'B')) : null,
    discussion: comparable && option(id, 'A').kind === 'choice' && option(id, 'B').kind === 'choice' ? question(id).discussion! : null,
  }));
  const pairs = rule.crossPairs.flatMap((pair) => (['A', 'B'] as const).map((wantedSlot): MoneyPairFinding => {
    const providedSlot = wantedSlot === 'A' ? 'B' : 'A';
    const wanted = option(pair.wantedQuestionId, wantedSlot);
    const state = compare(wanted, option(pair.providedQuestionId, providedSlot));
    return { id: `${pair.id}-${wantedSlot}`, title: pair.title, wantedSlot, providedSlot, state,
      evidence: [evidence(pair.wantedQuestionId, wantedSlot, '目前期待'), evidence(pair.providedQuestionId, providedSlot, '自述最近的做法')],
      advice: state === 'context' ? null : pair.adviceByWanted[wanted.id], discussion: state === 'context' ? null : pair.discussion };
  }));
  return { kind: rule.kind, ruleVersion: '1.0.0',
    constraints: read(rule.constraintQuestionIds, '本人目前條件'), boundaries: read(rule.boundaryQuestionIds, '本人目前願意的範圍'),
    processes: read(rule.processQuestionIds, '想先確認的事'), preferences: read(rule.preferenceQuestionIds, '目前偏好', true), pairs };
}
