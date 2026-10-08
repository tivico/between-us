import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

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
  const answers = Object.fromEntries(status.quiz.questions.map((q) => [q.id, q.options[0].id]));
  await request(`/rounds/${id}/results`, { token: a, expected: 423 });
  await request(`/rounds/${id}/status`, { token: b, expected: 401 });
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers, revision: 0 } });
  const { invitationToken } = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
  await request('/invitations/claim', { method: 'POST', body: { invitationToken, nickname: '部署測試 B', consent: true, privateToken: b } });
  const statusB = await request(`/rounds/${id}/status`, { token: b });
  assert(!('answers' in statusB.peer));
  await request(`/rounds/${id}/results`, { token: b, expected: 423 });
  const q = status.quiz.questions[0]; const answersB = { ...answers, [q.id]: q.options[1].id };
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
  await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
  const results = await request(`/rounds/${id}/results`, { token: a });
  assert.deepEqual(results.participants.map((p) => p.answers), [answers, answersB]);
  await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: {}, revision: 1 }, expected: 409 });
  console.log('CLOUDFLARE_FLOW_OK: 建立、保存、邀請、提交前保密、兩人結果與提交鎖定通過。');
} catch {
  console.error('CLOUDFLARE_FLOW_FAILED: 請依維護手冊檢查健康狀態、DB binding 與 migration；不輸出憑證或答案。');
  process.exitCode = 1;
}
