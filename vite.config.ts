import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
