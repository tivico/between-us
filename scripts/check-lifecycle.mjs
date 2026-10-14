import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import release from '../package.json' with { type: 'json' };

// 僅操作本腳本新建的明示工程QA；退出只刪這些QA本人答案，不讀既有回合。
// 不打印憑證、答案、回合ID、私人網址或HTTP錯誤物件；不直接寫D1。
let phase = 'health';
try {
  const site = new URL(process.argv[2]);
  assert(site.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(site.hostname));
  assert(site.pathname === '/' && !site.hash && !site.search && !site.username && !site.password);
  const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
    const response = await fetch(new URL(`/api${path}`, site), {
      method, redirect: 'error', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('X-Request-ID') || '', /^[a-f0-9-]{36}$/);
    return response.json();
  };
  const health = await request('/health');
  assert.equal(health.ok, true); assert.equal(health.version, release.version); assert.equal(health.schema, 2);
  const a = randomBytes(32).toString('hex'), nextA = randomBytes(32).toString('hex');
  const b = randomBytes(32).toString('hex'), nextB = randomBytes(32).toString('hex');
  phase = 'create-retention';
  const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: 'money-life', nickname: '部署QA生命週期A', consent: true, privateToken: a } });
  const status = await request(`/rounds/${id}/status`, { token: a });
  assert.equal(Date.parse(status.expiresAt) - Date.parse(status.createdAt), 180 * 86400000);
  const answers = (offset) => Object.fromEntries(status.quiz.questions.map((q) => [q.id, q.options[offset].id]));
  const answersA = answers(0), answersB = answers(1);
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: answersA, revision: 0 } });
  const original = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
  phase = 'rotate-host';
  const rotate = { method: 'POST', token: a, body: { privateToken: nextA } };
  assert.equal((await request(`/rounds/${id}/rotate`, rotate)).rotated, true);
  assert.equal((await request(`/rounds/${id}/rotate`, rotate)).rotated, true); // 同請求重試。
  await request(`/rounds/${id}/status`, { token: a, expected: 401 });
  await request('/invitations/preview', { token: original.invitationToken, expected: 404 });
  const rotated = await request(`/rounds/${id}/status`, { token: nextA });
  assert.equal(rotated.expiresAt, status.expiresAt); assert.deepEqual(rotated.own.answers, answersA);
  assert.notEqual(rotated.invitationToken, original.invitationToken);
  phase = 'unlock-opening';
  await request('/invitations/claim', { method: 'POST', body: { invitationToken: rotated.invitationToken, privateToken: b, nickname: '部署QA生命週期B', consent: true } });
  await request(`/rounds/${id}/results`, { token: b, expected: 423 });
  assert(!('answers' in (await request(`/rounds/${id}/status`, { token: b })).peer));
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
  await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
  const result = await request(`/rounds/${id}/results`, { token: nextA });
  assert.equal(result.resultOpening.version, '1.0.0'); assert.equal(result.resultOpening.origin, 'reading-layer');
  assert.equal(result.resultOpening.discoveryEvidence.length > 0, true);
  for (const evidence of result.resultOpening.discoveryEvidence) {
    const person = result.participants.find((p) => p.slot === evidence.slot);
    const question = result.quiz.questions.find((q) => q.id === evidence.questionId);
    assert.equal(evidence.prompt, question.prompt);
    assert.equal(evidence.label, question.options.find((o) => o.id === person.answers[evidence.questionId]).label);
  }
  phase = 'rotate-guest';
  await request(`/rounds/${id}/rotate`, { method: 'POST', token: b, body: { privateToken: nextB } });
  await request(`/rounds/${id}/status`, { token: b, expected: 401 });
  assert.deepEqual((await request(`/rounds/${id}/status`, { token: nextB })).own.answers, answersB);
  assert.equal((await request(`/rounds/${id}/status`, { token: nextA })).expiresAt, status.expiresAt);
  phase = 'withdraw-close';
  assert.equal((await request(`/rounds/${id}/withdraw`, { method: 'POST', token: nextA, body: { confirm: 'withdraw' } })).withdrawn, true);
  await request(`/rounds/${id}/status`, { token: nextA, expected: 410 });
  await request(`/rounds/${id}/results`, { token: nextB, expected: 410 });
  await request('/invitations/preview', { token: rotated.invitationToken, expected: 404 });
  const closed = await request(`/rounds/${id}/status`, { token: nextB });
  assert.equal(closed.state, 'closed'); assert.equal(closed.peer.nickname, '已退出');
  assert(!('answers' in closed.peer)); assert.deepEqual(closed.own.answers, answersB);
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: nextB, body: { answers: {}, revision: closed.own.revision }, expected: 410 });
  await request(`/rounds/${id}/withdraw`, { method: 'POST', token: nextB, body: { confirm: 'withdraw' } });
  await request(`/rounds/${id}/status`, { token: nextB, expected: 410 });
  console.log('LIFECYCLE_FLOW_OK: 新回合180天、A/B更換與重試、舊憑證撤銷、摘要依據、退出及對方本人答案通過；QA雙方已退出。');
} catch {
  console.error(`LIFECYCLE_FLOW_FAILED phase=${phase}: 不輸出私人憑證或答案；依Runbook檢查部署與schema。`);
  process.exitCode = 1;
}
