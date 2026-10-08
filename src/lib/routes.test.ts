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
    expect(parseRoute('#/trial/core-values')).toEqual({ page: 'trial', id: 'core-values' });
  });
  it('不把格式錯誤或額外路徑視為有效主題', () => {
    for (const path of ['#/topics/', '#/demo/a/extra', '#/trial/core-values/extra', '#/trial/', '#/unknown', '#/topics/%3Cscript%3E']) {
      expect(parseRoute(path)).toEqual({ page: 'not-found' });
    }
  });
  it('私人返回與邀請連結各自解析，不接受短憑證或額外路徑', () => {
    const token = 'a'.repeat(64);
    const id = '00000000-0000-4000-8000-000000000000';
    expect(parseRoute('#/history')).toEqual({ page: 'history' });
    expect(parseRoute('#/start/core-values')).toEqual({ page: 'start', id: 'core-values' });
    expect(parseRoute(`#/rounds/${id}/${token}`)).toEqual({ page: 'round', id, token });
    expect(parseRoute(`#/invite/${token}`)).toEqual({ page: 'invite', token });
    expect(parseRoute(`#/rounds/${id}/short`)).toEqual({ page: 'not-found' });
    expect(parseRoute(`#/invite/${token}/extra`)).toEqual({ page: 'not-found' });
  });
});
