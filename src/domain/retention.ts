// 固定於建立時間；更改常數只影響新回合，舊 expires_at 不重算。
export const retentionDays = 180;
export const retentionMilliseconds = retentionDays * 24 * 60 * 60 * 1000;
export function expiryFrom(now: number): string { return new Date(now + retentionMilliseconds).toISOString(); }
