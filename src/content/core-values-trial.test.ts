import { describe, expect, it } from 'vitest';
import bank from '../../docs/quizzes/core-values-pvqrr.json';
import { createCoreValuesTrial, coreValuesTrial } from './core-values-trial';
import { summarizeTrial } from '../domain/trial';
import { getQuiz } from './quizzes';

describe('核心價值內容試讀', () => {
  it('使用完整中性題幹，維持原序與六段選項，不將數值或原文分支帶進作答契約', () => {
    expect(coreValuesTrial.questions).toHaveLength(57);
    expect(coreValuesTrial.options).toHaveLength(6);
    expect(coreValuesTrial.questions.map((item) => item.prompt)).toEqual(bank.items.map((item) => item.prompt));
    expect(coreValuesTrial.questions[50].prompt).toBe('這個人重視從不使其他人生氣。');
    expect(coreValuesTrial.options[0]).not.toHaveProperty('value');
    expect(coreValuesTrial.questions[0]).not.toHaveProperty('portraits');
    expect(getQuiz('core-values')?.questions).toHaveLength(57);
    expect(getQuiz('core-values-example')?.questions).toHaveLength(3);
    expect(getQuiz(coreValuesTrial.id)).toBeUndefined();
  });
  it('拒絕缺少中性題幹或改回帶性別稱呼的候選資料，不回退到原文', () => {
    const missing = structuredClone(bank);
    missing.items[0].prompt = '';
    expect(() => createCoreValuesTrial(missing)).toThrow('缺少中性題幹');
    missing.items[0].prompt = missing.items[0].portraits.she;
    expect(() => createCoreValuesTrial(missing)).toThrow('性別代名詞');
  });
  it('拒絕刪題、破壞題序與反轉原選項', () => {
    const changed = structuredClone(bank);
    changed.items.pop();
    expect(() => createCoreValuesTrial(changed)).toThrow('完整 57 題');
    const order = structuredClone(bank);
    order.items.reverse();
    expect(() => createCoreValuesTrial(order)).toThrow('原題序');
    const options = structuredClone(bank);
    options.responseOptions.reverse();
    expect(() => createCoreValuesTrial(options)).toThrow('原選項');
  });
  it('跳過或無效選項仍是未答，不當成最低程度；只整理本人合法選項與標記', () => {
    const result = summarizeTrial(coreValuesTrial, { 'pvqrr-01': 'like', 'pvqrr-02': 'invalid', stranger: 'like' }, new Set(['pvqrr-02', 'stranger']));
    expect(result.answered).toBe(1);
    expect(result.unanswered).toBe(56);
    expect(result.flagged).toBe(1);
    expect(result.rows[0].answer).toBe('像我');
    expect(result.rows[1].answer).toBeUndefined();
    expect(result).not.toHaveProperty('score');
  });
});
