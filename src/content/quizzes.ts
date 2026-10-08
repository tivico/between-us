import { validateQuiz, type QuizDefinition, type ResearchSource } from '../domain/quiz.ts';

const valuesSource: ResearchSource = {
  id: 'schwartz-2012',
  title: 'An Overview of the Schwartz Theory of Basic Values',
  authors: 'Shalom H. Schwartz',
  year: 2012,
  url: 'https://scholarworks.gvsu.edu/orpc/vol2/iss1/11/',
  scope: '支持基本價值與價值取捨的理論方向。本頁草題為自編情境，並非 PVQ 原題或已驗證的中文版量表。',
};

export const quizzes: QuizDefinition[] = [
  {
    id: 'core-values', version: '0.1.0', title: '三觀與核心價值', subtitle: '認識你心裡，重要的事。',
    description: '當自由、穩定、成就與關懷需要取捨，你會怎麼選？從生活裡的選擇，開啟關於彼此價值的對話。',
    audience: '交往前探索・交往中的伴侶', status: 'draft', theme: 'sage', motif: 'arches',
    dimensions: ['自主與穩定', '成就與生活', '關懷與公平'],
    evidenceSummary: '以 Schwartz 基本人類價值理論作為探索方向。目前僅有 3 題介面示例；量表選用、中文版與使用條件仍待確認，不提供正式計分。',
    sources: [valuesSource],
    questions: [
      {
        id: 'values-work-choice', dimension: '自主與穩定',
        prompt: '假設收入都足以維持生活，選工作時，你最先考量什麼？',
        help: '選最接近你目前想法的一項。這裡沒有標準答案。',
        options: [
          { id: 'autonomy', label: '能自主決定做事的方法' },
          { id: 'security', label: '工作與收入的穩定程度' },
          { id: 'growth', label: '接觸新事物與挑戰的機會' },
          { id: 'uncertain', label: '目前還無法決定' },
        ],
        evidence: { status: 'research-informed', sourceIds: ['schwartz-2012'], note: '依自主、安全與刺激等價值概念設計；自編、未驗證，不可直接換算成量表分數。' },
      },
      {
        id: 'values-free-evening', dimension: '成就與生活',
        prompt: '最近兩週，如果多出一個沒有安排的晚上，你通常會優先做什麼？',
        help: '回答實際傾向，而不是你覺得應該選的答案。',
        options: [
          { id: 'achievement', label: '推進自己重視的工作或學習目標' },
          { id: 'enjoyment', label: '休息，或做讓自己享受的事' },
          { id: 'connection', label: '陪伴對自己重要的人' },
          { id: 'varies', label: '沒有固定傾向，視當天情況而定' },
        ],
        evidence: { status: 'research-informed', sourceIds: ['schwartz-2012'], note: '探索成就、享受與關懷的情境選擇；也會受疲勞與生活條件影響，不能單題推斷價值高低。' },
      },
      {
        id: 'values-helping', dimension: '關懷與公平',
        prompt: '親近的人提出一項會占用你休息時間的請求，你通常先考量什麼？',
        help: '這只是了解取捨的起點；實際情境可能改變你的選擇。',
        options: [
          { id: 'need', label: '對方有多需要這次幫忙' },
          { id: 'capacity', label: '自己目前能負擔多少' },
          { id: 'fairness', label: '彼此長期的付出是否公平' },
          { id: 'uncertain', label: '需要知道更多情況才能決定' },
        ],
        evidence: { status: 'research-informed', sourceIds: ['schwartz-2012'], note: '以關懷與自主的價值取捨作為討論方向；公平選項為情境延伸，未經測量驗證。' },
      },
    ],
  },
  {
    id: 'long-distance', version: '0.1.0', title: '遠距，也靠近', subtitle: '讓看不見的日常，被理解。',
    description: '聊聊聯絡需求、忙碌時的回應與見面期待，補上距離之間那些不容易自然認識的事。',
    audience: '遠距戀愛・準備開始遠距的伴侶', status: 'planned', theme: 'clay', motif: 'distance',
    dimensions: ['日常分享', '回應與支持', '見面與未來'], questions: [],
    evidenceSummary: '已整理遠距自我揭露、理想化與回應性研究方向；題目、使用條件與結果規則尚待設計。',
    sources: [
      { id: 'jiang-hancock-2013', title: 'Absence Makes the Communication Grow Fonder', authors: 'Crystal Jiang & Jeffrey T. Hancock', year: 2013, url: 'https://academic.oup.com/joc/article-abstract/63/3/556/4086003', scope: '研究遠距溝通中的自我揭露、理想化與親密；不代表遠距必然缺乏了解。' },
      { id: 'stafford-2010', title: 'Geographic Distance and Communication During Courtship', authors: 'Laura Stafford', year: 2010, url: 'https://journals.sagepub.com/doi/10.1177/0093650209356390', scope: '提供議題迴避與選擇性正面呈現的研究方向。' },
      { id: 'holtzman-2021', title: 'Long-distance texting: Text messaging is linked with higher relationship satisfaction in long-distance relationships', authors: 'Susan Holtzman et al.', year: 2021, url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8669216/', scope: '聯絡頻率、感受到的回應性與滿意度的關聯研究；不能作為因果或最佳頻率結論。' },
    ],
  },
  {
    id: 'communication', version: '0.1.0', title: '好好說，也好好聽', subtitle: '不同的表達，也能找到交會。',
    description: '探索情緒怎麼表達、誤會怎麼處理，以及需要暫停時，怎麼讓對方知道。',
    audience: '想更了解彼此溝通方式的伴侶', status: 'planned', theme: 'lavender', motif: 'conversation',
    dimensions: ['表達需求', '衝突與暫停', '修復方式'], questions: [], sources: [],
    evidenceSummary: '主題規劃中，尚未選定研究與量表。',
  },
  {
    id: 'money-life', version: '0.1.0', title: '一起生活的選擇', subtitle: '聊聊金錢，也聊聊理想生活。',
    description: '從消費、儲蓄到共同支出，認識你們對生活安排的不同期待。',
    audience: '交往前探索・交往中的伴侶', status: 'planned', theme: 'sand', motif: 'balance',
    dimensions: ['消費與儲蓄', '共同支出', '生活優先順序'], questions: [], sources: [],
    evidenceSummary: '主題規劃中，尚未選定研究與量表。',
  },
  {
    id: 'space-boundaries', version: '0.1.0', title: '靠近，也保留自己', subtitle: '陪伴與空間，都有自己的形狀。',
    description: '認識相處、獨處與分享的界線，找到讓兩個人都自在的距離。',
    audience: '交往前探索・交往中的伴侶', status: 'planned', theme: 'blue', motif: 'space',
    dimensions: ['陪伴與獨處', '資訊分享', '人際界線'], questions: [], sources: [],
    evidenceSummary: '主題規劃中，尚未選定研究與量表。',
  },
];

const ids = new Set<string>();
for (const quiz of quizzes) {
  const errors = validateQuiz(quiz);
  if (ids.has(quiz.id)) errors.push(`測驗 ID 重複：${quiz.id}`);
  ids.add(quiz.id);
  if (errors.length) throw new Error(`${quiz.id}: ${errors.join('；')}`);
}

export function getQuiz(id: string): QuizDefinition | undefined {
  return quizzes.find((quiz) => quiz.id === id);
}
