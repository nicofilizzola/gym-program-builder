import {createClient} from '@libsql/client';
import {readFile} from 'node:fs/promises';
export const createDb=options=>createClient(options);
export async function migrate(db) {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const tx=await db.transaction('write');
  try {
    const result=await tx.execute('SELECT version FROM schema_migrations WHERE version=1');
    if(!result.rows.length) {
      const sql=await readFile(new URL('../migrations/001-initial.sql',import.meta.url),'utf8');
      for(const statement of sql.split(';').filter(s=>s.trim())) await tx.execute(statement);
      await tx.execute({sql:'INSERT INTO schema_migrations VALUES(1,?)',args:[new Date().toISOString()]});
    }
    await tx.commit();
  } finally {tx.close();}
}
