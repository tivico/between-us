import { createServer, preview } from 'vite';
import { resolve } from 'node:path';
import { RoundStore } from '../server/store.mjs';
import { createApi } from '../server/http.mjs';

const dataFile = resolve('.local/data/between-us.sqlite');
const store = new RoundStore(dataFile);
const api = createApi(store);
let web;
async function stop() {
  if (web) await (web.close ? web.close() : new Promise((done) => web.httpServer.close(done)));
  await new Promise((done) => api.close(done));
  store.close();
}
try {
  await new Promise((done, reject) => { api.once('error', reject); api.listen(8787, '127.0.0.1', done); });
  web = process.argv.includes('--preview')
    ? await preview({ preview: { host: '127.0.0.1' } })
    : await createServer({ server: { host: '127.0.0.1' } });
  if (web.listen) await web.listen();
  console.log('本機雙人流程測試；三題示例尚未驗證，不提供契合分數。');
  console.log('API: http://127.0.0.1:8787  |  資料：.local/data/between-us.sqlite');
  web.printUrls();
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await stop();
    process.exit(0);
  });
} catch (error) {
  console.error(`啟動失敗：${error.code ?? error.message}`);
  await stop();
  process.exitCode = 1;
}
