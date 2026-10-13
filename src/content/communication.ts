import bank from '../../docs/quizzes/communication-candidate.json' with { type: 'json' };
import type { QuizDefinition, ResponseKind, EvidenceStatus } from '../domain/quiz.ts';

export const communicationQuiz: QuizDefinition = {
  id: 'communication', version: '0.3.0', title: bank.title, subtitle: bank.subtitle,
  description: '各自回答 24 題，了解提出需求、回應、暫停與修復時，自己的做法與希望收到的方式。雙方完成後，一起看雙向配對與具體聊法。',
  audience: '交往前探索・交往中的兩人', status: 'ready', theme: 'lavender', motif: 'conversation',
  dimensions: bank.sections.map((section) => section.title), instructions: bank.instructions,
  evidenceSummary: '24 題為本站原創探索，四段是內容分類，不是四面向量表。研究支持概念，題庫、中文理解與提案效果尚未驗證；不提供契合分數或溝通人格判定。',
  sources: bank.sources.map((source) => ({ id: source.id, title: source.title, authors: source.authors, year: source.year, url: source.url, scope: `${source.support} ${source.limits}` })),
  questions: bank.questions.map((question) => ({
    id: question.id, dimension: bank.sections.find((section) => section.id === question.sectionId)!.title,
    prompt: question.prompt, help: question.help, discussion: question.discussion,
    options: question.options.map((option) => ({ id: option.id, label: option.kind === 'not-shared' ? '未分享' : option.label, kind: option.kind as ResponseKind, ...('meaningId' in option ? { meaningId: option.meaningId } : {}) })),
    evidence: { ...question.evidence, status: question.evidence.status as EvidenceStatus },
  })),
  communication: { kind: 'communication-cross-partner', version: '1.0.0', sections: bank.sections, pairs: bank.resultPlan.pairs.map((pair) => ({ ...pair, providerSuggestions: Object.fromEntries(Object.entries(pair.providerSuggestions)) })) },
};
