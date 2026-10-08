const key = 'between-us:recent-rounds:v1';
export interface RecentRound { id: string; token: string; title: string; nickname: string; createdAt: string }
export function recentRounds(): RecentRound[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RecentRound => item && typeof item.id === 'string' && /^[a-f0-9-]{36}$/.test(item.id) && typeof item.token === 'string' && /^[a-f0-9]{64}$/.test(item.token) && typeof item.title === 'string' && typeof item.nickname === 'string' && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))).slice(0, 20);
  } catch { return []; }
}
export function rememberRound(round: RecentRound): boolean {
  try {
    localStorage.setItem(key, JSON.stringify([round, ...recentRounds().filter((item) => item.id !== round.id || item.token !== round.token)].slice(0, 20)));
    return true;
  } catch { return false; }
}
export function forgetRound(id: string, token: string): void {
  localStorage.setItem(key, JSON.stringify(recentRounds().filter((item) => item.id !== id || item.token !== token)));
}
export function roundPath(id: string, token: string): string { return `#/rounds/${id}/${token}`; }
export function absoluteLink(path: string): string { return `${location.origin}${location.pathname}${path}`; }
