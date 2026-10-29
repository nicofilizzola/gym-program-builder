import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDb,migrate} from '../server/db.js';
import * as catalog from '../src/catalog.js';

test('metadata migration configures unanimous references and preserves conflicts for manual cleanup',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 for(const [version,file] of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql'],[5,'005-shared-sessions.sql']]){
  for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await db.execute(sql);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
 for(const id of ['one','mixed','empty'])await db.execute({sql:'INSERT INTO catalog_families(id,name,exercise_type) VALUES(?,?,?)',args:[id,id,'compound']});
 for(const [id,ref,equipment] of [['a','one','Barbell'],['b','mixed','Barbell'],['c','mixed','Dumbbell']])await db.execute({sql:'INSERT INTO catalog_entries(id,family_id,name,equipment,primary_json,secondary_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[id,ref,id,equipment,'["Chest"]','[]','before','before']});
 await migrate(db);const rows=(await db.execute('SELECT id,equipment,default_primary_json FROM catalog_families ORDER BY id')).rows;
 assert.deepEqual(rows.map(r=>[r.id,r.equipment]),[['empty',null],['mixed',null],['one','Barbell']]);
 assert.ok(rows.every(r=>r.default_primary_json==='[]'));assert.equal((await db.execute('SELECT * FROM catalog_equipment_backup')).rows.length,3);
 await db.execute("UPDATE catalog_families SET equipment='Machine',description='Chosen' WHERE id='mixed'");await migrate(db);
 assert.equal((await db.execute("SELECT description FROM catalog_families WHERE id='mixed'")).rows[0].description,'Chosen');
});
test('reference metadata validates single equipment and optional distinct default muscles',()=>{
 const ref={name:'Press',exerciseType:'compound',equipment:'Barbell',description:'<img>',defaultPrimaryMuscles:[],defaultSecondaryMuscles:[]};
 assert.ok(catalog.validateReference(ref).reference);
 for(const patch of [{equipment:undefined},{equipment:'Unknown'},{description:'x'.repeat(2001)},{defaultPrimaryMuscles:['Chest','Chest']},{defaultPrimaryMuscles:['Chest'],defaultSecondaryMuscles:['Chest']}])assert.ok(catalog.validateReference({...ref,...patch}).error);
 assert.ok(catalog.validateReference({...ref,description:'x'.repeat(2000)}).reference);
});
