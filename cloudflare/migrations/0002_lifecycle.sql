-- 不回溯替既有回合設定期限；不修改快照或答案。
ALTER TABLE rounds ADD COLUMN expires_at TEXT;
ALTER TABLE participants ADD COLUMN withdrawn_at TEXT;
ALTER TABLE participants ADD COLUMN previous_token_hash TEXT;
CREATE INDEX rounds_expiry ON rounds(expires_at);
