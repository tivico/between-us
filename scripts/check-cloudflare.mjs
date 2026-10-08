import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 建立一輪虛構 QA 答案，不輸出私人憑證，也不讀取既有使用者回合。
const url = new URL(process.argv[2]);
assert(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname), '只允許 HTTPS 或本機測試網址');
assert(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password, '請使用網站根網址');
const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
  const response = await fetch(`${url.origin}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected, `${method} ${path.replace(/[a-f0-9-]{36}/g, '[round]')} 狀態不符合預期`);
  return response.json();
};
try {
  assert.equal((await request('/health')).mode, 'cloudflare-test');
  const a = randomBytes(32).toString('hex'); const b = randomBytes(32).toString('hex');
  const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: 'core-values', nickname: '部署測試 A', consent: true, privateToken: a } });
  const status = await request(`/rounds/${id}/status`, { token: a });
  assert.equal(status.quiz.questions.length, 57);
  assert.equal(status.quiz.scoring.version, '1.0.0');
  const answers = Object.fromEntries(status.quiz.questions.map((q, index) => [q.id, q.options[index % 6].id]));
  const partial = { ...answers }; delete partial['pvqrr-57'];
  await request(`/rounds/${id}/results`, { token: a, expected: 423 });
  await request(`/rounds/${id}/status`, { token: b, expected: 401 });
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: partial, revision: 0 } });
  const incomplete = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {}, expected: 400 });
  assert.equal(incomplete.code, 'INCOMPLETE');
  assert.deepEqual((await request(`/rounds/${id}/status`, { token: a })).own.answers, partial);
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers, revision: 1 } });
  const { invitationToken } = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
  await request('/invitations/claim', { method: 'POST', body: { invitationToken, nickname: '部署測試 B', consent: true, privateToken: b } });
  const statusB = await request(`/rounds/${id}/status`, { token: b });
  assert(!('answers' in statusB.peer));
  await request(`/rounds/${id}/results`, { token: b, expected: 423 });
  const answersB = Object.fromEntries(status.quiz.questions.map((q, index) => [q.id, q.options[(index + 3) % 6].id]));
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
  await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
  const results = await request(`/rounds/${id}/results`, { token: a });
  assert.deepEqual(results.participants.map((p) => p.answers), [answers, answersB]);
  assert.equal(results.comparison.values.length, 19);
  assert(Number.isFinite(results.comparison.score) && results.comparison.score >= 0 && results.comparison.score < 100);
  assert.deepEqual(results, await request(`/rounds/${id}/results`, { token: b }));
  if (process.argv[3] === '--local-proof') {
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Proof is local only');
    await mkdir('.local/qa', { recursive: true });
    await writeFile('.local/qa/core-values-proof.json', JSON.stringify({ a: `${url.origin}/#/rounds/${id}/${a}`, b: `${url.origin}/#/rounds/${id}/${b}` }));
  }
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: {}, revision: 1 }, expected: 409 });
  console.log('CLOUDFLARE_FLOW_OK: 57 題保存／缺答保護、邀請、提交前保密、19 類計分、相近度、共同結果與提交鎖定通過。');
} catch {
  console.error('CLOUDFLARE_FLOW_FAILED: 請依維護手冊檢查健康狀態、DB binding 與 migration；不輸出憑證或答案。');
  process.exitCode = 1;
}
