import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const url = new URL(process.argv[2]);
assert(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname));
assert(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password);
const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
  const response = await fetch(`${url.origin}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected, '溝通API狀態不符合預期'); return response.json();
};
try {
  assert.equal((await request('/health')).ok, true);
  for (const allContext of [false, true]) {
    const a = randomBytes(32).toString('hex'); const b = randomBytes(32).toString('hex');
    const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: 'communication', nickname: '部署測試 A', consent: true, privateToken: a } });
    const status = await request(`/rounds/${id}/status`, { token: a });
    assert.equal(status.quiz.questions.length, 24); assert.equal(status.quiz.communication.version, '1.0.0');
    assert(!('communicationAnalysis' in status)); assert(!('comparison' in status));
    const base = Object.fromEntries(status.quiz.questions.map((q) => [q.id, 'not-shared']));
    const answersA = allContext ? base : { ...base, 'comm-timing-want': 'set-time', 'comm-timing-do': 'check-now' };
    const answersB = allContext ? base : { ...base, 'comm-timing-want': 'check-now', 'comm-timing-do': 'right-away' };
    const partial = { ...answersA }; delete partial['comm-follow-up-want'];
    await request(`/rounds/${id}/status`, { token: b, expected: 401 });
    await request(`/rounds/${id}/results`, { token: a, expected: 423 });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: partial, revision: 0 } });
    assert.equal((await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {}, expected: 400 })).code, 'INCOMPLETE');
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: { ...answersA, 'comm-channel-do': 'text' }, revision: 1 } });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: answersA, revision: 2 } });
    assert.deepEqual((await request(`/rounds/${id}/status`, { token: a })).own.answers, answersA);
    const { invitationToken } = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
    const preview = await request('/invitations/preview', { token: invitationToken });
    assert.equal(preview.hasCommunicationAnalysis, true); assert(!('answers' in preview)); assert(!('communicationAnalysis' in preview));
    await request('/invitations/claim', { method: 'POST', body: { invitationToken, nickname: '部署測試 B', consent: true, privateToken: b } });
    const before = await request(`/rounds/${id}/status`, { token: b });
    assert(!('answers' in before.peer)); assert(!('communicationAnalysis' in before));
    await request(`/rounds/${id}/results`, { token: b, expected: 423 });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
    await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
    const result = await request(`/rounds/${id}/results`, { token: a });
    assert.deepEqual(result, await request(`/rounds/${id}/results`, { token: b }));
    assert.deepEqual(result.participants.map((p) => p.answers), [answersA, answersB]);
    assert.equal(result.communicationAnalysis.findings.length, 24);
    if (allContext) {
      assert(result.communicationAnalysis.findings.every((f) => f.state === 'context' && f.advice === null && f.evidence.every((e) => e.label === '未分享')));
      assert(result.communicationAnalysis.summaries.every((s) => s.pairId === null));
    } else {
      assert.equal(result.communicationAnalysis.findings.find((f) => f.id === 'timing-A').state, 'different');
      assert.equal(result.communicationAnalysis.findings.find((f) => f.id === 'timing-B').state, 'same');
    }
    assert(!('comparison' in result)); assert(!('pairAnalysis' in result));
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: {}, revision: 3 }, expected: 409 });
    if (process.argv[3] === '--local-proof') {
      assert(['localhost', '127.0.0.1'].includes(url.hostname));
      await mkdir('.local/qa', { recursive: true });
      await writeFile(`.local/qa/communication-${allContext ? 'context' : 'mixed'}.json`, JSON.stringify({ a: `${url.origin}/#/rounds/${id}/${a}`, b: `${url.origin}/#/rounds/${id}/${b}` }));
    }
  }
  console.log('COMMUNICATION_FLOW_OK: 24題雙向分析、缺答、未分享替換、401/423/409、雙方結果及全情境保護通過。');
} catch {
  console.error('COMMUNICATION_FLOW_FAILED: 請查健康狀態與部署版本；不輸出憑證或答案。'); process.exitCode = 1;
}
