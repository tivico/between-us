import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 只建立虛構部署 QA 回合；不讀既有回合、不輸出答案／憑證、不刪 D1。
// --qa-proof 將此腳本自建的 QA 返回入口保存在忽略的 .local，供畫面驗證。
const url = new URL(process.argv[2]);
assert(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname));
assert(url.pathname === '/' && !url.hash && !url.search && !url.username && !url.password);
let phase = 'health';
const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
  const response = await fetch(url.origin + '/api' + path, {
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected);
  return response.json();
};
try {
  assert.equal((await request('/health')).mode, 'cloudflare-test');
  const proof = {};
  for (const mode of ['mixed', 'declined']) {
    phase = mode + '-create';
    const a = randomBytes(32).toString('hex'); const b = randomBytes(32).toString('hex');
    const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: 'long-distance', nickname: '部署驗證甲', consent: true, privateToken: a } });
    const status = await request('/rounds/' + id + '/status', { token: a });
    assert.equal(status.quiz.version, '0.2.0'); assert.equal(status.quiz.questions.length, 24);
    assert.equal(status.quiz.analysis.version, '1.0.0');
    assert(!('pairAnalysis' in status)); assert(!('scoring' in status.quiz));
    const blank = Object.fromEntries(status.quiz.questions.map(q => [q.id, 'prefer-not-share']));
    const answersA = mode === 'declined' ? blank : { ...blank,
      'ldr-busy-wanted': 'before', 'ldr-busy-actual': 'after',
      'ldr-support-wanted': 'listen', 'ldr-support-actual': 'solutions',
      'ldr-visit-wanted': 'weekly', 'ldr-visit-capacity': 'monthly',
      'ldr-call-arrangement': 'fixed',
    };
    const answersB = mode === 'declined' ? blank : { ...blank,
      'ldr-busy-wanted': 'after', 'ldr-busy-actual': 'after',
      'ldr-support-wanted': 'solutions', 'ldr-support-actual': 'solutions',
      'ldr-visit-wanted': 'monthly', 'ldr-visit-capacity': 'monthly',
      'ldr-call-arrangement': 'fixed',
    };
    phase = mode + '-protection';
    await request('/rounds/' + id + '/results', { token: a, expected: 423 });
    await request('/rounds/' + id + '/status', { token: b, expected: 401 });
    const partial = { ...answersA }; delete partial['ldr-future-revisit'];
    await request('/rounds/' + id + '/answers', { method: 'PUT', token: a, body: { answers: partial, revision: 0 } });
    assert.equal((await request('/rounds/' + id + '/submit', { method: 'POST', token: a, body: {}, expected: 400 })).code, 'INCOMPLETE');
    assert.deepEqual((await request('/rounds/' + id + '/status', { token: a })).own.answers, partial);
    await request('/rounds/' + id + '/answers', { method: 'PUT', token: a, body: { answers: answersA, revision: 1 } });
    const { invitationToken } = await request('/rounds/' + id + '/submit', { method: 'POST', token: a, body: {} });
    const preview = await request('/invitations/preview', { token: invitationToken });
    assert.equal(preview.questionCount, 24); assert.equal(preview.hasPairAnalysis, true); assert.equal(preview.hasValueScore, false);
    assert(!('answers' in preview)); assert(!('pairAnalysis' in preview));
    await request('/invitations/claim', { method: 'POST', body: { invitationToken, nickname: '部署驗證乙', consent: true, privateToken: b } });
    const peer = await request('/rounds/' + id + '/status', { token: b });
    assert.deepEqual(peer.own.answers, {}); assert(!('answers' in peer.peer)); assert(!('pairAnalysis' in peer));
    await request('/rounds/' + id + '/results', { token: b, expected: 423 });
    await request('/rounds/' + id + '/answers', { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
    await request('/rounds/' + id + '/submit', { method: 'POST', token: b, body: {} });
    phase = mode + '-results';
    const result = await request('/rounds/' + id + '/results', { token: a });
    assert.deepEqual(result, await request('/rounds/' + id + '/results', { token: b }));
    assert.deepEqual(result.participants.map(p => p.answers), [answersA, answersB]);
    assert(!('comparison' in result)); assert(!('score' in result.pairAnalysis));
    const analysis = result.pairAnalysis;
    assert.equal(analysis.ruleVersion, '1.0.0');
    assert.equal(analysis.conditions.length, 2);
    assert([...analysis.common, ...analysis.differences].every(f => f.kind !== 'within-person'));
    assert(analysis.context.every(f => f.advice === null));
    if (mode === 'mixed') {
      assert(analysis.differences.some(f => f.id === 'busy-response-A'));
      assert(analysis.common.some(f => f.id === 'busy-response-B'));
      assert(analysis.differences.find(f => f.id === 'support-A').advice.includes('我現在想先說完'));
      assert.equal(analysis.conditions.find(f => f.id === 'visits-A').state, 'different');
      assert.equal(analysis.conditions.find(f => f.id === 'visits-B').state, 'common');
      assert(analysis.suggestions.every(f => f.evidence.length === 2 && f.sourceIds.length && f.advice));
    } else {
      assert.deepEqual(analysis.common, []); assert.deepEqual(analysis.differences, []); assert.deepEqual(analysis.suggestions, []);
    }
    await request('/rounds/' + id + '/answers', { method: 'PUT', token: a, body: { answers: {}, revision: 2 }, expected: 409 });
    await request('/rounds/' + id + '/results', { token: randomBytes(32).toString('hex'), expected: 401 });
    proof[mode + 'A'] = url.origin + '/#/rounds/' + id + '/' + a;
    proof[mode + 'B'] = url.origin + '/#/rounds/' + id + '/' + b;
  }
  if (process.argv.includes('--qa-proof')) {
    await mkdir('.local/qa', { recursive: true });
    await writeFile('.local/qa/long-distance-proof.json', JSON.stringify(proof));
  }
  console.log('LONG_DISTANCE_FLOW_OK: 24 題／缺答與恢復／邀請／401-423-409 保護／雙向分析／見面條件／相同共同結果／全暫不分享通過；僅新增兩輪虛構 QA。');
} catch {
  console.error('LONG_DISTANCE_FLOW_FAILED: ' + phase + '；請依 Runbook 檢查 API／版本，不輸出答案或憑證。');
  process.exitCode = 1;
}
