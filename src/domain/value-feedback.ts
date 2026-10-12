import type { QuizDefinition } from './quiz.ts';
import type { ValueComparison } from './compatibility.ts';
import { coreValueFeedbackV1, legacyCoreValueLayoutV1 } from '../content/core-value-feedback.ts';

export interface ValueInsight {
  id: string;
  label: string;
  meaning: string;
  title: string;
  scenario: string;
  question: string;
  followUp: string;
  sourceId: string;
  questionIds: string[];
  a: number;
  b: number;
  gap: number;
  higher: 'A' | 'B' | null;
}
export interface ValueFeedback {
  version: '1.0.0';
  origin: 'snapshot' | 'legacy-reading-layer';
  reason: 'undifferentiated' | null;
  priorities: { A: string[]; B: string[] };
  common: ValueInsight[];
  differences: ValueInsight[];
  commonTied: boolean;
  differencesTied: boolean;
  excludedValueIds: string[];
}

const epsilon = 1e-9; // 僅處理浮點誤差，不是心理測量門檻。
export function buildValueFeedback(quiz: QuizDefinition, comparison?: ValueComparison): ValueFeedback | undefined {
  if (!quiz.scoring || !comparison) return undefined;
  let recipe = quiz.feedback;
  const origin: ValueFeedback['origin'] = recipe ? 'snapshot' : 'legacy-reading-layer';
  if (!recipe) {
    // 舊 0.3.0 作答不改快照，只加明示版本的固定閱讀層。
    if (quiz.id !== 'core-values' || quiz.version !== '0.3.0' || quiz.scoring.version !== '1.0.0' || quiz.scoring.values.length !== 19
      || legacyCoreValueLayoutV1.some((expected) => { const value = quiz.scoring!.values.find((item) => item.id === expected.id); return !value || value.questionIds.length !== 3 || expected.questionIds.some((id) => !value.questionIds.includes(id)); })) return undefined;
    recipe = coreValueFeedbackV1;
  }
  if (recipe.kind !== 'core-values-conversation' || recipe.version !== '1.0.0') throw new Error('不支援的核心價值回饋版本');
  const currentRecipe = recipe;
  const values: ValueInsight[] = comparison.values.flatMap((value) => {
    const definition = currentRecipe.perspectives.find((item) => item.id === value.id);
    if (!definition || currentRecipe.excludedValueIds.includes(value.id)) return [];
    return [{ ...value, ...definition, label: value.label, sourceId: currentRecipe.sourceId,
      higher: value.gap <= epsilon ? null : value.a > value.b ? 'A' as const : 'B' as const }];
  });
  const priorities = (slot: 'a' | 'b') => values.filter((value) => value[slot] > epsilon).sort((x, y) => y[slot] - x[slot]).slice(0, 3).map((value) => value.label);
  const base = { version: '1.0.0' as const, origin, reason: comparison.reason, excludedValueIds: [...recipe.excludedValueIds] };
  if (comparison.score === null) return { ...base, priorities: { A: [], B: [] }, common: [], differences: [], commonTied: false, differencesTied: false };
  const common = values.filter((value) => value.a > epsilon && value.b > epsilon).sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b));
  const differences = values.filter((value) => value.gap > epsilon).sort((x, y) => y.gap - x.gap);
  const commonTied = common.length > 3 && Math.abs(Math.min(common[2].a, common[2].b) - Math.min(common[3].a, common[3].b)) <= epsilon;
  const differencesTied = differences.length > 3 && Math.abs(differences[2].gap - differences[3].gap) <= epsilon;
  return { ...base, priorities: { A: priorities('a'), B: priorities('b') }, common: common.slice(0, 3), differences: differences.slice(0, 3), commonTied, differencesTied };
}
