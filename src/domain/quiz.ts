export type TopicStatus = 'draft' | 'planned' | 'ready';
export type EvidenceStatus = 'self-authored' | 'research-informed' | 'validated';
export type ResponseKind = 'choice' | 'other' | 'varies' | 'uncertain' | 'not-applicable' | 'not-experienced' | 'not-shared';
export type Theme = 'sage' | 'clay' | 'sand' | 'lavender' | 'blue';

export interface ResearchSource {
  id: string;
  title: string;
  authors: string;
  year: number;
  url: string;
  scope: string;
}

// 選項 ID 只用於識別，不代表 1、2、3、4 分或優劣。
export interface Question {
  id: string;
  dimension: string;
  prompt: string;
  help: string;
  options: { id: string; label: string; kind?: ResponseKind; guidance?: string }[];
  discussion?: string;
  together?: string;
  evidence: {
    status: EvidenceStatus;
    sourceIds: string[];
    note: string;
  };
}

export interface QuizDefinition {
  id: string;
  version: string;
  title: string;
  subtitle: string;
  description: string;
  audience: string;
  status: TopicStatus;
  theme: Theme;
  motif: 'arches' | 'distance' | 'conversation' | 'balance' | 'space';
  dimensions: string[];
  questions: Question[];
  sources: ResearchSource[];
  evidenceSummary: string;
  instructions?: string;
  questionnaire?: { kind: 'four-question-conversation'; version: '1.0.0'; groupId: string; depth: '輕鬆' | '深入' | '較私密' };
  scoring?: {
    kind: 'pvqrr-centered-distance';
    version: '1.0.0';
    optionValues: Record<string, number>;
    values: { id: string; label: string; questionIds: string[] }[];
  };
}

export interface Answer {
  questionId: string;
  optionId: string;
}

export function validateQuiz(quiz: QuizDefinition): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(quiz.id)) errors.push('測驗 ID 格式不正確');
  if (!quiz.version.trim()) errors.push('缺少版本');
  if (!quiz.title.trim()) errors.push('缺少標題');
  const sourceIds = new Set(quiz.sources.map((source) => source.id));
  if (sourceIds.size !== quiz.sources.length) errors.push('研究來源 ID 重複');
  const questionIds = new Set<string>();
  for (const question of quiz.questions) {
    if (!question.id.trim()) errors.push('缺少題目 ID');
    if (questionIds.has(question.id)) errors.push(`題目 ID 重複：${question.id}`);
    questionIds.add(question.id);
    if (!question.prompt.trim()) errors.push(`缺少題幹：${question.id}`);
    if (!quiz.dimensions.includes(question.dimension)) errors.push(`未知面向：${question.id}`);
    if (question.options.length < 2) errors.push(`選項不足：${question.id}`);
    const optionIds = new Set(question.options.map((option) => option.id));
    if (optionIds.size !== question.options.length) errors.push(`選項 ID 重複：${question.id}`);
    if (question.options.some((option) => !option.id.trim() || !option.label.trim())) errors.push(`空白選項：${question.id}`);
    if (!question.evidence.sourceIds.length && question.evidence.status !== 'self-authored') errors.push(`缺少研究來源：${question.id}`);
    for (const sourceId of question.evidence.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`找不到研究來源：${question.id}/${sourceId}`);
    }
    if (!question.evidence.note.trim()) errors.push(`缺少依據說明：${question.id}`);
  }
  if (quiz.status === 'ready' && !quiz.questions.length) errors.push('正式測驗不能沒有題目');
  if (quiz.questionnaire) {
    if (quiz.questionnaire.kind !== 'four-question-conversation' || quiz.questionnaire.version !== '1.0.0' || !quiz.questionnaire.groupId.trim()) errors.push('不支援的問答規則');
    if (quiz.questions.length !== 4 || quiz.scoring) errors.push('雙人問答每輪需四題且不能附量表計分');
    for (const question of quiz.questions) {
      const choices = question.options.filter((option) => option.kind === 'choice');
      if (choices.length !== 4 || choices.some((option) => !option.guidance?.trim()) || !question.discussion?.trim() || !question.together?.trim()) errors.push(`問答選項或建議不完整：${question.id}`);
      if (question.options.filter((option) => option.kind === 'not-shared').length !== 1) errors.push(`缺少唯一未分享狀態：${question.id}`);
    }
  }
  for (const question of quiz.questions) {
    if (!quiz.questionnaire && question.options.some((option) => option.kind)) errors.push(`特殊問答狀態不能加入既有測驗：${question.id}`);
    if (question.options.some((option) => option.kind && !['choice', 'other', 'varies', 'uncertain', 'not-applicable', 'not-experienced', 'not-shared'].includes(option.kind))) errors.push(`未知答案狀態：${question.id}`);
  }
  if (quiz.scoring) {
    const scoring = quiz.scoring;
    if (scoring.kind !== 'pvqrr-centered-distance' || scoring.version !== '1.0.0') errors.push('不支援的計分版本');
    const ids = scoring.values.flatMap((value) => value.questionIds);
    if (quiz.questions.length !== 57 || scoring.values.length !== 19 || scoring.values.some((value) => value.questionIds.length !== 3 || !value.label.trim()) || new Set(ids).size !== 57 || ids.some((id) => !questionIds.has(id)) || new Set(scoring.values.map((value) => value.id)).size !== 19) errors.push('計分對應需完整涵蓋 57 題與 19 類');
    for (const question of quiz.questions) {
      if (question.options.length !== 6 || question.options.some((option, index) => scoring.optionValues[option.id] !== index + 1)) errors.push(`量表選項數值不完整：${question.id}`);
    }
  }
  for (const source of quiz.sources) {
    try {
      if (new URL(source.url).protocol !== 'https:') errors.push(`研究來源須使用 HTTPS：${source.id}`);
    } catch { errors.push(`研究來源網址不正確：${source.id}`); }
  }
  return errors;
}

export function validateAnswer(quiz: QuizDefinition, answer: Answer): boolean {
  return quiz.questions.some((question) =>
    question.id === answer.questionId && question.options.some((option) => option.id === answer.optionId),
  );
}
