import { useEffect, useState } from 'react';
import type { QuizDefinition, Question } from '../domain/quiz';
import type { RoundResults } from '../domain/round';
import { normalizeDailyAnswers } from '../domain/daily-values';
import './DailyValues.css';

export function editDailyAnswer(quiz:QuizDefinition, answers:Record<string,string>, questionId:string, optionId:string) {
  const next={...answers};
  const scene=quiz.dailyValues!.scenes.find((s)=>s.questionIds.includes(questionId))!;
  if(scene.questionIds.some((id)=>['not-shared','not-applicable'].includes(next[id])))for(const id of scene.questionIds)delete next[id];
  if(optionId)next[questionId]=optionId; else delete next[questionId];
  return normalizeDailyAnswers(quiz,next);
}

export function DailyOptions({quiz,question,selected,choose}:{quiz:QuizDefinition;question:Question;selected?:string;choose:(id:string)=>void}) {
  const scene=quiz.dailyValues!.scenes.find((s)=>s.questionIds.includes(question.id))!;
  const isAccept=question.id===scene.questionIds[3];
  const choiceQuestion=quiz.questions.find((q)=>q.id===scene.questionIds[0])!;
  const selectedIds=question.options.find((o)=>o.id===selected)?.selection ?? [];
  const options=question.options.filter((o)=>!o.selection);
  const toggle=(id:string)=>{const ids=choiceQuestion.options.slice(0,4).map((o)=>o.id).filter((value)=>value===id?!selectedIds.includes(value):selectedIds.includes(value));choose(ids.length?`set-${ids.join('')}`:'');};
  return <>
    {question.id!==scene.questionIds[0]&&<details className="daily-context"><summary>再看本情境的條件</summary><p>{scene.context}</p></details>}
    {isAccept&&<fieldset className="options"><legend>可複選的做法</legend>{choiceQuestion.options.slice(0,4).map((o)=><label className={`option ${selectedIds.includes(o.id)?'selected':''}`} key={o.id}><input type="checkbox" checked={selectedIds.includes(o.id)} onChange={()=>toggle(o.id)} /><span>{o.label}</span><span aria-hidden="true">{selectedIds.includes(o.id)?'✓':''}</span></label>)}</fieldset>}
    <fieldset className="options"><legend className={isAccept?'':'sr-only'}>{isAccept?'或選擇目前的狀態':question.prompt}</legend>{options.map((o)=><label className={`option ${selected===o.id?'selected':''}`} key={o.id}><input type="radio" name={question.id} checked={selected===o.id} onChange={()=>choose(o.id)} /><span>{o.label}</span><span aria-hidden="true">{selected===o.id?'✓':''}</span></label>)}</fieldset>
    <p className="local-note">暫不分享／不適用會取代這個情境的四步答案。重新回答時，四步會清空，請重新確認。</p>
  </>;
}

export function DailyReview({quiz,answers,edit}:{quiz:QuizDefinition;answers:Record<string,string>;edit:(index:number)=>void}) {
  return <ol className="answer-list">{quiz.dailyValues!.scenes.map((scene,index)=>{
    const withheld=scene.questionIds.some((id)=>['not-shared','not-applicable'].includes(answers[id]));
    return <li key={scene.id}><h2>{index+1}．{scene.title}</h2>{withheld?<p>{answers[scene.questionIds[0]]==='not-shared'?'整個情境未分享':'整個情境不適用'}</p>:scene.questionIds.map((id,i)=><p key={id}><strong>{['首選','理由','重要程度',scene.mode==='personal'?'能接受對方的選擇':'可接受安排'][i]}：</strong>{quiz.questions.find((q)=>q.id===id)?.options.find((o)=>o.id===answers[id])?.label ?? '尚未回答'}</p>)}<button className="text-button" onClick={()=>edit(index*4)}>修改這個情境 →</button></li>;
  })}</ol>;
}

