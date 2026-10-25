CREATE TABLE catalog_families (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE catalog_entries (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES catalog_families(id),
  name TEXT NOT NULL, equipment TEXT NOT NULL, primary_json TEXT NOT NULL,
  secondary_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX catalog_family_name ON catalog_entries(family_id, lower(name));
CREATE TABLE catalog_seed_versions (version INTEGER PRIMARY KEY);
