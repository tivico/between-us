import { apiBase } from './deployment';

export class ApiError extends Error {
  constructor(public code: string, message: string, public requestId?: string) { super(message); }
}
export async function api<T>(path: string, { token, method = 'GET', body }: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError('NETWORK_ERROR', '目前連不上保存服務，請確認服務已啟動，再重試。'); }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError('SERVICE_UNAVAILABLE', '保存服務尚未啟動或回應異常，請稍後重試。'); }
  if (!response.ok) {
    const id = response.headers.get('X-Request-ID') ?? '';
    throw new ApiError(typeof data.code === 'string' ? data.code : 'UNKNOWN', typeof data.message === 'string' ? data.message : '操作失敗，請稍後重試。', /^[a-f0-9-]{36}$/.test(id) ? id : undefined);
  }
  return data as T;
}
export function createPrivateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function messageOf(error: unknown): string {
  if (error instanceof ApiError && error.requestId && ['INTERNAL_ERROR','READINESS_FAILED'].includes(error.code)) return `${error.message}（服務代碼：${error.requestId}）`;
  return error instanceof Error ? error.message : '暫時無法完成，請稍後重試。';
}
