// 僅提供建置後公開資產；不連接任何資料庫。共同頻寬＋每請求延遲的模擬，不是實體手機測量。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 5405);
const bytesPerSecond = 200000, latencyMs = 150;
let wireAvailable = 0;
const delay = (ms) => new Promise((done) => setTimeout(done, Math.max(0, ms)));
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (process.argv.includes('--deny-exploration') && /^\/assets\/ExplorationPage-.*\.js$/.test(pathname)) { res.writeHead(503); res.end(); return; }
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const segment = relative(root, target);
    if (segment.startsWith('..') || isAbsolute(segment) || !['.html','.js','.css','.svg','.png','.jpg','.ico','.woff2'].includes(extname(target))) { res.writeHead(404); res.end(); return; }
    let data = await readFile(target);
    if (extname(target) === '.html') data = Buffer.from(data.toString().replace('</head>', `<script>
      (() => {
        let readyMs = null;
        const publish = () => {
          const nav = performance.getEntriesByType('navigation')[0];
          const assets = performance.getEntriesByType('resource').filter(e => e.name.includes('/assets/'));
          const report = { readyMs, fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
            assetBytes: assets.reduce((s,e) => s + e.encodedBodySize,0), jsBytes: assets.filter(e => e.name.endsWith('.js')).reduce((s,e) => s + e.encodedBodySize,0), loadMs: nav.loadEventEnd };
          let output = document.getElementById('perf-observation');
          if (!output) { output = document.createElement('pre'); output.id = 'perf-observation'; output.dataset.testid = 'perf-observation'; output.style.cssText = 'position:fixed;bottom:0;left:0;font:10px monospace;background:white;z-index:9999;white-space:pre-wrap'; document.body.append(output); }
          output.textContent = JSON.stringify(report);
        };
        const observer = new MutationObserver(() => {
          if (!document.querySelector('#start-guide')) return;
          observer.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => { readyMs = performance.now(); publish(); }));
        });
        observer.observe(document.documentElement,{childList:true,subtree:true});
        addEventListener('load',() => setTimeout(() => { if (readyMs !== null) publish(); },0));
      })();
    </script></head>`));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(target)] || 'application/octet-stream';
    const compressed = /gzip/.test(req.headers['accept-encoding'] || '') ? gzipSync(data) : data;
    await delay(latencyMs);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': compressed.length, ...(compressed !== data ? { 'Content-Encoding': 'gzip' } : {}) });
    for (let offset = 0; offset < compressed.length && !res.destroyed; offset += 16384) {
      const chunk = compressed.subarray(offset, offset + 16384);
      wireAvailable = Math.max(wireAvailable, Date.now()) + chunk.length / bytesPerSecond * 1000;
      await delay(wireAvailable - Date.now()); res.write(chunk);
    }
    res.end();
  } catch { res.writeHead(404); res.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`PERF_READY port=${port} bandwidth=1.6Mbps latency=150ms`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
