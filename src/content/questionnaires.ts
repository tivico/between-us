import bank from '../../docs/quizzes/getting-to-know-you.json' with { type: 'json' };
import type { QuizDefinition, ResponseKind, Theme } from '../domain/quiz.ts';

export const questionnaires: QuizDefinition[] = bank.groups.map((group) => {
  const sourceIds = new Set(group.questions.flatMap((question) => question.sourceIds));
  return {
    id: `know-${group.id}`, version: bank.version, title: group.title, subtitle: group.subtitle,
    description: '一輪四題，各自回答，再看共同點、不同想法與相處提案。做完這組就可以結束，想繼續再選另一組。',
    audience: '交往前探索・交往中的兩人', status: 'ready', theme: group.theme as Theme,
    motif: group.motif as QuizDefinition['motif'], dimensions: [group.title],
    questionnaire: { kind: 'four-question-conversation', version: bank.ruleVersion as '1.0.0', groupId: group.id, depth: group.depth as '輕鬆' | '深入' | '較私密' },
    evidenceSummary: '本站自編問答，用來認識本輪偏好與期待；不是已驗證量表，不提供契合分數。研究只作概念背景，選項與相處提案由本站設計，不能用來判定人格或關係成敗。',
    sources: bank.sources.filter((source) => sourceIds.has(source.id) || source.id === 'aron-1997'),
    instructions: '選最接近目前想法的一項；若多項符合，先選本情境下最優先的一項。也可以選其他、依情境、尚未想清楚或不適用。暫不分享會取代該題原有選擇，結果只顯示未分享。回答不等於承諾或答應對方。',
    questions: group.questions.map((question) => ({
      id: question.id, dimension: group.title, prompt: question.prompt,
      help: '選最接近你目前想法的一項。沒有標準答案，也不必解釋私人經歷。',
      options: question.options.map((option) => ({ ...option, kind: option.kind as ResponseKind })),
      discussion: question.discussion, together: question.together,
      evidence: { status: 'self-authored', sourceIds: question.sourceIds,
        note: question.sourceIds.length ? '本站自編情境與選項。所列研究只支持概念背景，未驗證本題、四題比較或相處提案的效果。' : '本站原創生活問答，尚無直接支持這組選項的測量證據；只整理本輪選擇，不推論人格或關係品質。' },
    })),
  };
});
