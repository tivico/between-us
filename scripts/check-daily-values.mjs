import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { dailyValuesQuiz as quiz } from '../src/content/daily-values.ts';

// 僅建立標記的工程QA回合，不讀取既有資料，不輸出返回憑證或答案。
const url=new URL(process.argv[2] ?? 'http://127.0.0.1:8787');
assert(url.protocol==='https:'||['127.0.0.1','localhost'].includes(url.hostname),'僅使用HTTPS或本機根網址');
assert(url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password,'請使用網站根網址');
const base=url.origin;
const token=()=>randomBytes(32).toString('hex');
async function call(path,{method='GET',credential,body,status=200}={}) {
  const response=await fetch(`${base}/api${path}`,{method,headers:{...(credential?{Authorization:`Bearer ${credential}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,status,`${method} ${path.replace(/rounds\/[^/]+/,'rounds/[QA]')} status`);
  return response.json();
}
const full=()=>Object.fromEntries(quiz.questions.map((q)=>[q.id,q.options[0].id]));
assert.equal((await call('/health')).ok,true);
for(const hidden of [false,true]) {
  const a=token(),b=token();const {id}=await call('/rounds',{method:'POST',status:201,body:{quizId:quiz.id,nickname:'工程QA日常A',consent:true,privateToken:a}});
  await call(`/rounds/${id}/results`,{credential:a,status:423});
  await call(`/rounds/${id}/status`,{credential:token(),status:401});
  await call(`/rounds/${id}/submit`,{method:'POST',credential:a,body:{},status:400});
  await call(`/rounds/${id}/answers`,{method:'PUT',credential:a,body:{answers:{'dv01-accept':'set-AA'},revision:0},status:400});
  const answers=full();
  if(hidden)for(const scene of quiz.dailyValues.scenes)answers[scene.questionIds[0]]='not-shared';
  else {answers['dv04-accept']='set-AC';answers['dv03-accept']='set-B';}
  await call(`/rounds/${id}/answers`,{method:'PUT',credential:a,body:{answers,revision:0}});
  const saved=await call(`/rounds/${id}/status`,{credential:a});
  assert.equal(saved.quiz.version,'1.0.0');
  if(hidden)assert.ok(Object.values(saved.own.answers).every((v)=>v==='not-shared'));
  const submitted=await call(`/rounds/${id}/submit`,{method:'POST',credential:a,body:{}});
  const preview=await call('/invitations/preview',{credential:submitted.invitationToken});
  assert.equal(preview.hasDailyValues,true);assert.equal(preview.questionCount,32);assert.equal(preview.answers,undefined);
  await call('/invitations/claim',{method:'POST',body:{privateToken:b,nickname:'工程QA日常B',consent:true,invitationToken:submitted.invitationToken}});
  const statusB=await call(`/rounds/${id}/status`,{credential:b});assert.equal(statusB.peer.answers,undefined);assert.deepEqual(statusB.own.answers,{});
  await call(`/rounds/${id}/results`,{credential:b,status:423});
  const other=full();if(hidden)for(const scene of quiz.dailyValues.scenes)other[scene.questionIds[3]]='not-shared';
  else{other['dv04-choice']='B';other['dv04-accept']='set-BC';}
  await call(`/rounds/${id}/answers`,{method:'PUT',credential:b,body:{answers:other,revision:0}});
  await call(`/rounds/${id}/submit`,{method:'POST',credential:b,body:{}});
  const result=await call(`/rounds/${id}/results`,{credential:a});assert.equal(result.dailyComparison.version,'1.0.0');assert.equal(result.dailyComparison.items.length,8);assert.equal(result.comparison,undefined);
  if(hidden){assert.ok(result.participants.every((p)=>Object.values(p.answers).every((v)=>v==='not-shared')));assert.ok(result.dailyComparison.items.every((i)=>!i.common&&i.sharedAccepted===null));}
  else{const work=result.dailyComparison.items.find((i)=>i.sceneId==='dv03');assert.deepEqual(work.directions,['accepted','not-listed']);const time=result.dailyComparison.items.find((i)=>i.sceneId==='dv04');assert.equal(time.sharedAccepted.length,1);assert.equal(time.importantDifference,true);}
  await call(`/rounds/${id}/answers`,{method:'PUT',credential:b,body:{answers:other,revision:1},status:409});
}
console.log('DAILY_VALUES_QA_OK: complete pair, directional acceptance, intersection, whole-scene privacy, 401/423/409 and incomplete protection.');
