import { createServer } from 'node:http';
import { RoundError } from './store.mjs';
import { releaseVersion, requestId, operationOf, observeApi, creationKey, createCreationLimiter } from './operations.mjs';

const localOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'];
async function bodyOf(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new RoundError('JSON_REQUIRED', '請使用 JSON 傳送資料。', 415);
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) { tooLarge = true; continue; }
    chunks.push(chunk);
  }
  if (tooLarge) throw new RoundError('BODY_TOO_LARGE', '資料超過此測試版本的大小限制。', 413);
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RoundError('INVALID_JSON', '資料格式不正確。'); }
}
export function createApi(store, { allowedOrigins = localOrigins, mode = 'local-development', limiter = createCreationLimiter(), observe = observeApi, maintenance = process.env.API_MAINTENANCE === 'true' } = {}) {
  const origins = new Set(allowedOrigins);
  return createServer(async (req, res) => {
    const id = requestId(), started = Date.now();
    let operation = 'unknown', responseCode = 'UNKNOWN';
    res.on('finish', () => observe({ id, started, operation, status: res.statusCode, code: responseCode }));
    res.setHeader('X-Request-ID', id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const send = (status, value) => { responseCode = value.code || 'OK'; res.writeHead(status); res.end(JSON.stringify(value)); };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) throw new RoundError('ORIGIN_DENIED', '這個來源不能存取保存服務。', 403);
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      if (origin) res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, Retry-After');
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      operation = operationOf(path);
      if (maintenance) return send(503, { code: 'MAINTENANCE', message: '保存服務正在維護，請稍後再試。' });
      if (req.method === 'OPTIONS' && path.startsWith('/api/')) {
        const requestedHeaders = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
        if (!origin || !['GET', 'POST', 'PUT'].includes(req.headers['access-control-request-method']) || requestedHeaders.some((header) => !['authorization', 'content-type'].includes(header))) {
          throw new RoundError('PREFLIGHT_DENIED', '這個跨來源請求不受支援。', 403);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        responseCode = 'OK'; res.writeHead(204); res.end(); return;
      }
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      if (req.method === 'GET' && path === '/api/health') {
        try { store.db.prepare('SELECT expires_at FROM rounds LIMIT 0').all(); store.db.prepare('SELECT withdrawn_at,previous_token_hash FROM participants LIMIT 0').all(); }
        catch { return send(503, { ok: false, code: 'READINESS_FAILED', message: '保存服務尚未就緒。' }); }
        return send(200, { ok: true, mode, version: releaseVersion, schema: 2 });
      }
      if (req.method === 'POST' && path === '/api/rounds') {
        if (!limiter(creationKey(req.socket.remoteAddress))) { res.setHeader('Retry-After', '60'); return send(429, { code: 'RATE_LIMITED', message: '建立回合較頻繁，請稍候一分鐘再試。' }); }
        return send(201, store.create(await bodyOf(req)));
      }
      if (req.method === 'GET' && path === '/api/invitations/preview') return send(200, store.invitationPreview(token));
      if (req.method === 'POST' && path === '/api/invitations/claim') return send(200, store.claim(await bodyOf(req)));
      const match = /^\/api\/rounds\/([a-f0-9-]{36})\/(status|answers|submit|results|withdraw|rotate)$/.exec(path);
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && operation === 'status') return send(200, store.status(id, token));
        if (req.method === 'GET' && operation === 'results') return send(200, store.results(id, token));
        if (req.method === 'PUT' && operation === 'answers') return send(200, store.save(id, token, await bodyOf(req)));
        if (req.method === 'POST' && operation === 'submit') { await bodyOf(req); return send(200, store.submit(id, token)); }
        if (req.method === 'POST' && operation === 'withdraw') return send(200, store.withdraw(id, token, await bodyOf(req)));
        if (req.method === 'POST' && operation === 'rotate') return send(200, store.rotate(id, token, await bodyOf(req)));
      }
      send(404, { code: 'NOT_FOUND', message: '找不到這個操作。' });
    } catch (error) {
      if (error instanceof RoundError) send(error.status, { code: error.code, message: error.message });
      else {
        // 不輸出 request、答案、token 或 SQLite 綁定參數。
        send(500, { code: 'INTERNAL_ERROR', message: '暫時無法保存，請稍後重試。' });
      }
    }
  });
}
