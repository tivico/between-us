// 僅前端試讀匯入；不要加入共用 quizzes 陣列或後端回合題庫。
import bank from '../../docs/quizzes/core-values-pvqrr.json';
import type { TrialDefinition } from '../domain/trial';

export function createCoreValuesTrial(candidate: typeof bank): TrialDefinition {
  const fail = (reason: string): never => { throw new Error(`核心價值試讀資料不完整：${reason}`); };
  if (candidate.status !== 'candidate' || !candidate.version.trim()) fail('需有候選狀態與版本');
  if (!candidate.instructions.trim()) fail('缺少中性作答引導');
  if (candidate.items.length !== 57) fail('需保留完整 57 題');
  if (new Set(candidate.items.map((item) => item.id)).size !== 57) fail('題目 ID 重複');
  candidate.items.forEach((item, index) => {
    if (item.sourceItemNumber !== index + 1) fail('原題序不完整');
    if (!item.id.trim() || !item.prompt?.trim()) fail(`第 ${index + 1} 題缺少中性題幹`);
    // 「其他人」「他人」是一般詞彙，不是帶性別的人物代名詞。
    if (/她|(?<!其)他(?!人)/u.test(item.prompt)) fail(`第 ${index + 1} 題仍使用性別代名詞`);
  });
  if (candidate.responseOptions.length !== 6 || new Set(candidate.responseOptions.map((item) => item.id)).size !== 6) fail('需有六個獨立選項');
  candidate.responseOptions.forEach((option, index) => {
    if (!option.id.trim() || !option.label.trim() || option.value !== index + 1) fail('原選項或順序不完整');
  });
  return {
    id: 'core-values-pvqrr-trial', version: candidate.version, title: '核心價值探索',
    instructions: candidate.instructions,
    // 此處只選取中性 prompt，不根據性別讀取 portraits，也不帶入計分值。
    questions: candidate.items.map((item) => ({ id: item.id, number: item.sourceItemNumber, prompt: item.prompt })),
    options: candidate.responseOptions.map(({ id, label }) => ({ id, label })),
    sources: [
      { title: 'PVQ-RR 原工具研究', url: candidate.sourceArticle, description: '提供完整人物描述工具的研究依據。本產品的繁體中性措辭仍在審查，尚未完成其測量驗證。' },
      { title: '中性人物稱呼的研究先例', url: candidate.adaptation.precedent.url, description: '英文研究曾採中性代名詞；不等同於本產品繁體改寫版或伴侶比較已經驗證。' },
    ],
  };
}

export const coreValuesTrial = createCoreValuesTrial(bank);
