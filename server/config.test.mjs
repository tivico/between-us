import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { readHostedConfig } from './config.mjs';

const valid = { DATA_FILE: resolve('.local/hosted-test.sqlite'), ALLOWED_ORIGINS: 'https://couple.example.test', PORT: '8790' };
describe('雲端啟動設定', () => {
  it('需要明確資料位置與來源，支援多個完整來源', () => {
    const config = readHostedConfig({ ...valid, ALLOWED_ORIGINS: `${valid.ALLOWED_ORIGINS}, http://localhost:4173` });
    expect(config.allowedOrigins).toEqual(['https://couple.example.test', 'http://localhost:4173']);
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8790);
  });
  it('拒絕缺少資料位置與來源，避免默默使用暫存磁碟', () => {
    for (const DATA_FILE of ['', ':memory:', 'data/rounds.sqlite']) expect(() => readHostedConfig({ ...valid, DATA_FILE })).toThrow();
    expect(() => readHostedConfig({ ...valid, ALLOWED_ORIGINS: '' })).toThrow();
  });
  it('來源必須精確，不接受路徑、萬用字元、憑證與外網 HTTP', () => {
    for (const ALLOWED_ORIGINS of ['*', 'https://couple.example.test/', 'https://couple.example.test/repo', 'http://couple.example.test', 'https://user:pass@couple.example.test', 'null']) expect(() => readHostedConfig({ ...valid, ALLOWED_ORIGINS })).toThrow();
  });
  it('拒絕錯誤連接埠', () => {
    for (const PORT of ['0', '-1', '65536', 'abc', '3.5']) expect(() => readHostedConfig({ ...valid, PORT })).toThrow();
  });
});
