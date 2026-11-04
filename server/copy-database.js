export const EXCLUDED_TABLES=['schema_migrations','auth_sessions','login_attempts'];
const quote=name=>`"${name.replaceAll('"','""')}"`;
const tableNames=async db=>(await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")).rows.map(r=>r.name);
const versions=async db=>(await db.execute('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>Number(r.version)).join(',');
const count=async(db,table)=>Number((await db.execute(`SELECT count(*) AS n FROM ${quote(table)}`)).rows[0].n);

// Copies every data row from a migrated source into an empty target migrated to the same version.
// Sessions and login attempts are never copied; all checks run before anything is written.
export async function copyDatabase(source,target) {
  if(await versions(source)!==await versions(target))throw new Error('Migration versions differ between source and target.');
  const tables=(await tableNames(source)).filter(t=>!EXCLUDED_TABLES.includes(t)),targetTables=await tableNames(target);
  for(const table of tables)if(!targetTables.includes(table))throw new Error(`Target is missing table ${table}.`);
  const filled=[];
  for(const table of tables)if(await count(target,table))filled.push(table);
  if(filled.length)throw new Error(`Target database is not empty: ${filled.join(', ')}.`);
  const counts={},tx=await target.transaction('write');
  try {
    await tx.execute('PRAGMA defer_foreign_keys=ON');
    for(const table of tables) {
      const result=await source.execute(`SELECT * FROM ${quote(table)}`);
      const columns=result.columns.map(quote).join(','),marks=result.columns.map(()=>'?').join(',');
      for(const row of result.rows)await tx.execute({sql:`INSERT INTO ${quote(table)} (${columns}) VALUES (${marks})`,args:result.columns.map(c=>row[c])});
      const copied=Number((await tx.execute(`SELECT count(*) AS n FROM ${quote(table)}`)).rows[0].n);
      if(copied!==result.rows.length)throw new Error(`Row count mismatch in ${table}.`);
      counts[table]=copied;
    }
    await tx.commit();
  } finally {tx.close();}
  return counts;
}
