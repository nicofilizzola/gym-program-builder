CREATE TABLE workout_logs(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','finished')),started_at TEXT NOT NULL,finished_at TEXT,log_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX workout_logs_one_active ON workout_logs(status) WHERE status='active';
CREATE INDEX workout_logs_history ON workout_logs(status,started_at DESC,id DESC);
CREATE TABLE workout_log_variants(log_id TEXT NOT NULL,variant_id TEXT NOT NULL,finished_at TEXT NOT NULL,PRIMARY KEY(log_id,variant_id));
CREATE INDEX workout_log_variants_latest ON workout_log_variants(variant_id,finished_at DESC);
