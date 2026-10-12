import type { QuizDefinition } from './quiz.ts';

export interface ConversationComparison {
  version: '1.0.0';
  items: { questionId: string; status: 'common' | 'different' | 'context'; forA: string | null; forB: string | null; together: string | null; discussion: string }[];
}

// 依本輪快照的選項語意與文字組合建議；特殊狀態不推論相同、差異或本人行為。
export function compareConversation(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): ConversationComparison | undefined {
  if (!quiz.questionnaire) return undefined;
  if (quiz.questionnaire.kind !== 'four-question-conversation' || quiz.questionnaire.version !== '1.0.0') throw new Error('不支援的問答規則版本');
  return {
    version: '1.0.0',
    items: quiz.questions.map((question) => {
      const first = question.options.find((option) => option.id === a[question.id]);
      const second = question.options.find((option) => option.id === b[question.id]);
      if (!first || !second) throw new Error('問答結果缺少有效答案');
      const concrete = first.kind === 'choice' && second.kind === 'choice';
      return {
        questionId: question.id, status: concrete ? first.id === second.id ? 'common' : 'different' : 'context',
        // 給 A 的提案根據 B 希望的做法，給 B 則根據 A；不把期待推成實際行為。
        forA: concrete ? second.guidance ?? null : null, forB: concrete ? first.guidance ?? null : null,
        together: concrete ? question.together ?? null : null, discussion: question.discussion ?? '',
      };
    }),
  };
}
