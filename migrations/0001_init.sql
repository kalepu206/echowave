-- EchoWave database schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,              -- Firebase uid
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  banned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  content        TEXT NOT NULL DEFAULT '',
  place          TEXT,                       -- optional area / landmark typed by user
  lat            REAL,                       -- rounded to ~1 km for privacy
  lng            REAL,
  image_key      TEXT,
  image_alt      TEXT,                       -- AI-written description (accessibility)
  sentiment      REAL NOT NULL DEFAULT 0,    -- -1 .. 1
  spam_score     REAL NOT NULL DEFAULT 0,    -- 0 .. 1
  topics         TEXT NOT NULL DEFAULT '[]', -- JSON array
  urgent         INTEGER NOT NULL DEFAULT 0,
  moderated      INTEGER NOT NULL DEFAULT 1, -- 0 = AI was unavailable, needs review
  like_count     INTEGER NOT NULL DEFAULT 0,
  comment_count  INTEGER NOT NULL DEFAULT 0,
  report_count   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'live', -- live | hidden | removed
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_feed     ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user     ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_geo      ON posts(lat, lng);
CREATE INDEX IF NOT EXISTS idx_posts_trending ON posts(status, like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_expiry   ON posts(expires_at);

CREATE TABLE IF NOT EXISTS likes (
  post_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'live',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  post_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  user_id     TEXT NOT NULL,
  blocked_id  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,          -- who receives it
  type        TEXT NOT NULL,          -- like | comment | removed
  post_id     TEXT,
  actor_id    TEXT,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cache (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
