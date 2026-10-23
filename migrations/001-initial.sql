CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE documents(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('template','program')), revision INTEGER NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE login_attempts(bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL);
