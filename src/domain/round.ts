import type { QuizDefinition } from './quiz';
import type { ValueComparison } from './compatibility';
import type { ConversationComparison } from './conversation';
import type { DistanceAnalysis } from './long-distance';
import type { ValueFeedback } from './value-feedback';
import type { DailyComparison } from './daily-values';
import type { CommunicationAnalysis } from './communication';
import type { MoneyLifeAnalysis } from './money-life';
import type { ResultOpening } from './result-opening';

export interface RoundStatus {
  id: string;
  quiz: QuizDefinition;
  createdAt: string;
  expiresAt: string | null;
  state: 'answering' | 'waiting' | 'unlocked' | 'closed';
  own: { nickname: string; slot: 'A' | 'B'; answers: Record<string, string>; revision: number; submittedAt: string | null };
  peer: { nickname: string; submitted: boolean } | null;
  invitationToken: string | null;
}
export interface RoundResults {
  quiz: QuizDefinition;
  createdAt: string;
  participants: { slot: 'A' | 'B'; nickname: string; answers: Record<string, string>; submittedAt: string }[];
  comparison?: ValueComparison;
  valueFeedback?: ValueFeedback;
  conversation?: ConversationComparison;
  pairAnalysis?: DistanceAnalysis;
  dailyComparison?: DailyComparison;
  communicationAnalysis?: CommunicationAnalysis;
  moneyLifeAnalysis?: MoneyLifeAnalysis;
  resultOpening?: ResultOpening;
}
export interface InvitationPreview { expiresAt?: string | null; id: string; hostName: string; title: string; questionCount: number; claimed: boolean; hasValueScore?: boolean; isQuestionnaire?: boolean; hasPairAnalysis?: boolean; hasDailyValues?: boolean; hasCommunicationAnalysis?: boolean; hasMoneyLifeAnalysis?: boolean }
