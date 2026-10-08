import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetRound, recentRounds, rememberRound, type RecentRound } from './history';

let data: Map<string, string>;
const record: RecentRound = {
  id: '00000000-0000-4000-8000-000000000000', token: 'a'.repeat(64),
  title: '測試', nickname: '人', createdAt: '2026-10-08T00:00:00.000Z',
};
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
describe('此裝置的最近入口', () => {
  it('同一參與者重新開啟時不重複，兩人的入口彼此獨立', () => {
    rememberRound(record); rememberRound(record);
    rememberRound({ ...record, token: 'b'.repeat(64) });
    expect(recentRounds()).toHaveLength(2);
    forgetRound(record.id, record.token);
    expect(recentRounds().map((item) => item.token)).toEqual(['b'.repeat(64)]);
  });
  it('忽略破損或不合法入口，不組成任意外部連結', () => {
    data.set('between-us:recent-rounds:v1', JSON.stringify([{ ...record, id: 'https://unrelated.example' }, record]));
    expect(recentRounds()).toEqual([record]);
    data.set('between-us:recent-rounds:v1', '{');
    expect(recentRounds()).toEqual([]);
  });
  it('儲存被禁止時明確回報失敗，讀取仍可安全顯示空列表', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(recentRounds()).toEqual([]);
    expect(rememberRound(record)).toBe(false);
  });
});
