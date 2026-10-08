import { normalizeApiBase } from '../src/lib/deployment-config.ts';

try {
  const base = normalizeApiBase(process.env.VITE_API_BASE_URL);
  const origin = process.env.SITE_ORIGIN;
  if (!base.startsWith('https://') || ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw new Error('先設定 repository 的 API_BASE_URL：必須是已上線的 HTTPS API，結尾 /api。');
  if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://')) throw new Error('SITE_ORIGIN 必須是 Pages 的 HTTPS origin。');
  const health = await fetch(`${base}/health`, { headers: { Origin: origin }, signal: AbortSignal.timeout(15000) });
  if (!health.ok || health.headers.get('access-control-allow-origin') !== origin) throw new Error('後端健康檢查／允許來源失敗。請確認服務已啟動，ALLOWED_ORIGINS 包含 Pages origin。');
  const data = await health.json();
  if (data.ok !== true || data.mode !== 'hosted-test') throw new Error('後端版本不符，請先部署 npm start 的 hosted-test API。');
  const preflight = await fetch(`${base}/rounds`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' }, signal: AbortSignal.timeout(15000) });
  if (preflight.status !== 204 || preflight.headers.get('access-control-allow-origin') !== origin) throw new Error('跨來源預檢未通過，請確認後端 CORS 設定。');
  console.log('HOSTED_API_CHECK_OK');
} catch (error) {
  console.error(`HOSTED_API_CHECK_FAILED: ${error.message}`);
  process.exitCode = 1;
}
