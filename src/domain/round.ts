import type { QuizDefinition } from './quiz';
import type { ValueComparison } from './compatibility';
import type { DistanceAnalysis } from './long-distance';

export interface RoundStatus {
  id: string;
  quiz: QuizDefinition;
  createdAt: string;
  state: 'answering' | 'waiting' | 'unlocked';
  own: { nickname: string; slot: 'A' | 'B'; answers: Record<string, string>; revision: number; submittedAt: string | null };
  peer: { nickname: string; submitted: boolean } | null;
  invitationToken: string | null;
}
export interface RoundResults {
  quiz: QuizDefinition;
  createdAt: string;
  participants: { slot: 'A' | 'B'; nickname: string; answers: Record<string, string>; submittedAt: string }[];
  comparison?: ValueComparison;
  pairAnalysis?: DistanceAnalysis;
}
export interface InvitationPreview { id: string; hostName: string; title: string; questionCount: number; claimed: boolean; hasValueScore?: boolean; hasPairAnalysis?: boolean }
