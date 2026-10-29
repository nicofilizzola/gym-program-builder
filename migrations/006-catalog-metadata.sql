ALTER TABLE catalog_families ADD COLUMN equipment TEXT;
ALTER TABLE catalog_families ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE catalog_families ADD COLUMN default_primary_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE catalog_families ADD COLUMN default_secondary_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE catalog_entries ADD COLUMN description TEXT NOT NULL DEFAULT '';
CREATE TABLE catalog_equipment_backup(variant_id TEXT PRIMARY KEY,reference_id TEXT NOT NULL,equipment TEXT NOT NULL);
CREATE TABLE catalog_tags(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('brand','focus')),name TEXT NOT NULL,normalized_name TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,UNIQUE(kind,normalized_name));
CREATE TABLE catalog_variant_tags(variant_id TEXT NOT NULL REFERENCES catalog_entries(id),tag_id TEXT NOT NULL REFERENCES catalog_tags(id),PRIMARY KEY(variant_id,tag_id));
