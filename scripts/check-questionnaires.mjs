import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { questionnaires } from '../src/content/questionnaires.ts';

// 全部為獨立工程 QA 回合；不讀使用者既有答案、不輸出憑證、答案或私人連結。
const url = new URL(process.argv[2]);
assert(url.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(url.hostname));
assert(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password);
const request = async (path, { method = 'GET', token, body, expected = 200 } = {}) => {
  const response = await fetch(`${url.origin}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, expected, 'HTTP status mismatch');
  return response.json();
};
try {
  assert.equal((await request('/health')).ok, true);
  for (const quiz of questionnaires) {
    const a = randomBytes(32).toString('hex'); const b = randomBytes(32).toString('hex');
    const { id } = await request('/rounds', { method: 'POST', expected: 201, body: { quizId: quiz.id, nickname: '問答部署 QA A', consent: true, privateToken: a } });
    const status = await request(`/rounds/${id}/status`, { token: a });
    assert.equal(status.quiz.questions.length, 4); assert.equal(status.quiz.version, '1.0.0');
    assert.equal(status.quiz.questionnaire.version, '1.0.0'); assert(!('conversation' in status));
    const answers = Object.fromEntries(status.quiz.questions.map((q) => [q.id, q.options[0].id]));
    const partial = { ...answers }; delete partial[status.quiz.questions[3].id];
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: partial, revision: 0 } });
    assert.equal((await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {}, expected: 400 })).code, 'INCOMPLETE');
    answers[status.quiz.questions[2].id] = 'not-shared'; answers[status.quiz.questions[3].id] = 'uncertain';
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers, revision: 1 } });
    assert.deepEqual((await request(`/rounds/${id}/status`, { token: a })).own.answers, answers);
    const { invitationToken } = await request(`/rounds/${id}/submit`, { method: 'POST', token: a, body: {} });
    const preview = await request('/invitations/preview', { token: invitationToken });
    assert.equal(preview.questionCount, 4); assert.equal(preview.isQuestionnaire, true);
    assert(!('answers' in preview)); assert(!('conversation' in preview));
    await request(`/rounds/${id}/status`, { token: b, expected: 401 });
    await request('/invitations/claim', { method: 'POST', body: { invitationToken, privateToken: b, nickname: '問答部署 QA B', consent: true } });
    assert(!('answers' in (await request(`/rounds/${id}/status`, { token: b })).peer));
    await request(`/rounds/${id}/results`, { token: b, expected: 423 });
    const answersB = Object.fromEntries(status.quiz.questions.map((q, i) => [q.id, q.options[i === 0 ? 1 : 0].id]));
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: b, body: { answers: answersB, revision: 0 } });
    await request(`/rounds/${id}/submit`, { method: 'POST', token: b, body: {} });
    const result = await request(`/rounds/${id}/results`, { token: a });
    assert.deepEqual(result.conversation.items.map((item) => item.status), ['different', 'common', 'context', 'context']);
    assert.equal(result.conversation.items[0].forA, status.quiz.questions[0].options[1].guidance);
    assert.equal(result.conversation.items[0].forB, status.quiz.questions[0].options[0].guidance);
    assert.equal(result.conversation.items[2].forA, null); assert.equal(result.conversation.items[3].forB, null);
    assert.equal(result.participants[0].answers[status.quiz.questions[2].id], 'not-shared');
    assert(!('score' in result.conversation)); assert(!('comparison' in result));
    assert.deepEqual(result, await request(`/rounds/${id}/results`, { token: b }));
    await request(`/rounds/${id}/answers`, { method: 'PUT', token: a, body: { answers: {}, revision: 2 }, expected: 409 });
    console.log(`QUESTIONNAIRE_GROUP_OK: ${quiz.id}`);
  }
  console.log('QUESTIONNAIRES_FLOW_OK: 八題組各四題、缺答、保密、特殊狀態、建議方向及鎖定通過。');
} catch {
  console.error('QUESTIONNAIRES_FLOW_FAILED: 請查健康、內容版本與問答部署；不輸出私人憑證或答案。');
  process.exitCode = 1;
}
