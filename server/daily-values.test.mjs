import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { D1RoundStore } from '../cloudflare/store.mjs';
import { dailyValuesQuiz as quiz } from '../src/content/daily-values.ts';
import { analyzeDailyValues, normalizeDailyAnswers } from '../src/domain/daily-values.ts';
import { validateQuiz } from '../src/domain/quiz.ts';

// 隔離的工程案例，不讀取真實回合，也不把測試選擇當產品使用者資料。
const credential=()=>randomBytes(32).toString('hex');
const complete=()=>Object.fromEntries(quiz.questions.map((q)=>[q.id,q.options[0].id]));
let runtime,db;
beforeAll(async()=>{
  runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("qa")}}',compatibilityDate:'2026-10-08',d1Databases:['DB']}));
  db=await runtime.getD1Database('DB');
  const sql=await readFile(new URL('../cloudflare/migrations/0001_rounds.sql',import.meta.url),'utf8');
  await db.batch(sql.split(';').map((s)=>s.trim()).filter(Boolean).map((s)=>db.prepare(s)));
},30000);
afterAll(async()=>{await runtime?.dispose();});

it('八情境32步與接受組合契約完整，缺配置／不合法集合被拒絕',()=>{
  expect(validateQuiz(quiz)).toEqual([]);
  const bad=structuredClone(quiz);bad.questions.find((q)=>q.id==='dv01-accept').options[0].selection=['missing'];
  expect(validateQuiz(bad)).toContain('日常接受範圍契約不完整');
});
it('共同首選與不同理由分開；未問的理由不推論',()=>{
  const a=complete(),b=complete();b['dv01-reason']='R4';
  expect(analyzeDailyValues(quiz,a,b).items[0].facts.join('')).toContain('同一個選擇，背後有不同理由');
  b['dv01-reason']='uncertain';
  expect(analyzeDailyValues(quiz,a,b).items[0].facts.join('')).not.toContain('背後有不同理由');
});
it('重要差異與共同接受可同時成立，未知不能當空交集',()=>{
  const a=complete(),b=complete();b['dv04-choice']='B';a['dv04-accept']='set-AC';b['dv04-accept']='set-BC';
  let item=analyzeDailyValues(quiz,a,b).items.find((i)=>i.sceneId==='dv04');
  expect(item.importantDifference).toBe(true);expect(item.sharedAccepted).toHaveLength(1);
  b['dv04-accept']='conditional';item=analyzeDailyValues(quiz,a,b).items.find((i)=>i.sceneId==='dv04');
  expect(item.sharedAccepted).toBeNull();
  b['dv04-accept']='none';expect(analyzeDailyValues(quiz,a,b).items.find((i)=>i.sceneId==='dv04').sharedAccepted).toEqual([]);
});
it('個人選擇逐方向讀另一方接受集合，同首選不代表雙向接受',()=>{
  const a=complete(),b=complete();a['dv03-accept']='set-B';b['dv03-accept']='set-A';
  const item=analyzeDailyValues(quiz,a,b).items.find((i)=>i.sceneId==='dv03');
  expect(item.directions).toEqual(['accepted','not-listed']);expect(item.sharedAccepted).toBeNull();
  expect(analyzeDailyValues(quiz,b,a).items.find((i)=>i.sceneId==='dv03').directions).toEqual(['not-listed','accepted']);
  b['dv03-accept']='uncertain';expect(analyzeDailyValues(quiz,a,b).items.find((i)=>i.sceneId==='dv03').directions[0]).toBe('context');
});
it('整組未分享／不適用取代四欄，特殊狀態不當共同偏好',()=>{
  for(const state of ['not-shared','not-applicable']){
    const answer=complete();answer['dv01-reason']=state;
    const normalized=normalizeDailyAnswers(quiz,answer);
    expect(quiz.dailyValues.scenes[0].questionIds.map((id)=>normalized[id])).toEqual(Array(4).fill(state));
    const item=analyzeDailyValues(quiz,answer,answer).items[0];expect(item.common).toBe(false);expect(item.sharedAccepted).toBeNull();
  }
});
it('結果只使用快照，不查最新內容，舊規則版本不靜默追套',()=>{
  const snapshot=structuredClone(quiz);snapshot.questions[0].options[0].label='快照中保留的測試選項';
  expect(analyzeDailyValues(snapshot,complete(),complete()).items[0].a.choice).toBe('快照中保留的測試選項');
  snapshot.dailyValues.version='unknown';expect(()=>analyzeDailyValues(snapshot,complete(),complete())).toThrow('不支援');
});
for(const mode of ['Node','D1'])it(`${mode} 保存清除整組私人選擇，保護缺答／授權／雙方解鎖與提交鎖`,async()=>{
  const store=mode==='Node'?new RoundStore():new D1RoundStore(db);
  try{
    const a=credential(),b=credential();const {id}=await store.create({quizId:quiz.id,nickname:'工程QA A',consent:true,privateToken:a});
    await expect(async()=>store.results(id,a)).rejects.toMatchObject({status:423});
    await expect(async()=>store.results(id,credential())).rejects.toMatchObject({status:401});
    await store.save(id,a,{answers:{'dv01-choice':'A'},revision:0});
    await expect(async()=>store.submit(id,a)).rejects.toMatchObject({code:'INCOMPLETE'});
    await expect(async()=>store.save(id,a,{answers:{'dv01-accept':'set-AA'},revision:1})).rejects.toMatchObject({code:'INVALID_ANSWERS'});
    const answers=complete();answers['dv01-reason']='not-shared';
    await store.save(id,a,{answers,revision:1});
    const status=await store.status(id,a);
    expect(quiz.dailyValues.scenes[0].questionIds.map((q)=>status.own.answers[q])).toEqual(Array(4).fill('not-shared'));
    const submitted=await store.submit(id,a);const preview=await store.invitationPreview(submitted.invitationToken);
    expect(preview.hasDailyValues).toBe(true);expect(preview).not.toHaveProperty('answers');
    await store.claim({invitationToken:submitted.invitationToken,privateToken:b,nickname:'工程QA B',consent:true});
    expect((await store.status(id,b)).peer).not.toHaveProperty('answers');
    await expect(async()=>store.results(id,b)).rejects.toMatchObject({status:423});
    await store.save(id,b,{answers:complete(),revision:0});await store.submit(id,b);
    const result=await store.results(id,b);expect(result.dailyComparison.items).toHaveLength(8);
    expect(result.dailyComparison.items[0].a.state).toBe('not-shared');expect(result).not.toHaveProperty('comparison');
    await expect(async()=>store.save(id,b,{answers:complete(),revision:1})).rejects.toMatchObject({status:409});
  }finally{if(mode==='Node')store.close();}
});
