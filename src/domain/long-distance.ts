import { validateQuiz, type QuizDefinition } from './quiz.ts';

export type AnalysisSlot = 'A' | 'B';
export interface AnalysisEvidence {
  slot: AnalysisSlot;
  questionId: string;
  prompt: string;
  label: string;
  role: string;
}
export interface DistanceFinding {
  id: string;
  title: string;
  kind: 'preference' | 'cross-partner' | 'within-person' | 'context';
  state: 'common' | 'different' | 'context';
  description: string;
  evidence: AnalysisEvidence[];
  advice: string | null;
  sourceIds: string[];
}
export interface DistanceAnalysis {
  kind: 'long-distance-paired';
  ruleVersion: '1.0.0';
  common: DistanceFinding[];
  differences: DistanceFinding[];
  conditions: DistanceFinding[];
  context: DistanceFinding[];
  suggestions: DistanceFinding[];
}

// 僅由已解鎖 results 呼叫。所有題目、排除選項、模板均取自該輪 snapshot。
// 新算法另加分支，保留 V1；不得用最新題庫或外部生成服務覆寫舊結果。
export function analyzeDistance(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): DistanceAnalysis | undefined {
  if (!quiz.analysis) return undefined;
  if (quiz.analysis.kind !== 'long-distance-paired' || quiz.analysis.version !== '1.0.0' || validateQuiz(quiz).length) throw new Error('雙人分析快照不完整或版本不支援');
  for (const answers of [a, b]) {
    if (Object.keys(answers).length !== quiz.questions.length || quiz.questions.some((q) => !q.options.some((o) => o.id === answers[q.id]))) throw new Error('需完整合法答案才能分析');
  }
  return analyzeDistanceV1(quiz, a, b);
}

function analyzeDistanceV1(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): DistanceAnalysis {
  const rule = quiz.analysis!;
  const answers = { A: a, B: b };
  const excluded = new Set(rule.excludedOptionIds);
  const findings: DistanceFinding[] = [];
  const used = new Set<string>();
  const evidence = (slot: AnalysisSlot, questionId: string, role: string): AnalysisEvidence => {
    const q = quiz.questions.find((q) => q.id === questionId)!;
    return { slot, questionId, role, prompt: q.prompt, label: q.options.find((o) => o.id === answers[slot][questionId])!.label };
  };
  const add = (id: string, title: string, kind: DistanceFinding['kind'], entries: AnalysisEvidence[], commonAdvice: string, differentAdvice: string, optionAdvice?: Record<string, string>) => {
    const ids = entries.map((e) => answers[e.slot][e.questionId]);
    const unavailable = ids.some((id) => excluded.has(id));
    const contextual = kind === 'context' || unavailable;
    const state = contextual ? 'context' : ids[0] === ids[1] ? 'common' : 'different';
    const description = unavailable ? '這組回答先保留在各自情境中，請看原選項；不歸類為相同或不同，也不推論原因。'
      : kind === 'context' ? '這裡整理各自的近期經驗、條件或討論狀態，請一起確認當時情境。'
      : kind === 'within-person' ? (state === 'common' ? '這個人的見面期待與目前可行間隔相同。' : '這個人的見面期待與目前可行安排不同，可以先了解現實條件。')
      : kind === 'cross-partner' ? (state === 'common' ? '一方希望收到的回應，與另一方自述通常提供的第一步相同。' : '一方希望收到的回應，與另一方自述的第一步不同，值得確認當下需要。')
      : state === 'common' ? '你們這題選了相同的偏好，可以再確認各自的理由。' : '你們這題的偏好不同，可以一起找可接受的安排。';
    const sourceIds = [...new Set(entries.flatMap((e) => quiz.questions.find((q) => q.id === e.questionId)!.evidence.sourceIds))];
    findings.push({ id, title, kind, state, description, evidence: entries, sourceIds,
      advice: contextual ? null : [state === 'common' ? commonAdvice : differentAdvice, kind !== 'preference' || state === 'common' ? optionAdvice?.[ids[0]] : undefined].filter(Boolean).join(' ') });
  };
  // 先看雙向提供／期待，再看各自期待／條件；排列順序是編輯選擇，非風險排名。
  for (const pair of rule.pairs) {
    used.add(pair.wantedQuestionId); used.add(pair.providedQuestionId);
    for (const slot of ['A', 'B'] as const) {
      const provider = pair.kind === 'cross-partner' ? (slot === 'A' ? 'B' : 'A') : slot;
      add(`${pair.id}-${slot}`, pair.title, pair.kind,
        [evidence(slot, pair.wantedQuestionId, '希望'), evidence(provider, pair.providedQuestionId, pair.kind === 'cross-partner' ? '實際做法' : '可行條件')],
        pair.commonAdvice, pair.differentAdvice, pair.optionAdvice);
    }
  }
  for (const item of rule.comparisons) {
    used.add(item.questionId);
    add(`preference-${item.questionId}`, item.title, 'preference',
      [evidence('A', item.questionId, '偏好'), evidence('B', item.questionId, '偏好')], item.commonAdvice, item.differentAdvice, item.optionAdvice);
  }
  for (const q of quiz.questions.filter((q) => !used.has(q.id))) {
    add(`context-${q.id}`, q.prompt, 'context', [evidence('A', q.id, '自己的回答'), evidence('B', q.id, '自己的回答')], '', '');
  }
  // 一輪先選六個可討論的安排；其餘建議仍留在各共同／差異卡中。
  const differences = findings.filter((f) => f.state === 'different' && f.kind !== 'within-person');
  const common = findings.filter((f) => f.state === 'common' && f.kind !== 'within-person');
  const conditions = findings.filter((f) => f.kind === 'within-person');
  const proposed = [...findings.filter((f) => f.state === 'different'), ...findings.filter((f) => f.state === 'common')];
  return { kind: 'long-distance-paired', ruleVersion: '1.0.0', common, differences,
    conditions, context: findings.filter((f) => f.state === 'context' && f.kind !== 'within-person'), suggestions: proposed.slice(0, 6) };
}
