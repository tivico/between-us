// 前端與建置共用的公開網址驗證；這裡不讀取瀏覽器環境。
export function normalizeApiBase(value = ''): string {
  if (!value.trim()) return '/api';
  const url = new URL(value.trim());
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || !url.hostname) {
    throw new Error('VITE_API_BASE_URL 必須是 HTTPS API 網址；只有本機測試可用 HTTP。');
  }
  if (url.pathname.replace(/\/$/, '') !== '/api') throw new Error('VITE_API_BASE_URL 請填寫以 /api 結尾的網址。');
  return `${url.origin}/api`;
}

export function normalizeSiteBase(value = '/'): string {
  if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(value) || value.split('/').some((part) => part === '.' || part === '..')) throw new Error('VITE_BASE_PATH 必須是 / 或 /repository/ 這類網站路徑。');
  return value;
}
