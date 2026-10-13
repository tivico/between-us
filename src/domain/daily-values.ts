import type { QuizDefinition } from './quiz.ts';

export type DailyPerson = { choice: string; reason: string; importance: string; acceptance: string; important: boolean; state: 'shared' | 'not-shared' | 'not-applicable' };
export interface DailyComparison {
  version: '1.0.0';
  items: { sceneId: string; title: string; mode: 'joint' | 'personal'; a: DailyPerson; b: DailyPerson; common: boolean; sharedAccepted: string[] | null; directions: ('accepted' | 'not-listed' | 'context')[]; facts: string[]; importantDifference: boolean; discussion: string }[];
}

// 未分享／不適用是整個情境的狀態，在保存層取代四個欄位，不留可供對方回推的理由。
export function normalizeDailyAnswers(quiz: QuizDefinition, answers: Record<string,string>): Record<string,string> {
  if (!quiz.dailyValues) return answers;
  const next={...answers};
  for (const scene of quiz.dailyValues.scenes) {
    const state=scene.questionIds.some((id)=>next[id]==='not-shared') ? 'not-shared' : scene.questionIds.some((id)=>next[id]==='not-applicable') ? 'not-applicable' : undefined;
    if (state) for (const id of scene.questionIds) next[id]=state;
  }
  return next;
}

export function analyzeDailyValues(quiz: QuizDefinition, a: Record<string,string>, b: Record<string,string>): DailyComparison | undefined {
  const config=quiz.dailyValues;
  if (!config) return undefined;
  if (config.kind!=='daily-values' || config.version!=='1.0.0') throw Error('不支援的日常三觀規則版本');
  const first=normalizeDailyAnswers(quiz,a), second=normalizeDailyAnswers(quiz,b);
  const option=(id:string,answers:Record<string,string>)=>{
    const value=quiz.questions.find((q)=>q.id===id)?.options.find((o)=>o.id===answers[id]);
    if(!value) throw Error('日常三觀結果缺少有效答案');
    return value;
  };
  return {version:'1.0.0',items:config.scenes.map((scene)=>{
    const [choiceId,reasonId,importanceId,acceptId]=scene.questionIds;
    const person=(answers:Record<string,string>):DailyPerson=>{
      const state=answers[choiceId]==='not-shared'?'not-shared':answers[choiceId]==='not-applicable'?'not-applicable':'shared';
      return {state,choice:option(choiceId,answers).label,reason:option(reasonId,answers).label,importance:option(importanceId,answers).label,acceptance:option(acceptId,answers).label,important:state==='shared'&&answers[importanceId]==='very'};
    };
    const pa=person(first),pb=person(second);
    const concrete=(answers:Record<string,string>)=>['A','B','C','D'].includes(answers[choiceId]);
    const both=pa.state==='shared'&&pb.state==='shared'&&concrete(first)&&concrete(second);
    const selection=(answers:Record<string,string>)=>option(acceptId,answers).selection ?? (answers[acceptId]==='none'?[]:null);
    const sa=selection(first),sb=selection(second);
    const common=both&&first[choiceId]===second[choiceId];
    const sharedAccepted=both&&scene.mode==='joint'&&sa!==null&&sb!==null ? sa.filter((id)=>sb.includes(id)).map((id)=>quiz.questions.find((q)=>q.id===choiceId)!.options.find((o)=>o.id===id)!.label) : null;
    const direction=(choice:string,set:string[]|null):'accepted'|'not-listed'|'context'=>set===null?'context':set.includes(choice)?'accepted':'not-listed';
    const directions:DailyComparison['items'][number]['directions']=both&&scene.mode==='personal'?[direction(first[choiceId],sb),direction(second[choiceId],sa)]:[];
    const importantDifference=both&&(scene.mode==='joint'?!common&&(pa.important||pb.important):directions.some((d,index)=>d==='not-listed'&&(index===0?pa:pb).important));
    const facts:string[]=[];
    if(!both) facts.push('這個情境先保留各自願意分享的狀態；目前不足以判斷共同首選或接受範圍。');
    else {
      facts.push(common ? `${scene.mode==='personal'?'你們各自的首選相同':'你們共同首選的安排是'}：${pa.choice}` : `{{A}}首選「${pa.choice}」；{{B}}首選「${pb.choice}」。`);
      if (/^R[1-4]$/.test(first[reasonId]) && /^R[1-4]$/.test(second[reasonId])) facts.push(`{{A}}最在意「${pa.reason}」；{{B}}最在意「${pb.reason}」。${common&&first[reasonId]!==second[reasonId]?'同一個選擇，背後有不同理由。':''}`);
      if(scene.mode==='joint') {
        facts.push(sharedAccepted===null?'接受範圍還需要確認條件或想法，這輪先不判斷交集。':sharedAccepted.length?`你們都明示能接受：${sharedAccepted.join('；')}`:'目前列出的安排沒有共同接受項，不代表沒有其他方法。');
        // 首選不在本人明示集合時如實提醒，不自動補入或判為答錯。
        if(sa!==null&&!sa.includes(first[choiceId]))facts.push('{{A}}的首選未列入自己的接受範圍，值得核對這兩步的意思。');
        if(sb!==null&&!sb.includes(second[choiceId]))facts.push('{{B}}的首選未列入自己的接受範圍，值得核對這兩步的意思。');
      } else directions.forEach((state,index)=>facts.push(state==='context'?`${index===0?'{{B}}':'{{A}}'}的接受範圍尚待確認，這個方向先不判定。`:`${index===0?'{{A}}':'{{B}}'}的個人選擇${state==='accepted'?'已列入':'尚未列入'}${index===0?'{{B}}':'{{A}}'}目前直接能接受對方的做法。`));
      if(importantDifference)facts.push('這裡有本人填「非常重要」的選擇值得先聊；重要程度與可接受安排是分開的資料，不是衝突判定。');
    }
    return {sceneId:scene.id,title:scene.title,mode:scene.mode,a:pa,b:pb,common,sharedAccepted,directions,facts,importantDifference,discussion:both?scene.discussion:'尊重各自的未分享、不適用或未確定狀態，不需要補充原因。'};
  })};
}
