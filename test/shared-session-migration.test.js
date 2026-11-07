import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDb,migrate} from '../server/db.js';

async function legacy(t){
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 await db.execute('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');
 for(const [version,file]of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql']]){
  const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
  for(const statement of sql.split(';').filter(s=>s.trim()))await db.execute(statement);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
 return db;
}
const exercise={name:'Bench',sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],catalogId:'archived',catalogRevision:3,familyId:'reference',equipment:'Barbell'};
const workout={name:'',exercises:[exercise],goals:{Chest:4},extraMinutes:15,bufferPercent:25};
const old={name:'Week',mode:'simple',goals:{Chest:8},workouts:[{...workout,id:'a',day:0},{...workout,id:'b',day:null}],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'}]};
async function insert(db){await db.execute({sql:'INSERT INTO documents VALUES(?,?,7,?,?,?)',args:['p','program',JSON.stringify(old),'before','before']});}
test('migration preserves independent legacy drafts and timing and is idempotent',async t=>{
 const db=await legacy(t);await insert(db);await migrate(db);
 const rows=(await db.execute('SELECT * FROM documents')).rows;
 const program=rows.find(r=>r.id==='p'),value=JSON.parse(program.document_json);
 assert.equal(program.revision,8);
 assert.notEqual(value.workouts[0].templateId,value.workouts[1].templateId);
 assert.deepEqual(value.sequence,old.sequence);
 assert.deepEqual(value.workouts.map(w=>[w.id,w.day]),[['a',0],['b',null]]);
 for(const w of value.workouts){assert.deepEqual(Object.keys(w).sort(),['day','id','templateId']);assert.deepEqual(JSON.parse(rows.find(r=>r.id===w.templateId).document_json),{...workout,coverId:'gym',exercises:[{...exercise,warmupSets:0}]});}
 assert.equal((await db.execute('SELECT * FROM program_template_links')).rows.length,2);
 await migrate(db);assert.deepEqual((await db.execute('SELECT * FROM documents ORDER BY id')).rows,[...rows].sort((a,b)=>a.id.localeCompare(b.id)));
 await assert.rejects(db.execute({sql:'DELETE FROM documents WHERE id=?',args:[value.workouts[0].templateId]}),/FOREIGN KEY/i);
});
test('conversion failure rolls back all new templates and migration version',async t=>{
 const db=await legacy(t);await insert(db);
 await db.execute("CREATE TRIGGER reject_second_template BEFORE INSERT ON documents WHEN NEW.kind='template' AND (SELECT count(*) FROM documents WHERE kind='template')>0 BEGIN SELECT RAISE(ABORT,'injected conversion failure'); END");
 await assert.rejects(migrate(db),/injected conversion failure/);
 assert.equal((await db.execute('SELECT * FROM documents')).rows.length,1);
 assert.deepEqual(JSON.parse((await db.execute("SELECT document_json FROM documents WHERE id='p'")).rows[0].document_json),old);
 assert.equal((await db.execute('SELECT max(version) AS version FROM schema_migrations')).rows[0].version,4);
});
