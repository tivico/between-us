import { D1RoundStore, RoundError } from './store.mjs';
import { releaseVersion, requestId, operationOf, observeApi, creationKey } from '../server/operations.mjs';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
async function bodyOf(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new RoundError('JSON_REQUIRED', '請使用 JSON 傳送資料。', 415);
  const reader = request.body?.getReader(); const chunks = []; let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new RoundError('BODY_TOO_LARGE', '資料超過此測試版本的大小限制。', 413); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RoundError('INVALID_JSON', '資料格式不正確。'); }
}
export default {
  async scheduled(_event, env) {
    try { const removed = await new D1RoundStore(env.DB).cleanupExpired(); console.log(JSON.stringify({ event: 'retention_cleanup', outcome: 'ok', removed })); }
    catch { console.log(JSON.stringify({ event: 'retention_cleanup', outcome: 'failed' })); throw new Error('RETENTION_CLEANUP_FAILED'); }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const id = requestId(), started = Date.now(), operation = operationOf(url.pathname);
    const send = (status, value) => {
      observeApi({ id, started, operation, status, code: value.code || 'OK' });
      return new Response(JSON.stringify(value), { status, headers: { ...headers, 'X-Request-ID': id, ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
    };
    try {
      if (env.API_MAINTENANCE === 'true') return send(503, { code: 'MAINTENANCE', message: '保存服務正在維護，請稍後再試。' });
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new RoundError('ORIGIN_DENIED', '這個來源不能存取保存服務。', 403);
      const store = new D1RoundStore(env.DB);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
      const path = url.pathname; const method = request.method;
      if (method === 'GET' && path === '/api/health') {
        try { await store.one('SELECT expires_at FROM rounds LIMIT 0'); await store.one('SELECT withdrawn_at,previous_token_hash FROM participants LIMIT 0'); if (!env.CREATE_RATE_LIMITER) throw new Error(); }
        catch { return send(503, { ok: false, code: 'READINESS_FAILED', message: '保存服務尚未就緒。' }); }
        return send(200, { ok: true, mode: 'cloudflare-test', version: releaseVersion, schema: 2 });
      }
      if (method === 'POST' && path === '/api/rounds') {
        if (!env.CREATE_RATE_LIMITER) return send(503, { code: 'READINESS_FAILED', message: '保存服務尚未就緒。' });
        const { success } = await env.CREATE_RATE_LIMITER.limit({ key: creationKey(request.headers.get('CF-Connecting-IP')) });
        if (!success) return send(429, { code: 'RATE_LIMITED', message: '建立回合較頻繁，請稍候一分鐘再試。' });
        return send(201, await store.create(await bodyOf(request)));
      }
      if (method === 'GET' && path === '/api/invitations/preview') return send(200, await store.invitationPreview(token));
      if (method === 'POST' && path === '/api/invitations/claim') return send(200, await store.claim(await bodyOf(request)));
      const match = /^\/api\/rounds\/([a-f0-9-]{36})\/(status|answers|submit|results|withdraw|rotate)$/.exec(path);
      if (match) {
        const [, id, operation] = match;
        if (method === 'GET' && operation === 'status') return send(200, await store.status(id, token));
        if (method === 'GET' && operation === 'results') return send(200, await store.results(id, token));
        if (method === 'PUT' && operation === 'answers') return send(200, await store.save(id, token, await bodyOf(request)));
        if (method === 'POST' && operation === 'submit') { await bodyOf(request); return send(200, await store.submit(id, token)); }
        if (method === 'POST' && operation === 'withdraw') return send(200, await store.withdraw(id, token, await bodyOf(request)));
        if (method === 'POST' && operation === 'rotate') return send(200, await store.rotate(id, token, await bodyOf(request)));
      }
      return send(404, { code: 'NOT_FOUND', message: '找不到這個操作。' });
    } catch (error) {
      if (error instanceof RoundError) return send(error.status, { code: error.code, message: error.message });
      return send(500, { code: 'INTERNAL_ERROR', message: '暫時無法保存，請稍後重試。' });
    }
  },
};
