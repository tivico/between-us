import type { QuizDefinition } from '../domain/quiz';

export const topicGuide = [
  { title: '今天想輕鬆聊聊', note: '每輪一組四題，不必完成全部八組。', href: '#/questions', action: '選一組雙人問答' },
  { title: '想了解生活安排', note: '12 題，分開看願意範圍、條件與偏好。', href: '#/topics/money-life', action: '看看生活探索' },
  { title: '想談彼此的期待', note: '24 題，看看希望收到的回應與各自做法。', href: '#/topics/communication', action: '看看溝通探索' },
  { title: '想聊生活中的取捨', note: '八情境、32 步，探索理由與可接受安排。', href: '#/topics/daily-values', action: '看看日常三觀' },
  { title: '正在遠距，想靠近一點', note: '24 題，談日常回應、支持與見面條件。', href: '#/topics/long-distance', action: '看看遠距探索' },
  { title: '想深入了解重視的事', note: '57 題，探索各自相對優先與共同方向。', href: '#/topics/core-values', action: '看看核心價值' },
];
export function topicDepth(quiz: QuizDefinition): string {
  return quiz.questionnaire ? '輕量起點・每次四題' : quiz.scoring ? '深入探索・57 題' : quiz.dailyValues ? '生活情境探索・八情境各四步' : '聚焦主題探索';
}
export function topicOutcome(quiz: QuizDefinition): string {
  return quiz.scoring ? '各自優先、共同方向、差異與聊天入口' : quiz.moneyLife ? '願意範圍、現實條件、生活偏好與期待／做法' : quiz.communication ? '雙向期待／做法配對與可選討論提案' : quiz.dailyValues ? '選擇理由、重要程度與明示接受範圍' : quiz.analysis ? '遠距共同點、差異與各自條件' : quiz.questionnaire ? '本組共同選擇、不同想法與聊天提案' : '查看主題方向';
}
