import bank from '../../docs/quizzes/money-life-candidate.json' with { type: 'json' };
import type { QuizDefinition, ResponseKind, EvidenceStatus, MoneyPerspective } from '../domain/quiz.ts';

// 候選 0.1.0 題幹／選項不改；施測工具與描述性規則各自版本化。
export const moneyLifeQuiz: QuizDefinition = {
  id: 'money-life', version: '0.2.0', title: bank.title, subtitle: bank.subtitle,
  description: '各自回答 12 題，了解共同花費與生活安排的偏好、目前條件及願意的範圍，再一起確認期待與做法。',
  audience: '交往前探索・交往中的兩人', status: 'ready', theme: 'sand', motif: 'balance',
  dimensions: bank.sections.map((s) => s.title),
  instructions: bank.instructions.replace('候選接入提案為雙方完成後看可分享選項', '雙方完成後看可分享選項'),
  evidenceSummary: '12 題為本站原創探索，三段是內容分類，不是量表。研究提供概念與解讀限制，中文理解、測量與提案效果尚未驗證；不提供契合、財務能力或關係成功率分數。',
  sources: bank.sources.map((s) => ({ id: s.id, title: s.title, authors: s.authors, year: s.year, url: s.url, scope: `${s.support} ${s.limitations}` })),
  questions: bank.questions.map((q) => ({
    id: q.id, dimension: bank.sections.find((s) => s.id === q.sectionId)!.title,
    prompt: q.prompt, help: q.help, discussion: q.discussion, moneyPerspective: q.perspective as MoneyPerspective,
    options: q.options.map((o) => ({ id: o.id, label: o.kind === 'not-shared' ? '未分享' : o.label, kind: o.kind as ResponseKind })),
    evidence: { ...q.evidence, status: q.evidence.status as EvidenceStatus },
  })),
  moneyLife: {
    kind: 'money-life-descriptive', version: '1.0.0',
    preferenceQuestionIds: bank.resultPlan.preferenceQuestionIds,
    processQuestionIds: bank.resultPlan.processQuestionIds,
    constraintQuestionIds: bank.resultPlan.constraintQuestionIds,
    boundaryQuestionIds: bank.resultPlan.boundaryQuestionIds,
    preferencePolicy: bank.resultPlan.preferencePolicy, processPolicy: bank.resultPlan.processPolicy,
    conditionPolicy: bank.resultPlan.conditionPolicy, crossPairPolicy: bank.resultPlan.crossPairPolicy,
    crossPairs: bank.resultPlan.crossPairs.map((p) => ({ ...p, adviceByWanted: Object.fromEntries(Object.entries(p.adviceByWanted)) })),
  },
};
