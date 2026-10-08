import { describe, expect, it } from 'vitest';
import { quizzes, coreValuesExample } from '../content/quizzes';
import { validateAnswer, validateQuiz, type QuizDefinition } from './quiz';

const draft = coreValuesExample;
function copy(): QuizDefinition { return structuredClone(draft); }

describe('測驗內容的完整性', () => {
  it('每個主題皆符合內容契約，並區分開放功能與測量驗證', () => {
    for (const quiz of quizzes) {
      expect(validateQuiz(quiz), quiz.id).toEqual([]);
      if (quiz.scoring) expect(quiz.questions.length).toBe(57);
      if (quiz.status === 'ready') expect(quiz.questions.length).toBeGreaterThan(0);
      expect(quiz.questions.every((question) => question.evidence.status === 'research-informed')).toBe(true);
    }
    expect(new Set(quizzes.map((quiz) => quiz.id)).size).toBe(quizzes.length);
  });
  it('阻止遺失文獻的草題靜默進入介面', () => {
    const quiz = copy();
    quiz.sources = [];
    expect(validateQuiz(quiz)).toContain('找不到研究來源：values-work-choice/schwartz-2012');
  });
  it('偵測重複的題目與選項，避免作答互相覆蓋', () => {
    const quiz = copy();
    quiz.questions.push(structuredClone(quiz.questions[0]));
    quiz.questions[0].options.push(structuredClone(quiz.questions[0].options[0]));
    expect(validateQuiz(quiz)).toContain('題目 ID 重複：values-work-choice');
    expect(validateQuiz(quiz)).toContain('選項 ID 重複：values-work-choice');
  });
  it('未知面向、空白選項與非 HTTPS 來源都會被指出', () => {
    const quiz = copy();
    quiz.questions[0].dimension = '不存在的面向';
    quiz.questions[0].options[0].label = ' ';
    quiz.sources[0].url = 'javascript:alert(1)';
    expect(validateQuiz(quiz)).toContain('未知面向：values-work-choice');
    expect(validateQuiz(quiz)).toContain('空白選項：values-work-choice');
    expect(validateQuiz(quiz)).toContain('研究來源須使用 HTTPS：schwartz-2012');
  });
  it('正式測驗不能是空殼', () => {
    const quiz = copy();
    quiz.questions = [];
    quiz.status = 'ready';
    expect(validateQuiz(quiz)).toContain('正式測驗不能沒有題目');
  });
});

describe('答案識別', () => {
  it('接受存在的題目／選項組合', () => {
    expect(validateAnswer(draft, { questionId: 'values-work-choice', optionId: 'autonomy' })).toBe(true);
  });
  it('拒絕其他題目的選項與不存在的題目', () => {
    expect(validateAnswer(draft, { questionId: 'values-work-choice', optionId: 'fairness' })).toBe(false);
    expect(validateAnswer(draft, { questionId: 'missing', optionId: 'autonomy' })).toBe(false);
  });
});
