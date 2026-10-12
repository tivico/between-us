import { validateQuiz, type QuizDefinition } from './quiz.ts';
import type { AnalysisEvidence, AnalysisSlot } from './long-distance.ts';

export interface CommunicationFinding {
  id: string; pairId: string; sectionId: string; title: string;
  state: 'same' | 'different' | 'context'; wantedSlot: AnalysisSlot; providedSlot: AnalysisSlot;
  evidence: AnalysisEvidence[]; description: string; advice: string | null; discussion: string | null; sourceIds: string[];
}
export interface CommunicationAnalysis {
  kind: 'communication-cross-partner'; ruleVersion: '1.0.0'; findings: CommunicationFinding[];
  summaries: { sectionId: string; title: string; pairId: string | null }[];
}

// results 在授權且雙方提交後才呼叫；題目與提案全部讀取本輪 snapshot。
export function analyzeCommunication(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): CommunicationAnalysis | undefined {
  if (!quiz.communication) return undefined;
  if (validateQuiz(quiz).length) throw new Error('溝通分析快照不完整或版本不支援');
  for (const answers of [a, b]) {
    if (Object.keys(answers).length !== quiz.questions.length || quiz.questions.some((q) => !q.options.some((o) => o.id === answers[q.id]))) throw new Error('需完整合法答案才能分析');
  }
  return analyzeCommunicationV1(quiz, a, b);
}

// 保留 V1；未來演算法另加版本與分支，不能直接追改舊回合。
function analyzeCommunicationV1(quiz: QuizDefinition, a: Record<string, string>, b: Record<string, string>): CommunicationAnalysis {
  const rule = quiz.communication!;
  const answers = { A: a, B: b };
  const findings: CommunicationFinding[] = [];
  for (const pair of rule.pairs) {
    const wantedQuestion = quiz.questions.find((q) => q.id === pair.wantedQuestionId)!;
    const providedQuestion = quiz.questions.find((q) => q.id === pair.providedQuestionId)!;
    for (const wantedSlot of ['A', 'B'] as const) {
      const providedSlot = wantedSlot === 'A' ? 'B' : 'A';
      const wanted = wantedQuestion.options.find((o) => o.id === answers[wantedSlot][wantedQuestion.id])!;
      const provided = providedQuestion.options.find((o) => o.id === answers[providedSlot][providedQuestion.id])!;
      const state = wanted.kind !== 'choice' || provided.kind !== 'choice' ? 'context' : wanted.meaningId === provided.meaningId ? 'same' : 'different';
      findings.push({ id: `${pair.id}-${wantedSlot}`, pairId: pair.id, sectionId: pair.sectionId, title: pair.title, state, wantedSlot, providedSlot,
        evidence: [{ slot: wantedSlot, questionId: wantedQuestion.id, prompt: wantedQuestion.prompt, label: wanted.label, role: '希望收到的方式' }, { slot: providedSlot, questionId: providedQuestion.id, prompt: providedQuestion.prompt, label: provided.label, role: '自述最近的做法' }],
        description: state === 'context' ? '這個方向先保留各自情境，不判同類或不同，也不需要補充原因。' : state === 'same' ? pair.commonAdvice : pair.differentAdvice,
        advice: state === 'context' ? null : pair.providerSuggestions[wanted.id], discussion: state === 'context' ? null : pair.discussion,
        sourceIds: [...new Set([...wantedQuestion.evidence.sourceIds, ...providedQuestion.evidence.sourceIds])],
      });
    }
  }
  const summaries = rule.sections.map((section) => {
    const selected = findings.find((f) => f.sectionId === section.id && f.state === 'different') ?? findings.find((f) => f.sectionId === section.id && f.state === 'same');
    return { sectionId: section.id, title: section.title, pairId: selected?.pairId ?? null };
  });
  return { kind: rule.kind, ruleVersion: '1.0.0', findings, summaries };
}
