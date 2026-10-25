import {createClient} from '@libsql/client';
import {readFile} from 'node:fs/promises';
export const createDb=options=>createClient(options);
export async function migrate(db) {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const tx=await db.transaction('write');
  try {
    for(const [version,file] of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql']]) {
    const result=await tx.execute({sql:'SELECT version FROM schema_migrations WHERE version=?',args:[version]});
    if(!result.rows.length) {
      const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      for(const statement of sql.split(';').filter(s=>s.trim())) await tx.execute(statement);
      await tx.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,new Date().toISOString()]});
    }
    }
    await tx.commit();
  } finally {tx.close();}
}
