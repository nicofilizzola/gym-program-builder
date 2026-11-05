import {createClient} from '@libsql/client';
import {readFile} from 'node:fs/promises';
import {migrateSharedSessions} from './migrate-shared-sessions.js';
import {migrateCatalogMetadata} from './migrate-catalog-metadata.js';
import {migrateProgramBackground} from './migrate-program-background.js';
export const createDb=options=>createClient(options);
export async function migrate(db) {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const tx=await db.transaction('write');
  try {
    for(const [version,file] of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql'],[5,'005-shared-sessions.sql'],[6,'006-catalog-metadata.sql'],[7,'007-user-profile.sql'],[8,'008-workout-logs.sql'],[9,'009-app-settings.sql']]) {
    const result=await tx.execute({sql:'SELECT version FROM schema_migrations WHERE version=?',args:[version]});
    if(!result.rows.length) {
      const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      for(const statement of sql.split(';').filter(s=>s.trim())) await tx.execute(statement);
      if(version===5)await migrateSharedSessions(tx);
      if(version===6)await migrateCatalogMetadata(tx);
      if(version===7)await migrateProgramBackground(tx);
      await tx.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,new Date().toISOString()]});
    }
    }
    await tx.commit();
  } finally {tx.close();}
}
