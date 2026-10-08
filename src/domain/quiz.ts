export type TopicStatus = 'draft' | 'planned' | 'ready';
export type EvidenceStatus = 'research-informed' | 'validated';
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
  options: { id: string; label: string }[];
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
    if (!question.evidence.sourceIds.length) errors.push(`缺少研究來源：${question.id}`);
    for (const sourceId of question.evidence.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`找不到研究來源：${question.id}/${sourceId}`);
    }
    if (!question.evidence.note.trim()) errors.push(`缺少依據說明：${question.id}`);
  }
  if (quiz.status === 'ready' && !quiz.questions.length) errors.push('正式測驗不能沒有題目');
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
