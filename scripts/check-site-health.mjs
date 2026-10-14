import { pathToFileURL } from 'node:url';

export async function checkSiteHealth(input, { fetcher = fetch } = {}) {
  const site = new URL(input);
  if (site.username || site.password || site.search || site.hash || site.pathname !== '/' || (site.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(site.hostname))) throw new Error('INVALID_MONITOR_URL');
  const request = async (path) => {
    const response = await fetcher(new URL(path, site), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('HEALTH_HTTP_FAILED');
    return response;
  };
  const api = await request('/api/health');
  const health = await api.json();
  if (health.ok !== true || api.headers.get('cache-control') !== 'no-store') throw new Error('HEALTH_API_FAILED');
  const html = await (await request('/')).text();
  const script = /<script[^>]+src="(\/assets\/[^"\s]+\.js)"/.exec(html)?.[1];
  const style = /<link[^>]+href="(\/assets\/[^"\s]+\.css)"/.exec(html)?.[1];
  if (!html.includes('id="root"') || !script || !style) throw new Error('HEALTH_ASSETS_MISSING');
  for (const [path, type] of [[script, 'javascript'], [style, 'text/css']]) {
    const response = await request(path);
    if (!response.headers.get('content-type')?.includes(type)) throw new Error('HEALTH_ASSET_TYPE');
    await response.arrayBuffer();
  }
  return { ok: true, version: typeof health.version === 'string' && /^0\.\d+\.\d+$/.test(health.version) ? health.version : 'not-reported' };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let success = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const result = await checkSiteHealth(process.argv[2] || 'https://between-us.forest-between-us.workers.dev/'); console.log(`SITE_HEALTH_OK version=${result.version}`); success = true; break; }
    catch { if (attempt < 2) await new Promise((done) => setTimeout(done, 3000)); }
  }
  if (!success) { console.error('SITE_HEALTH_FAILED: API或公開資產連續三次檢查失敗。'); process.exitCode = 1; }
}
