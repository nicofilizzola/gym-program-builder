import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';

const files=[[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql'],[5,'005-shared-sessions.sql'],[6,'006-catalog-metadata.sql']];
async function before007(db){
 for(const [version,file] of files){
  for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await db.execute(sql);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
}
const program=context=>({name:'P',mode:'schedule',goals:{},workouts:[],...(context?{context}:{})});
const insert=(db,id,kind,document,revision=3)=>db.execute({sql:'INSERT INTO documents VALUES(?,?,?,?,?,?)',args:[id,kind,revision,JSON.stringify(document),'before','before']});

test('migration 007 backs up and removes program training background, keeping other context',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await before007(db);
 await insert(db,'a','program',program({goalsAndPriorities:'Grow',constraintsAndPreferences:'60 min',trainingBackgroundAndApproach:'Five years'}));
 await insert(db,'b','program',program({goalsAndPriorities:'',trainingBackgroundAndApproach:'Beginner'}));
 await insert(db,'c','program',program());
 await insert(db,'d','program',program({goalsAndPriorities:'Keep',trainingBackgroundAndApproach:'  \n'}));
 await insert(db,'t','template',{name:'T',exercises:[],goals:{},context:{trainingBackgroundAndApproach:'Not a program'}});
 await migrate(db);
 const rows=Object.fromEntries((await db.execute('SELECT id,revision,document_json,updated_at FROM documents')).rows.map(r=>[r.id,{revision:Number(r.revision),document:JSON.parse(r.document_json),updatedAt:r.updated_at}]));
 assert.deepEqual(rows.a.document.context,{goalsAndPriorities:'Grow',constraintsAndPreferences:'60 min'});assert.equal(rows.a.revision,4);assert.notEqual(rows.a.updatedAt,'before');
 assert.equal(Object.hasOwn(rows.b.document,'context'),false);assert.equal(rows.b.revision,4);
 assert.equal(Object.hasOwn(rows.c.document,'context'),false);assert.equal(rows.c.revision,3);assert.equal(rows.c.updatedAt,'before');
 assert.equal(rows.d.revision,3);assert.equal(rows.d.document.context.trainingBackgroundAndApproach,'  \n');
 assert.equal(rows.t.revision,3);assert.equal(rows.t.document.context.trainingBackgroundAndApproach,'Not a program');
 const backup=(await db.execute('SELECT program_id,text,backed_up_at FROM program_context_background_backup ORDER BY program_id')).rows;
 assert.deepEqual(backup.map(r=>[r.program_id,r.text]),[['a','Five years'],['b','Beginner']]);assert.ok(backup.every(r=>r.backed_up_at));
 assert.equal((await db.execute('SELECT count(*) AS n FROM user_profile')).rows[0].n,0);
 assert.equal((await db.execute('SELECT max(version) AS v FROM schema_migrations')).rows[0].v,8);
 const repository=createRepository(db);assert.deepEqual((await repository.get('a')).document.context,{goalsAndPriorities:'Grow',constraintsAndPreferences:'60 min'});
 await migrate(db);assert.equal((await db.execute("SELECT revision FROM documents WHERE id='a'")).rows[0].revision,4);
 assert.equal((await db.execute('SELECT count(*) AS n FROM program_context_background_backup')).rows[0].n,2);
});

test('migration 007 rolls back schema, backup and document changes together on failure',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await before007(db);
 await insert(db,'a','program',program({trainingBackgroundAndApproach:'Five years'}));
 const failing={execute:db.execute.bind(db),async transaction(mode){const tx=await db.transaction(mode);return {execute(sql){if(typeof sql==='object'&&sql.sql.startsWith('UPDATE documents'))throw Error('injected background failure');return tx.execute(sql);},commit:tx.commit.bind(tx),close:tx.close.bind(tx)};}};
 await assert.rejects(migrate(failing),/injected background failure/);
 assert.equal((await db.execute("SELECT count(*) AS n FROM sqlite_master WHERE name IN ('user_profile','program_context_background_backup')")).rows[0].n,0);
 assert.equal(JSON.parse((await db.execute("SELECT document_json FROM documents WHERE id='a'")).rows[0].document_json).context.trainingBackgroundAndApproach,'Five years');
 assert.equal((await db.execute('SELECT max(version) AS v FROM schema_migrations')).rows[0].v,6);
});
