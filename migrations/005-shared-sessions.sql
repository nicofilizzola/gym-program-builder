CREATE TABLE program_template_links (
 program_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 occurrence_id TEXT NOT NULL,
 template_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
 PRIMARY KEY(program_id,occurrence_id)
);
CREATE INDEX program_template_links_template ON program_template_links(template_id);
CREATE TABLE shared_session_migration_map (
 program_id TEXT NOT NULL,
 occurrence_id TEXT NOT NULL,
 template_id TEXT NOT NULL,
 PRIMARY KEY(program_id,occurrence_id)
);
CREATE TABLE document_operations(id TEXT PRIMARY KEY,request_json TEXT NOT NULL,result_json TEXT NOT NULL);
