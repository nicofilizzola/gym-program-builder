import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb,migrate} from '../server/db.js';
import {copyDatabase,EXCLUDED_TABLES} from '../server/copy-database.js';

const root=await mkdtemp(join(tmpdir(),'gym-copy-'));
after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
async function pair(t) {
 const dir=await mkdtemp(join(root,'pair-'));
 const source=createDb({url:`file:${join(dir,'source.db')}`}),target=createDb({url:`file:${join(dir,'target.db')}`});
 t.after(()=>{source.close();target.close();});
 await migrate(source);await migrate(target);
 await source.execute({sql:'INSERT INTO documents VALUES(?,?,?,?,?,?)',args:['t1','template',2,'{"name":"Upper","exercises":[],"goals":{}}','2026-11-01T00:00:00.000Z','2026-11-02T00:00:00.000Z']});
 await source.execute({sql:'INSERT INTO user_profile VALUES(1,3,?,?)',args:['{"trainingBackgroundAndApproach":"Lifting 5 years"}','2026-11-03T00:00:00.000Z']});
 await source.execute({sql:'INSERT INTO auth_sessions VALUES(?,?)',args:['hash',9999999999]});
 await source.execute({sql:'INSERT INTO login_attempts VALUES(?,?,?)',args:['1.2.3.4',2,1]});
 return {source,target};
}
const rows=async(db,sql)=>(await db.execute(sql)).rows.map(row=>({...row}));
const count=async(db,table)=>Number((await db.execute(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n);

test('copies every data table and returns counts',async t=>{
 const {source,target}=await pair(t);
 const result=await copyDatabase(source,target);
 assert.deepEqual(await rows(target,'SELECT * FROM documents'),await rows(source,'SELECT * FROM documents'));
 assert.deepEqual(await rows(target,'SELECT * FROM user_profile'),await rows(source,'SELECT * FROM user_profile'));
 assert.equal(result.documents,1);assert.equal(result.user_profile,1);
 for(const table of EXCLUDED_TABLES)assert.equal(table in result,false);
});

test('never copies sessions or login attempts',async t=>{
 const {source,target}=await pair(t);
 await copyDatabase(source,target);
 assert.equal(await count(target,'auth_sessions'),0);
 assert.equal(await count(target,'login_attempts'),0);
});

test("keeps the target's own schema_migrations",async t=>{
 const {source,target}=await pair(t);
 const before=await rows(target,'SELECT * FROM schema_migrations ORDER BY version');
 await copyDatabase(source,target);
 assert.deepEqual(before.map(r=>Number(r.version)),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(await rows(target,'SELECT * FROM schema_migrations ORDER BY version'),before);
});

test('refuses a target that already has data',async t=>{
 const {source,target}=await pair(t);
 await target.execute({sql:'INSERT INTO documents VALUES(?,?,?,?,?,?)',args:['x','template',1,'{}','2026-01-01','2026-01-01']});
 await assert.rejects(copyDatabase(source,target),/Target database is not empty: documents/);
 assert.equal(await count(target,'documents'),1);
 assert.equal(await count(target,'user_profile'),0);
});

test('refuses mismatched migration versions',async t=>{
 const {source,target}=await pair(t);
 await source.execute('DELETE FROM schema_migrations WHERE version=8');
 await assert.rejects(copyDatabase(source,target),/Migration versions differ/);
 assert.equal(await count(target,'documents'),0);
});

test('refuses a source table missing from the target',async t=>{
 const {source,target}=await pair(t);
 await target.execute('DROP TABLE workout_log_variants');
 await assert.rejects(copyDatabase(source,target),/Target is missing table workout_log_variants/);
 assert.equal(await count(target,'documents'),0);
});
