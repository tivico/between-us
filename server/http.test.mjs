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
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
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
  it('Pages 來源可預檢與寫入，仍須私人憑證才能讀取', async () => {
    await new Promise((done) => server.close(done));
    const origin = 'https://couple.example.test';
    server = createApi(store, { allowedOrigins: [origin], mode: 'hosted-test' });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${server.address().port}`;
    const preflight = await fetch(`${base}/api/rounds`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, authorization' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    expect(preflight.headers.get('vary')).toBe('Origin');
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
    const token = randomBytes(32).toString('hex');
    const created = await fetch(`${base}/api/rounds`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: 'core-values', nickname: '跨來源測試', consent: true, privateToken: token }) });
    expect(created.status).toBe(201);
    expect(created.headers.get('access-control-allow-origin')).toBe(origin);
    const { id } = await created.json();
    const denied = await fetch(`${base}/api/rounds/${id}/status`, { headers: { Origin: origin } });
    expect(denied.status).toBe(401);
    expect(denied.headers.get('access-control-allow-origin')).toBe(origin);
    const own = await fetch(`${base}/api/rounds/${id}/status`, { headers: { Origin: origin, Authorization: `Bearer ${token}` } });
    expect((await own.json()).own.nickname).toBe('跨來源測試');
    expect((await (await fetch(`${base}/api/health`, { headers: { Origin: origin } })).json()).mode).toBe('hosted-test');
    expect((await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } })).status).toBe(403);
  });
  it('預檢拒絕額外標頭、方法與缺少來源', async () => {
    const headers = { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' };
    expect((await fetch(`${base}/api/rounds`, { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Headers': 'x-admin-key' } })).status).toBe(403);
    expect((await fetch(`${base}/api/rounds`, { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Method': 'DELETE' } })).status).toBe(403);
    expect((await fetch(`${base}/api/rounds`, { method: 'OPTIONS' })).status).toBe(403);
  });
});
