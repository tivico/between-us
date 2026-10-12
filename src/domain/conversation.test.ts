import { describe, expect, it } from 'vitest';
import draft from '../../docs/quizzes/getting-to-know-you.md?raw';
import { questionnaires } from '../content/questionnaires';
import { coreValuesExample } from '../content/quizzes';
import { validateQuiz } from './quiz';
import { compareConversation } from './conversation';

describe('四題問答內容與描述性整理', () => {
  it('八組各四題，完整轉錄原題與四個主要選項，不把原創題冒充量表', () => {
    const original = [...draft.matchAll(/^### (\d{2}) `(know-[a-z-]+)`\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
    expect(questionnaires).toHaveLength(8);
    const questions = questionnaires.flatMap((quiz) => { expect(validateQuiz(quiz)).toEqual([]); expect(quiz.questions).toHaveLength(4); expect(quiz.scoring).toBeUndefined(); return quiz.questions; });
    expect(new Set(questions.map((q) => q.id)).size).toBe(32);
    questions.forEach((question, index) => {
      expect(question.id).toBe(original[index][2]);
      expect(question.prompt).toBe(/^\*\*(.+)\*\*\r?$/m.exec(original[index][3])?.[1]);
      expect(question.options.filter((o) => o.kind === 'choice').map((o) => o.label)).toEqual([...original[index][3].matchAll(/^- [A-D]．(.+)\r?$/gm)].map((m) => m[1].trim()));
      expect(question.discussion).toBe(/^討論提示：(.+)\r?$/m.exec(original[index][3])?.[1].trim());
      expect(question.evidence.status).toBe('self-authored');
    });
  });
  it('只依本輪快照產生建議，角色互換也互換對方需求，不提供總分', () => {
    const quiz = structuredClone(questionnaires.find((q) => q.id === 'know-care')!);
    const a = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
    const b = { ...a, [quiz.questions[0].id]: quiz.questions[0].options[1].id };
    const result = compareConversation(quiz, a, b)!;
    expect(result.items[0].status).toBe('different');
    expect(result.items[0].forA).toContain('整理下一步');
    expect(result.items[0].forB).toContain('先聽');
    expect(result).not.toHaveProperty('score');
    expect(result.items[1].status).toBe('common');
    const reversed = compareConversation(quiz, b, a)!;
    expect(reversed.items[0].forA).toBe(result.items[0].forB);
    expect(reversed.items[0].forB).toBe(result.items[0].forA);
    quiz.questions[0].options[1].guidance = '快照中的另一則提案';
    expect(compareConversation(quiz, a, b)?.items[0].forA).toBe('快照中的另一則提案');
    expect(compareConversation(coreValuesExample, {}, {})).toBeUndefined();
  });
  it('所有特殊狀態即使兩人相同也不算共同點，不產生針對人的建議', () => {
    for (const quiz of questionnaires) for (const option of quiz.questions[0].options.filter((o) => o.kind !== 'choice')) {
      const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id]));
      answers[quiz.questions[0].id] = option.id;
      const item = compareConversation(quiz, answers, answers)!.items[0];
      expect(item.status).toBe('context');
      expect([item.forA, item.forB, item.together]).toEqual([null, null, null]);
    }
  });
  it('核心價值不能插入問答特殊選項；問答也不能悄悄變成八題回合', () => {
    const quiz = structuredClone(questionnaires[0]);
    quiz.questions.push(...structuredClone(quiz.questions));
    expect(validateQuiz(quiz)).toContain('雙人問答每輪需四題且不能附量表計分');
    const old = structuredClone(coreValuesExample);
    old.questions[0].options[0].kind = 'not-shared';
    expect(validateQuiz(old)).toContain('特殊問答狀態不能加入既有測驗：values-work-choice');
  });
});