export function DailyResults({results}:{results:RoundResults}) {
  const report=results.dailyComparison;
  const [a,b]=results.participants;
  const [chosen,setChosen]=useState<string|null>(null);
  const [step,setStep]=useState(0);
  useEffect(()=>{if(chosen){document.getElementById('daily-chat')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});document.getElementById('daily-chat-heading')?.focus({preventScroll:true});}},[chosen]);
  if(!report)return <p role="alert">目前未能取得日常探索整理，請重新載入。</p>;
  const name=(text:string)=>text.replaceAll('{{A}}',`${a.nickname} `).replaceAll('{{B}}',`${b.nickname} `);
  const common=report.items.filter((i)=>i.common).slice(0,2);
  const accepted=report.items.filter((i)=>i.mode==='joint'&&!i.common&&(i.sharedAccepted?.length??0)>0).slice(0,2);
  const important=report.items.filter((i)=>i.importantDifference).slice(0,2);
  const active=report.items.find((i)=>i.sceneId===chosen);
  const steps=['先看這個發現：讀出這題的首選、理由與接受範圍。','回到情境：哪些題目條件會影響你的選擇？','輪流分享：一人說最在意的理由，另一人先聽，再交換。','確認新的理解：說說你現在理解對方在意什麼，讓對方確認或修正。'];
  return <section className="daily-results"><p className="eyebrow">EVERYDAY CHOICES, SHARED UNDERSTANDING</p><h2>原來，我們這樣想。</h2><p className="flow-intro">這輪八個生活情境，呈現你們目前的選擇、理由與接受範圍。它們是題目條件下的想法，不是已發生的行為或關係預測。</p>
    <section className="preview-notice"><h2>這輪看見的選擇</h2><p>{common.length?`在「${common.map((i)=>i.title).join('」、「')}」，你們的首選相同。`:'這輪沒有足夠明確的共同首選；相同狀態不當共同偏好。'}</p><p>{accepted.length?`在「${accepted.map((i)=>i.title).join('」、「')}」，首選不同，但有雙方明示接受的列出安排。`:'先從各自的理由開始；沒有已確認的共同接受項，也可能是條件或想法還需要補充。'}</p>{important.length>0&&<p>值得先確認的期待：{important.map((i)=>i.title).join('、')}。這裡的「重要」來自本人填答，不是衝突程度。</p>}</section>
    <div className="daily-priorities">{(['a','b'] as const).map((key,index)=>{const priorities=report.items.filter((i)=>i[key].important);return <section className="link-card" key={key}><h2>{[a,b][index].nickname} 很在意的安排</h2>{priorities.length?<ul>{priorities.map((i)=><li key={i.sceneId}><strong>{i.title}</strong><p>{i[key].choice}</p><p>本人填：{i[key].reason}</p></li>)}</ul>:<p>這輪沒有明示「非常重要」的安排，不代表沒有重視的事。</p>}</section>;})}</div>
    <h2>把選擇變成理解</h2>{report.items.map((item)=><article className="comparison-card" key={item.sceneId}><h3>{item.title}</h3><div className="answer-pair">{[item.a,item.b].map((person,index)=><div className="person-answer" key={index}><strong>{[a,b][index].nickname}</strong><p>{person.choice}</p>{person.state==='shared'&&<><p>理由：{person.reason}</p><p>重要程度：{person.importance}</p><p>{item.mode==='personal'?'能接受對方的選擇':'可接受安排'}：{person.acceptance}</p></>}</div>)}</div><div className="daily-facts"><strong>本輪答案顯示</strong>{item.facts.map((fact,index)=><p key={index}>{name(fact)}</p>)}</div><p className="conversation-prompt">本站討論提案：{item.discussion}</p>{item.a.state==='shared'&&item.b.state==='shared'&&<button className="button secondary" onClick={()=>{setChosen(item.sceneId);setStep(0);}}>選這個發現一起聊 →</button>}<details className="question-evidence"><summary>情境、原選項與研究界線</summary><p>{results.quiz.dailyValues!.scenes.find((s)=>s.id===item.sceneId)!.context}</p>{results.quiz.questions.filter((q)=>results.quiz.dailyValues!.scenes.find((s)=>s.id===item.sceneId)!.questionIds.includes(q.id)).slice(0,2).map((q)=><div key={q.id}><h4>{q.prompt}</h4><ul>{q.options.slice(0,4).map((o)=><li key={o.id}>{o.label}</li>)}</ul></div>)}<p>{results.quiz.questions.find((q)=>q.id===`${item.sceneId}-choice`)!.evidence.note}</p></details></article>)}
    {active&&<section id="daily-chat" className="preview-notice daily-chat" aria-live="polite"><h2 id="daily-chat-heading" tabIndex={-1}>一起聊：{active.title}</h2><p>第 {step+1}／4 步</p><p>{steps[step]}</p><p>{active.discussion}</p><div className="demo-actions"><button className="button secondary" disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button>{step<3?<button className="button primary" onClick={()=>setStep(step+1)}>下一步 →</button>:<button className="button primary" onClick={()=>setChosen(null)}>結束這次交流</button>}</div><p>交流步驟只在這個頁面，不保存或同步，也不表示你們已完成討論。</p></section>}
    <details className="raw-answer-details"><summary>研究來源與解讀界線</summary><p>{results.quiz.evidenceSummary}</p>{results.quiz.sources.map((source)=><p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}）：{source.title}</a><br />{source.scope}</p>)}<p>內容 {results.quiz.version} · 整理規則 {report.version} · 每項結論依這輪快照與實際答案。</p></details><div className="demo-actions"><a className="button secondary" href="#/history">查看最近紀錄</a><a className="button primary" href="#/start/daily-values">另開一輪 →</a></div>
  </section>;
}
