-- Sign-in with Google (replaces Firebase Authentication)

CREATE TABLE IF NOT EXISTS identities (
  user_id        TEXT PRIMARY KEY,           -- "google:<google account id>"
  provider       TEXT NOT NULL,
  email          TEXT,
  name           TEXT,
  created_at     INTEGER NOT NULL,
  last_login_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash     TEXT PRIMARY KEY,              -- SHA-256 of the cookie value (the raw value is never stored)
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
