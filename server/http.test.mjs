import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createApi } from './http.mjs';
import { RoundStore } from './store.mjs';

let store; let server; let base;
beforeEach(async () => {
  store = new RoundStore(); server = createApi(store);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { await new Promise((done) => server.close(done)); store.close(); });
describe('HTTP 邊界', () => {
  it('拒絕非允許的瀏覽器來源', async () => {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://unrelated.example' } });
    expect(response.status).toBe(403);
  });
  it('拒絕非 JSON 與格式錯誤 JSON', async () => {
    const wrongType = await fetch(`${base}/api/rounds`, { method: 'POST', body: '{}' });
    expect(wrongType.status).toBe(415);
    const broken = await fetch(`${base}/api/rounds`, { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    expect(broken.status).toBe(400);
  });
  it('超過大小限制時回 413，不儲存資料', async () => {
    const response = await fetch(`${base}/api/rounds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(40000) }) });
    expect(response.status).toBe(413);
    expect(store.db.prepare('SELECT count(*) AS n FROM rounds').get().n).toBe(0);
  });
  it('未知端點回 404，私人狀態回 401 且不快取', async () => {
    expect((await fetch(`${base}/api/missing`)).status).toBe(404);
    const response = await fetch(`${base}/api/rounds/00000000-0000-4000-8000-000000000000/status`);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('可建立並以 Bearer 找回，但回應不回傳原始私人 token', async () => {
    const token = randomBytes(32).toString('hex');
    const response = await fetch(`${base}/api/rounds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: 'core-values', nickname: 'HTTP 測試', consent: true, privateToken: token }) });
    expect(response.status).toBe(201);
    const result = await response.json(); expect(result).not.toHaveProperty('privateToken');
    const restored = await fetch(`${base}/api/rounds/${result.id}/status`, { headers: { Authorization: `Bearer ${token}` } });
    expect(restored.status).toBe(200); expect((await restored.json()).own.nickname).toBe('HTTP 測試');
  });
});
