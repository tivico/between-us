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
  instructions?: string;
  analysis?: {
    kind: 'long-distance-paired';
    version: '1.0.0';
    excludedOptionIds: string[];
    comparisons: { questionId: string; title: string; commonAdvice: string; differentAdvice: string; optionAdvice?: Record<string, string> }[];
    pairs: { id: string; title: string; kind: 'cross-partner' | 'within-person'; wantedQuestionId: string; providedQuestionId: string; commonAdvice: string; differentAdvice: string; optionAdvice?: Record<string, string> }[];
    discussionPrompts: Record<string, string>;
  };
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
    if (!question.evidence.sourceIds.length) errors.push(`缺少研究來源：${question.id}`);
    for (const sourceId of question.evidence.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`找不到研究來源：${question.id}/${sourceId}`);
    }
    if (!question.evidence.note.trim()) errors.push(`缺少依據說明：${question.id}`);
  }
  if (quiz.status === 'ready' && !quiz.questions.length) errors.push('正式測驗不能沒有題目');
  if (quiz.scoring) {
    const scoring = quiz.scoring;
    if (scoring.kind !== 'pvqrr-centered-distance' || scoring.version !== '1.0.0') errors.push('不支援的計分版本');
    const ids = scoring.values.flatMap((value) => value.questionIds);
    if (quiz.questions.length !== 57 || scoring.values.length !== 19 || scoring.values.some((value) => value.questionIds.length !== 3 || !value.label.trim()) || new Set(ids).size !== 57 || ids.some((id) => !questionIds.has(id)) || new Set(scoring.values.map((value) => value.id)).size !== 19) errors.push('計分對應需完整涵蓋 57 題與 19 類');
    for (const question of quiz.questions) {
      if (question.options.length !== 6 || question.options.some((option, index) => scoring.optionValues[option.id] !== index + 1)) errors.push(`量表選項數值不完整：${question.id}`);
    }
  }
  if (quiz.analysis) {
    const rule = quiz.analysis;
    if (rule.kind !== 'long-distance-paired' || rule.version !== '1.0.0' || quiz.scoring) errors.push('不支援的雙人分析版本');
    const allOptions = new Set(quiz.questions.flatMap((q) => q.options.map((o) => o.id)));
    if (new Set(rule.excludedOptionIds).size !== rule.excludedOptionIds.length || rule.excludedOptionIds.some((id) => !allOptions.has(id)) || !rule.excludedOptionIds.includes('prefer-not-share')) errors.push('雙人分析排除選項不完整');
    if (new Set(rule.comparisons.map((item) => item.questionId)).size !== rule.comparisons.length || new Set(rule.pairs.map((item) => item.id)).size !== rule.pairs.length) errors.push('雙人分析規則 ID 重複');
    for (const item of [...rule.comparisons, ...rule.pairs]) {
      if (!item.title.trim() || !item.commonAdvice.trim() || !item.differentAdvice.trim()) errors.push('雙人分析缺少建議內容');
      const ids = 'questionId' in item ? [item.questionId] : [item.wantedQuestionId, item.providedQuestionId];
      if (ids.some((id) => !questionIds.has(id)) || new Set(ids).size !== ids.length) errors.push('雙人分析找不到題目或配對題目重複');
      if ('kind' in item && !['cross-partner', 'within-person'].includes(item.kind)) errors.push('雙人分析配對方向不正確');
      const wanted = quiz.questions.find((q) => q.id === ids[0]);
      if (item.optionAdvice && Object.entries(item.optionAdvice).some(([id, text]) => !wanted?.options.some((o) => o.id === id) || rule.excludedOptionIds.includes(id) || !text.trim())) errors.push('雙人分析選項建議不正確');
    }
    if (quiz.questions.some((q) => !rule.discussionPrompts[q.id]?.trim()) || Object.keys(rule.discussionPrompts).some((id) => !questionIds.has(id))) errors.push('雙人分析討論提示不完整');
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
