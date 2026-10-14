import { createHash, randomUUID } from 'node:crypto';
import release from '../package.json' with { type: 'json' };

export const releaseVersion = release.version;
export const creationLimit = { limit: 30, period: 60 };
const operations = new Set(['health', 'create', 'preview', 'claim', 'status', 'answers', 'submit', 'results', 'withdraw', 'rotate']);
export function operationOf(path) {
  if (path === '/api/health') return 'health';
  if (path === '/api/rounds') return 'create';
  if (path === '/api/invitations/preview') return 'preview';
  if (path === '/api/invitations/claim') return 'claim';
  return /^\/api\/rounds\/[a-f0-9-]{36}\/(status|answers|submit|results|withdraw|rotate)$/.exec(path)?.[1] ?? 'unknown';
}
export function requestId() { return randomUUID(); }
export function creationKey(address) {
  // 匿名建立沒有帳號，暫用來源網路的短期雜湊作突發保護；不記錄IP。
  return `between-us:create:v1:${createHash('sha256').update(address || 'unavailable').digest('hex')}`;
}
export function observeApi({ operation, status, code, started, id }, emit = console.log) {
  // 僅允許這些欄位；不接收URL、headers、body、round ID、錯誤物件或IP。
  emit(JSON.stringify({ event: 'api', requestId: /^[a-f0-9-]{36}$/.test(id ?? '') ? id : 'unavailable',
    operation: operations.has(operation) ? operation : 'unknown', status: Number.isInteger(status) ? status : 500,
    code: /^[A-Z_]{2,40}$/.test(code ?? '') ? code : 'UNKNOWN', elapsedMs: Math.max(0, Date.now() - started) }));
}
export function createCreationLimiter({ limit = creationLimit.limit, period = creationLimit.period, now = () => Date.now(), maxKeys = 10000 } = {}) {
  const entries = new Map();
  return (key) => {
    const time = now();
    const previous = entries.get(key);
    if (!previous || previous.reset <= time) {
      if (entries.size >= maxKeys) for (const [actor, entry] of entries) if (entry.reset <= time) entries.delete(actor);
      if (entries.size >= maxKeys && !previous) return false;
      entries.set(key, { count: 1, reset: time + period * 1000 }); return true;
    }
    if (previous.count >= limit) return false;
    previous.count++; return true;
  };
}
