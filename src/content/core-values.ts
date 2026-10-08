import bank from '../../docs/quizzes/core-values-pvqrr.json' with { type: 'json' };
import { createCoreValuesTrial } from './core-values-trial.ts';
import type { QuizDefinition } from '../domain/quiz.ts';

const content = createCoreValuesTrial(bank);
for (const value of bank.values) {
  if (value.itemNumbers.some((number) => bank.items[number - 1]?.valueId !== value.id)) throw new Error('原計分題號與價值類別不一致');
}
export const coreValuesQuiz: QuizDefinition = {
  id: 'core-values', version: '0.3.0', title: '三觀與核心價值',
  subtitle: '認識你心裡，重要的事。',
  description: '從 57 個人物描述，探索你重視的事。各自回答，邀請對方，再一起看見相近的方向與值得聊的差異。',
  audience: '交往前探索・交往中的伴侶', status: 'ready', theme: 'sage', motif: 'arches',
  instructions: content.instructions,
  dimensions: bank.values.map((value) => value.editorialLabel),
  questions: bank.items.map((item) => ({
    id: item.id, dimension: bank.values.find((value) => value.id === item.valueId)!.editorialLabel,
    prompt: item.prompt, help: '這個人有多像你？請以你自己的想法作答。',
    options: content.options,
    evidence: { status: 'research-informed', sourceIds: ['pvqrr-2022'], note: '依 PVQ-RR 繁體修訂版改為性別中性稱呼；原題序、六段選項與 19 類計分對應保留。此中文改寫與雙人相近度尚未完成測量驗證。' },
  })),
  sources: [
    { id: 'pvqrr-2022', title: 'Measuring the Refined Theory of Individual Values in 49 Cultural Groups', authors: 'Schwartz & Cieciuch', year: 2022, url: bank.sourceArticle, scope: '支持原 PVQ-RR 的 57 題與 19 類價值測量；不等於本中文改寫或雙人相近度已驗證。' },
    { id: 'pvqrr-scoring', title: 'PVQ-RR 計分與分析說明', authors: 'Shalom H. Schwartz', year: 2020, url: bank.sourceRepository, scope: '原計分表提供 19 類各三題、個人平均 MRAT 與中心化方法；雙人 0–100 換算由本網站另行設計。' },
    { id: 'neutral-2023', title: bank.adaptation.precedent.title, authors: bank.adaptation.precedent.authors, year: 2023, url: bank.adaptation.precedent.url, scope: bank.adaptation.precedent.scope },
  ],
  evidenceSummary: '採完整 PVQ-RR 57 題與 19 類對應，使用不限定性別的人物描述。依原計分取得個人相對重視程度，再用本站的探索性公式比較雙方；分數不是關係成功率。',
  scoring: {
    kind: 'pvqrr-centered-distance', version: '1.0.0',
    optionValues: Object.fromEntries(bank.responseOptions.map((option) => [option.id, option.value])),
    values: bank.values.map((value) => ({ id: value.id, label: value.editorialLabel, questionIds: value.itemNumbers.map((number) => bank.items[number - 1].id) })),
  },
};
