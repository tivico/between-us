CREATE TABLE rounds (
  id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL, invite_hash TEXT UNIQUE
);
CREATE TABLE participants (
  round_id TEXT NOT NULL REFERENCES rounds(id), slot TEXT NOT NULL CHECK(slot IN ('A','B')),
  token_hash TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, consent_at TEXT NOT NULL,
  submitted_at TEXT, answers TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(round_id, slot)
);
