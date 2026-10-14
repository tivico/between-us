import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 只建立明示部署QA的新回合；不讀既有答案，不輸出憑證／答案，不刪資料。
// --qa-proof 將本腳本自建回合的入口留在忽略的.local，供畫面驗收。
const url = new URL(process.argv[2]);
assert(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname));
assert(url.pathname === '/' && !url.hash && !url.search && !url.username && !url.password);
let phase = 'health';
const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
  const response = await fetch(`${url.origin}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, expected, 'HTTP status mismatch');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response.json();
};
try {
  assert.equal((await request('/health')).ok, true);
  for (const allContext of [false, true]) {
    phase = allContext ? 'context' : 'mixed';
    const a = randomBytes(32).toString('hex'), b = randomBytes(32).toString('hex');
    const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: 'money-life', nickname: '部署QA生活A', consent: true, privateToken: a } });
    const status = await request(`/rounds/${id}/status`, { token: a });
    assert.equal(status.quiz.version, '0.2.0'); assert.equal(status.quiz.questions.length, 12);
    assert.equal(status.quiz.moneyLife.version, '1.0.0'); assert(!('moneyLifeAnalysis' in status));
    const base = Object.fromEntries(status.quiz.questions.map((q) => [q.id, 'not-shared']));
    const answersA = allContext ? base : { ...base, 'money-proposal-want': 'cost-scope', 'money-proposal-do': 'meaning', 'money-split-principle': 'equal-amount', 'money-over-capacity': 'not-participating', 'money-confirm-want': 'written-scope', 'money-confirm-do': 'written-scope' };
    const answersB = allContext ? base : { ...base, 'money-proposal-want': 'meaning', 'money-proposal-do': 'meaning', 'money-split-principle': 'equal-amount', 'money-pooling-boundary': 'none-separate', 'money-confirm-do': 'not-experienced', 'money-confirm-want': 'written-scope' };
    await request(`/rounds/${id}/status`, { token: b, expected: 401 });
    await request(`/rounds/${id}/results`, { token: a, expected: 423 });
    const partial = { ...answersA }; delete partial['money-plan-work'];
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: partial, revision: 0 } });
    assert.equal((await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {}, expected: 400 })).code, 'INCOMPLETE');
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: { ...answersA, 'money-pooling-boundary': 'this-plan-only' }, revision: 1 } });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: answersA, revision: 2 } });
    assert.deepEqual((await request(`/rounds/${id}/status`, { token: a })).own.answers, answersA);
    const { invitationToken } = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
    const preview = await request('/invitations/preview', { token: invitationToken });
    assert.equal(preview.hasMoneyLifeAnalysis, true); assert.equal(preview.questionCount, 12);
    assert(!('answers' in preview)); assert(!('moneyLifeAnalysis' in preview));
    await request('/invitations/claim', { method: 'POST', body: { invitationToken, nickname: '部署QA生活B', consent: true, privateToken: b } });
    const before = await request(`/rounds/${id}/status`, { token: b });
    assert(!('answers' in before.peer)); assert(!('moneyLifeAnalysis' in before));
    await request(`/rounds/${id}/results`, { token: b, expected: 423 });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
    await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
    const result = await request(`/rounds/${id}/results`, { token: a });
    assert.deepEqual(result, await request(`/rounds/${id}/results`, { token: b }));
    assert.deepEqual(result.participants.map((p) => p.answers), [answersA, answersB]);
    const analysis = result.moneyLifeAnalysis;
    assert.equal(analysis.ruleVersion, '1.0.0'); assert.equal(analysis.pairs.length, 4);
    assert.equal(analysis.boundaries.length, 1); assert.equal(analysis.constraints.length, 2);
    assert.equal(analysis.processes.length, 2); assert.equal(analysis.preferences.length, 3);
    assert([...analysis.boundaries, ...analysis.constraints, ...analysis.processes].every((f) => f.state === null));
    if (allContext) {
      assert(analysis.pairs.every((f) => f.state === 'context' && f.advice === null && f.discussion === null && f.evidence.every((e) => e.label === '未分享')));
      assert(analysis.preferences.every((f) => f.state === 'context'));
    } else {
      assert.equal(analysis.pairs.find((f) => f.id === 'proposal-information-A').state, 'different');
      assert.equal(analysis.pairs.find((f) => f.id === 'proposal-information-B').state, 'same');
      assert.equal(analysis.pairs.find((f) => f.id === 'expense-confirmation-A').advice, null);
      assert.equal(analysis.pairs.find((f) => f.id === 'expense-confirmation-B').state, 'same');
      assert.equal(analysis.preferences[0].state, 'same');
      assert.equal(analysis.constraints[0].evidence[0].label, '這次先不參加，也先不安排替代活動');
      assert.equal(analysis.boundaries[0].evidence[0].label, '未分享');
      assert.equal(analysis.boundaries[0].evidence[1].label, '目前都不集中，想先各自處理');
    }
    assert(!('comparison' in result)); assert(!('pairAnalysis' in result)); assert(!('score' in analysis));
    await request(`/rounds/${id}/results`, { token: randomBytes(32).toString('hex'), expected: 401 });
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: {}, revision: 3 }, expected: 409 });
    if (process.argv.includes('--qa-proof')) {
      await mkdir('.local/qa/money-life', { recursive: true });
      await writeFile(`.local/qa/money-life/${url.protocol === 'https:' ? 'public' : 'local'}-${allContext ? 'context' : 'mixed'}.json`, JSON.stringify({ a: `${url.origin}/#/rounds/${id}/${a}`, b: `${url.origin}/#/rounds/${id}/${b}` }));
    }
  }
  console.log('MONEY_LIFE_FLOW_OK: 12題、兩組雙向、本人條件／範圍、未分享替換、全情境與401/423/409通過。');
} catch {
  console.error(`MONEY_LIFE_FLOW_FAILED (${phase}): 請查健康狀態與部署版本；不輸出憑證或答案。`); process.exitCode = 1;
}
