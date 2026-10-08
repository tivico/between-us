import { RoundStore } from '../server/store.mjs';
import { createApi } from '../server/http.mjs';
import { readHostedConfig } from '../server/config.mjs';

let store; let api;
try {
  const config = readHostedConfig();
  store = new RoundStore(config.dataFile);
  api = createApi(store, { allowedOrigins: config.allowedOrigins, mode: 'hosted-test' });
  await new Promise((done, reject) => { api.once('error', reject); api.listen(config.port, config.host, done); });
  console.log(`API_READY port=${config.port} mode=hosted-test`);
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    api.close(() => { store.close(); process.exit(0); });
    setTimeout(() => { api.closeAllConnections(); }, 5000).unref();
  });
} catch (error) {
  if (api?.listening) await new Promise((done) => api.close(done));
  store?.close();
  // 不輸出環境變數、token、答案或 request；設定錯誤只列固定訊息。
  console.error(`API_START_FAILED ${error.code || error.message}`);
  process.exitCode = 1;
}
