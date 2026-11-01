CREATE TABLE user_profile(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,profile_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE program_context_background_backup(program_id TEXT PRIMARY KEY,text TEXT NOT NULL,backed_up_at TEXT NOT NULL);
