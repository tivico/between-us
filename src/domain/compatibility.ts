import { validateQuiz, type QuizDefinition } from './quiz.ts';

export interface ValueProfile {
  mrat: number;
  differentiated: boolean;
  values: { id: string; label: string; mean: number; centered: number }[];
}
export interface ValueComparison {
  ruleVersion: '1.0.0';
  score: number | null;
  reason: 'undifferentiated' | null;
  meanGap: number;
  profiles: [ValueProfile, ValueProfile];
  values: { id: string; label: string; a: number; b: number; gap: number }[];
}

// 原工具計分與本站的雙人比較分開；僅接受回合快照中的完整合法答案。
export function scoreValues(quiz: QuizDefinition, answers: Record<string, string>): ValueProfile {
  if (!quiz.scoring || validateQuiz(quiz).length) throw new Error('計分快照不完整或版本不支援');
  if (Object.keys(answers).length !== 57) throw new Error('需完整合法的 57 題答案才能計分');
  const ratings = new Map<string, number>();
  for (const question of quiz.questions) {
    const optionId = answers[question.id];
    if (!question.options.some((option) => option.id === optionId)) throw new Error('需完整合法的 57 題答案才能計分');
    ratings.set(question.id, quiz.scoring.optionValues[optionId]);
  }
  const mrat = [...ratings.values()].reduce((sum, rating) => sum + rating, 0) / 57;
  const values = quiz.scoring.values.map((value) => {
    const mean = value.questionIds.reduce((sum, id) => sum + ratings.get(id)!, 0) / 3;
    return { id: value.id, label: value.label, mean, centered: mean - mrat };
  });
  return { mrat, values, differentiated: values.some((value) => Math.abs(value.centered) > 1e-9) };
}

export function compareValues(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): ValueComparison | undefined {
  // 舊三題快照沒有計分契約，沿用選項比較，不追套新題庫或新公式。
  if (!quiz.scoring) return undefined;
  const profiles: [ValueProfile, ValueProfile] = [scoreValues(quiz, a), scoreValues(quiz, b)];
  const values = profiles[0].values.map((value, index) => ({
    id: value.id, label: value.label, a: value.centered, b: profiles[1].values[index].centered,
    gap: Math.abs(value.centered - profiles[1].values[index].centered),
  }));
  const meanGap = values.reduce((sum, value) => sum + value.gap, 0) / 19;
  const differentiated = profiles.every((profile) => profile.differentiated);
  // 1–6 量尺的雙人原始差在 [-5,5]；中心化後平均絕對差不超過 5。
  // 線性換算是本站的探索指標，不是原量表公式、常模或戀愛預測。
  return { ruleVersion: '1.0.0', profiles, values, meanGap,
    score: differentiated ? Math.max(0, Math.min(100, 100 * (1 - meanGap / 5))) : null,
    reason: differentiated ? null : 'undifferentiated' };
}
