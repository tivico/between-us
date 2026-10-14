import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { RoundStore } from './store.mjs';
import { createApi } from './http.mjs';
import { createCreationLimiter, creationKey, observeApi } from './operations.mjs';
import worker from '../cloudflare/worker.mjs';
import { checkSiteHealth } from '../scripts/check-site-health.mjs';
import { catalogManifest } from '../scripts/generate-catalog.mjs';

let runtime, db;
beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-10-08', d1Databases: ['DB'] }));
  db = await runtime.getD1Database('DB');
  for (const name of ['0001_rounds.sql','0002_lifecycle.sql']) {
    const sql = await readFile(new URL(`../cloudflare/migrations/${name}`, import.meta.url),'utf8');
    await db.batch(sql.split(';').map((s)=>s.trim()).filter(Boolean).map((s)=>db.prepare(s)));
  }
},30000);
afterAll(async()=>{await runtime?.dispose();});

it('限流邊界、來源隔離及過期窗口；記憶體鍵數有上限',()=>{
  let time=0;
  const limiter=createCreationLimiter({limit:2,period:60,now:()=>time,maxKeys:2});
  expect(limiter('a')).toBe(true);expect(limiter('a')).toBe(true);expect(limiter('a')).toBe(false);
  expect(limiter('b')).toBe(true);expect(limiter('c')).toBe(false);
  time=60000;expect(limiter('c')).toBe(true);expect(limiter('a')).toBe(true);
  expect(creationKey('127.0.0.1')).not.toContain('127.0.0.1');
});
it('觀测僅輸出允許欄位，不含路徑、IP、答案、憑證或錯誤物件',()=>{
  const token=randomBytes(32).toString('hex'), records=[];
  observeApi({operation:'results',status:500,code:'INTERNAL_ERROR',id:'00000000-0000-4000-8000-000000000000',started:Date.now(),token,answers:{secret:'private'},url:`/api/?token=${token}`,ip:'192.0.2.1',error:new Error(token)},(text)=>records.push(JSON.parse(text)));
  expect(Object.keys(records[0]).sort()).toEqual(['code','elapsedMs','event','operation','requestId','status']);
  expect(JSON.stringify(records)).not.toContain(token);expect(JSON.stringify(records)).not.toContain('private');expect(JSON.stringify(records)).not.toContain('192.0.2.1');
});
it('Node建立限流不阻擋保存／提交，429有等待時間，健康查核實際schema',async()=>{
  const store=new RoundStore(), records=[];
  const api=createApi(store,{limiter:createCreationLimiter({limit:1}),observe:(e)=>records.push(e)});
  await new Promise((done)=>api.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${api.address().port}`;
  try {
    const token=randomBytes(32).toString('hex');
    const create=()=>fetch(`${base}/api/rounds`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quizId:'core-values-example',nickname:'維運QA',consent:true,privateToken:token})});
    const first=await create();expect(first.status).toBe(201);const {id}=await first.json();
    const second=await create();expect(second.status).toBe(429);expect(second.headers.get('retry-after')).toBe('60');
    const status=await fetch(`${base}/api/rounds/${id}/status`,{headers:{Authorization:`Bearer ${token}`}});expect(status.status).toBe(200);
    const quiz=(await status.json()).quiz, answers=Object.fromEntries(quiz.questions.map((q)=>[q.id,q.options[0].id]));
    expect((await fetch(`${base}/api/rounds/${id}/answers`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({answers,revision:0})})).status).toBe(200);
    expect((await fetch(`${base}/api/rounds/${id}/submit`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'})).status).toBe(200);
    expect((await (await fetch(`${base}/api/health`)).json()).schema).toBe(2);
    expect(records.every((e)=>!('token' in e))).toBe(true);
  } finally {await new Promise((done)=>api.close(done));store.close();}
});
it('Worker缺少binding或维护時fail closed；限流前不解析／保存答案',async()=>{
  const log=vi.spyOn(console,'log').mockImplementation(()=>{});
  try {
    const request=()=>new Request('https://qa.example/api/rounds',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.2'},body:'{}'});
    expect((await worker.fetch(request(),{DB:db})).status).toBe(503);
    expect((await worker.fetch(request(),{DB:db,API_MAINTENANCE:'true'})).status).toBe(503);
    let key;
    const blocked=await worker.fetch(request(),{DB:db,CREATE_RATE_LIMITER:{limit:async(input)=>{key=input.key;return {success:false};}}});
    expect(blocked.status).toBe(429);expect(blocked.headers.get('retry-after')).toBe('60');expect(key).not.toContain('192.0.2.2');
    expect((await worker.fetch(new Request('https://qa.example/api/health'),{DB:db})).status).toBe(503);
  } finally {log.mockRestore();}
});
it('健康監測只讀公開健康、HTML及資產，不建立回合／附憑證',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url:url.href,options});
    const path=url.pathname;
    if(path==='/api/health')return new Response(JSON.stringify({ok:true,version:'0.15.0'}),{headers:{'Cache-Control':'no-store'}});
    if(path==='/')return new Response('<div id="root"></div><script src="/assets/main.js"></script><link href="/assets/main.css">');
    return new Response('public',{headers:{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css'}});
  };
  expect(await checkSiteHealth('https://qa.example/',{fetcher})).toEqual({ok:true,version:'0.15.0'});
  expect(calls).toHaveLength(4);expect(calls.every((c)=>!c.options.headers)).toBe(true);
  await expect(checkSiteHealth('https://qa.example/#/rounds/private',{fetcher})).rejects.toThrow('INVALID_MONITOR_URL');
  await expect(checkSiteHealth('https://qa.example/',{fetcher:async()=>new Response('{}',{status:503})})).rejects.toThrow('HEALTH_HTTP_FAILED');
});
it('生成catalog與registry一致，沒有題目／計分配置／私人資料',async()=>{
  const saved=JSON.parse(await readFile(new URL('../src/content/quiz-catalog.json',import.meta.url),'utf8'));
  expect(saved).toEqual(catalogManifest());expect(saved.topics).toHaveLength(6);
  expect(saved.rounds.every((q)=>!('questions' in q)&&!('answers' in q))).toBe(true);
});
