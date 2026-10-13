import bank from '../../docs/quizzes/daily-values.json' with { type: 'json' };
import type { QuizDefinition, Question } from '../domain/quiz.ts';

const special = [
  { id: 'other', label: '其他更接近我的做法／理由' },
  { id: 'conditional', label: '要補充條件才能回答' },
  { id: 'uncertain', label: '尚未想清楚' },
  { id: 'not-applicable', label: '這個情境不適用' },
  { id: 'not-shared', label: '暫不分享整個情境' },
];
const scenes = bank.scenes.map((scene) => ({ ...scene, mode: scene.mode as 'personal' | 'joint', questionIds: ['choice','reason','importance','accept'].map((step)=>`${scene.id}-${step}`) }));
const questions: Question[] = scenes.flatMap((scene) => {
  // 所有非空子集合各有明確 ID；這是複選的資料格式，不是二進位計分。
  const combinations = Array.from({length:15},(_,index)=>{
    const selection = scene.choices.filter((_,position)=>(index+1)&(1<<position)).map((option)=>option.id);
    return { id:`set-${selection.join('')}`, label:selection.map((id)=>scene.choices.find((o)=>o.id===id)!.label).join('；'), selection };
  });
  const prompts = [scene.context,'你目前最在意哪個理由？','採用你希望的安排，對你有多重要？',scene.mode === 'personal' ? '如果作選擇的是對方，條件相同，你能接受對方選哪些做法？' : '條件相同，哪些安排你目前也能接受？'];
  const options = [scene.choices,scene.reasons,[{id:'very',label:'非常重要'},{id:'some',label:'有些重要'},{id:'little',label:'不太重要'}],[...combinations,{id:'none',label:'目前沒有能直接接受的列出安排'}]];
  return scene.questionIds.map((id,index)=>({id, dimension:scene.title, prompt:prompts[index], help:index===3 ? '可複選。包含自己的首選也要明示勾選；回答不等於承諾。' : '選目前最優先的一項。這是情境下的想法，不代表你已經這樣做。',options:[...options[index],...(index===2 ? special.filter((o)=>!['other','conditional'].includes(o.id)) : index===3 ? special.filter((o)=>o.id!=='other') : special)], evidence:{status:'self-authored' as const, sourceIds:scene.sourceIds,note:scene.note},discussion:scene.discussion}));
});
export const dailyValuesQuiz: QuizDefinition = {
  id:bank.id,version:bank.version,title:'日常三觀探索',subtitle:'一起過日子，你們會怎麼選？',
  description:'從旅行預算、工作與相處，到親友、分工和資訊分享。八個生活情境，看看各自的理由，也找找能接受的安排。',
  audience:'交往前探索・交往中的兩人',status:'ready',theme:'sand',motif:'balance',
  dimensions:scenes.map((s)=>s.title),questions,sources:bank.sources,
  dailyValues:{kind:'daily-values',version:'1.0.0',scenes},
  evidenceSummary:'本站原創生活情境探索，研究提供議題與概念背景。題目、結論與交流提案尚未完成測量或效果驗證；不提供契合分數、人格分類或關係成敗判定。',
  instructions:'八個情境，各四步，共32個作答步驟。直接回答本情境下的想法，不猜對方的答案。做法、理由、重要程度與接受範圍分開；工作題問你能接受對方的選擇。可選尚未想清楚、不適用或暫不分享整個情境。雙方提交才揭曉願意分享的答案；回答不等於承諾。',
};
