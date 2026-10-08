import { describe, expect, it } from 'vitest';
import { normalizeApiBase, normalizeSiteBase } from './deployment-config';

describe('部署網址設定', () => {
  it('本機沿用代理，外部 API 使用明確網址', () => {
    expect(normalizeApiBase()).toBe('/api');
    expect(normalizeApiBase(' https://api.example.test/api/ ')).toBe('https://api.example.test/api');
    expect(normalizeApiBase('http://127.0.0.1:8790/api')).toBe('http://127.0.0.1:8790/api');
  });
  it('拒絕不安全協定、隱藏憑證、查詢字串與錯誤端點', () => {
    for (const value of ['http://api.example.test/api', 'https://user:password@example.test/api', 'https://example.test/api?token=secret', 'https://example.test/api#secret', 'https://example.test/', '//example.test/api', 'javascript:alert(1)']) {
      expect(() => normalizeApiBase(value)).toThrow();
    }
  });
  it('Pages 子路徑只接受網站路徑', () => {
    expect(normalizeSiteBase('/between-us/')).toBe('/between-us/');
    expect(normalizeSiteBase('/between.us/')).toBe('/between.us/');
    expect(normalizeSiteBase('/')).toBe('/');
    for (const value of ['between-us', '//', '/between-us', 'https://example.test/', '/../']) expect(() => normalizeSiteBase(value)).toThrow();
  });
});
