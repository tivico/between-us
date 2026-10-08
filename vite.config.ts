import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeApiBase, normalizeSiteBase } from './src/lib/deployment-config.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  normalizeApiBase(env.VITE_API_BASE_URL);
  return {
    base: normalizeSiteBase(env.VITE_BASE_PATH || '/'),
    plugins: [react()],
    server: {
      port: 5173, strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:8787' },
      headers: { 'Referrer-Policy': 'no-referrer' },
      forwardConsole: false,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**'] },
    },
    preview: {
      port: 4173, strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:8787' },
      headers: { 'Referrer-Policy': 'no-referrer' },
    },
  };
});
