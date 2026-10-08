import { isAbsolute } from 'node:path';

export function readHostedConfig(env = process.env) {
  const port = Number(env.PORT || '8787');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必須介於 1–65535。');
  if (!env.DATA_FILE || !isAbsolute(env.DATA_FILE)) throw new Error('DATA_FILE 必須明確指定持久儲存磁碟上的 SQLite 絕對路徑。');
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length) throw new Error('ALLOWED_ORIGINS 必須指定允許的網站來源。');
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('ALLOWED_ORIGINS 含無效的網站來源。'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('ALLOWED_ORIGINS 只能包含 HTTPS origin；不含路徑、尾斜線或萬用字元。本機測試可用 HTTP。');
    }
  }
  return { port, host: env.API_HOST || '0.0.0.0', dataFile: env.DATA_FILE, allowedOrigins: origins };
}
