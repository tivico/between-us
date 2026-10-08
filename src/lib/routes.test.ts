import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes';

describe('直接連結與路由', () => {
  it('沒有 hash 或首頁路徑時進入主題館', () => {
    expect(parseRoute('')).toEqual({ page: 'catalog' });
    expect(parseRoute('#/')).toEqual({ page: 'catalog' });
  });
  it('支援主題介紹與介面預覽的直接連結', () => {
    expect(parseRoute('#/topics/core-values')).toEqual({ page: 'topic', id: 'core-values' });
    expect(parseRoute('#/demo/core-values')).toEqual({ page: 'demo', id: 'core-values' });
  });
  it('不把格式錯誤或額外路徑視為有效主題', () => {
    for (const path of ['#/topics/', '#/demo/a/extra', '#/unknown', '#/topics/%3Cscript%3E']) {
      expect(parseRoute(path)).toEqual({ page: 'not-found' });
    }
  });
});
