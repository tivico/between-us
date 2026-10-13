export type TopicStatus = 'draft' | 'planned' | 'ready';
export type EvidenceStatus = 'self-authored' | 'research-informed' | 'validated';
export type ResponseKind = 'choice' | 'other' | 'varies' | 'uncertain' | 'not-applicable' | 'not-experienced' | 'not-shared';
export type Theme = 'sage' | 'clay' | 'sand' | 'lavender' | 'blue';

export interface ValueFeedbackConfig {
  kind: 'core-values-conversation';
  version: '1.0.0';
  sourceId: string;
  excludedValueIds: string[];
  perspectives: { id: string; questionIds: string[]; meaning: string; title: string; scenario: string; question: string; followUp: string }[];
}

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
  options: { id: string; label: string; kind?: ResponseKind; guidance?: string; selection?: string[] }[];
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
  feedback?: ValueFeedbackConfig;
  dailyValues?: { kind: 'daily-values'; version: '1.0.0'; scenes: { id: string; title: string; context: string; mode: 'joint' | 'personal'; questionIds: string[]; discussion: string }[] };
  questionnaire?: { kind: 'four-question-conversation'; version: '1.0.0'; groupId: string; depth: '輕鬆' | '深入' | '較私密' };
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
    if (!question.evidence.sourceIds.length && question.evidence.status !== 'self-authored') errors.push(`缺少研究來源：${question.id}`);
    for (const sourceId of question.evidence.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`找不到研究來源：${question.id}/${sourceId}`);
    }
    if (!question.evidence.note.trim()) errors.push(`缺少依據說明：${question.id}`);
  }
  if (quiz.status === 'ready' && !quiz.questions.length) errors.push('正式測驗不能沒有題目');
  if (quiz.dailyValues) {
    const config = quiz.dailyValues;
    const ids = config.scenes.flatMap((s)=>s.questionIds);
    if (config.kind !== 'daily-values' || config.version !== '1.0.0' || config.scenes.length !== 8 || quiz.questions.length !== 32 || quiz.scoring || quiz.analysis || quiz.questionnaire || quiz.feedback || new Set(ids).size !== 32 || ids.some((id)=>!questionIds.has(id))) errors.push('日常三觀契約不完整');
    for (const scene of config.scenes) {
      if (!['joint','personal'].includes(scene.mode) || scene.questionIds.length !== 4 || !scene.context.trim() || !scene.discussion.trim() || scene.questionIds.some((id,index)=>id!==`${scene.id}-${['choice','reason','importance','accept'][index]}`)) errors.push('日常情境欄位不完整');
      for (const id of scene.questionIds) if (!quiz.questions.find((q)=>q.id===id)?.options.some((o)=>o.id==='not-shared')) errors.push('日常情境缺少未分享狀態');
      const accept=quiz.questions.find((q)=>q.id===scene.questionIds[3]);
      const sets=accept?.options.filter((o)=>o.selection) ?? [];
      const choices=quiz.questions.find((q)=>q.id===scene.questionIds[0])?.options.slice(0,4).map((o)=>o.id) ?? [];
      if (sets.length!==15 || sets.some((o)=>!o.selection?.length || new Set(o.selection).size!==o.selection.length || o.selection.some((id)=>!choices.includes(id)) || o.id!==`set-${o.selection.join('')}`) || new Set(sets.map((o)=>o.id)).size!==15) errors.push('日常接受範圍契約不完整');
    }
  }
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
  if (quiz.feedback) {
    const feedback = quiz.feedback;
    const values = quiz.scoring?.values ?? [];
    const ids = [...feedback.excludedValueIds, ...feedback.perspectives.map((item) => item.id)];
    if (!quiz.scoring || feedback.kind !== 'core-values-conversation' || feedback.version !== '1.0.0' || !sourceIds.has(feedback.sourceId) || feedback.excludedValueIds.length !== 1 || feedback.excludedValueIds[0] !== 'face' || ids.length !== 19 || new Set(ids).size !== 19 || ids.some((id) => !values.some((value) => value.id === id))) errors.push('核心價值回饋契約不完整');
    for (const item of feedback.perspectives) {
      const value = values.find((value) => value.id === item.id);
      if (!value || item.questionIds.length !== 3 || new Set(item.questionIds).size !== 3 || item.questionIds.some((id) => !value.questionIds.includes(id)) || [item.meaning, item.title, item.scenario, item.question, item.followUp].some((text) => !text.trim())) errors.push(`核心價值回饋缺少內容或題號不符：${item.id}`);
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
