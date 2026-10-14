import manifest from './quiz-catalog.json';
import type { QuizDefinition } from '../domain/quiz';
// 由原registry生成的公開摘要；不含題目、結果提案或私人資料，不手動維護第二份題庫。
export type QuizSummary = Pick<QuizDefinition, 'id'|'version'|'title'|'subtitle'|'audience'|'status'|'theme'|'motif'> & {
  questionCount: number; dailyValues: boolean; scoring: boolean; moneyLife: boolean; communication: boolean; analysis: boolean;
};
export const catalog = manifest.topics as QuizSummary[];
export const roundSummaries = manifest.rounds as QuizSummary[];
export const articleSummaries = manifest.articles;
