import { createServer } from 'node:http';
import { RoundError } from './store.mjs';

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
export function createApi(store, { allowedOrigins = localOrigins, mode = 'local-development' } = {}) {
  const origins = new Set(allowedOrigins);
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) throw new RoundError('ORIGIN_DENIED', '這個來源不能存取保存服務。', 403);
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      if (req.method === 'OPTIONS' && path.startsWith('/api/')) {
        const requestedHeaders = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
        if (!origin || !['GET', 'POST', 'PUT'].includes(req.headers['access-control-request-method']) || requestedHeaders.some((header) => !['authorization', 'content-type'].includes(header))) {
          throw new RoundError('PREFLIGHT_DENIED', '這個跨來源請求不受支援。', 403);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.writeHead(204); res.end(); return;
      }
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      if (req.method === 'GET' && path === '/api/health') return send(200, { ok: true, mode });
      if (req.method === 'POST' && path === '/api/rounds') return send(201, store.create(await bodyOf(req)));
      if (req.method === 'GET' && path === '/api/invitations/preview') return send(200, store.invitationPreview(token));
      if (req.method === 'POST' && path === '/api/invitations/claim') return send(200, store.claim(await bodyOf(req)));
      const match = /^\/api\/rounds\/([a-f0-9-]{36})\/(status|answers|submit|results)$/.exec(path);
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && operation === 'status') return send(200, store.status(id, token));
        if (req.method === 'GET' && operation === 'results') return send(200, store.results(id, token));
        if (req.method === 'PUT' && operation === 'answers') return send(200, store.save(id, token, await bodyOf(req)));
        if (req.method === 'POST' && operation === 'submit') { await bodyOf(req); return send(200, store.submit(id, token)); }
      }
      send(404, { code: 'NOT_FOUND', message: '找不到這個操作。' });
    } catch (error) {
      if (error instanceof RoundError) send(error.status, { code: error.code, message: error.message });
      else {
        // 不輸出 request、答案、token 或 SQLite 綁定參數。
        console.error('API_INTERNAL_ERROR');
        send(500, { code: 'INTERNAL_ERROR', message: '暫時無法保存，請稍後重試。' });
      }
    }
  });
}
