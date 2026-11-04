import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDb,migrate} from '../server/db.js';
import * as catalog from '../src/catalog.js';
import {createRepository} from '../server/repository.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {equipmentReport} from '../scripts/catalog-equipment-report.js';

test('metadata migration configures unanimous references and preserves conflicts for manual cleanup',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 for(const [version,file] of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql'],[5,'005-shared-sessions.sql']]){
  for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await db.execute(sql);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
 for(const id of ['one','mixed','empty'])await db.execute({sql:'INSERT INTO catalog_families(id,name,exercise_type) VALUES(?,?,?)',args:[id,id,'compound']});
 for(const [id,ref,equipment] of [['a','one','Barbell'],['b','mixed','Barbell'],['c','mixed','Dumbbell']])await db.execute({sql:'INSERT INTO catalog_entries(id,family_id,name,equipment,primary_json,secondary_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[id,ref,id,equipment,'["Chest"]','[]','before','before']});
 const workout={name:'Existing',goals:{},exercises:[{name:'b',sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],catalogId:'b',catalogRevision:1,familyId:'mixed',equipment:'Barbell'}]};
 await db.execute({sql:'INSERT INTO documents VALUES(?,?,1,?,?,?)',args:['t','template',JSON.stringify(workout),'before','before']});
 await migrate(db);const rows=(await db.execute('SELECT id,equipment,default_primary_json FROM catalog_families ORDER BY id')).rows;
 assert.deepEqual(rows.map(r=>[r.id,r.equipment]),[['empty',null],['mixed',null],['one','Barbell']]);
 assert.ok(rows.every(r=>r.default_primary_json==='[]'));assert.equal((await db.execute('SELECT * FROM catalog_equipment_backup')).rows.length,3);
 const report=await equipmentReport(db);assert.deepEqual(report.map(r=>[r.id,r.equipmentValues]),[['empty',[]],['mixed',['Barbell','Dumbbell']]]);
 const repository=createRepository(db),c=createCatalogRepository(db),existing=await repository.get('t');
 await repository.update({id:'t',revision:1,document:{...existing.document,name:'Retained'}});assert.equal((await repository.get('t')).document.exercises[0].equipment,'Barbell');
 await repository.create({id:'copy',kind:'template',copyOf:'t',document:existing.document});
 await assert.rejects(repository.create({id:'new',kind:'template',document:existing.document}),{code:'INVALID'});
 await assert.rejects(c.create({id:'new-variant',familyId:'mixed',entry:{name:'New',primaryMuscles:['Chest'],secondaryMuscles:[]}}),{code:'INVALID'});
 const reference=await c.getReference('mixed');await c.updateReference({...reference,equipment:'Machine',description:'Chosen',impact:await c.referenceImpact('mixed')});
 assert.equal((await repository.get('t')).document.exercises[0].restSeconds,45);assert.equal((await repository.get('t')).document.exercises[0].equipment,'Machine');
 await migrate(db);assert.deepEqual((await equipmentReport(db)).map(r=>r.id),['empty']);
 assert.equal((await db.execute("SELECT description FROM catalog_families WHERE id='mixed'")).rows[0].description,'Chosen');
});

test('metadata migration rolls back schema and backup insertion together on failure',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 for(const [version,file]of [[1,'001-initial.sql'],[2,'002-catalog.sql'],[3,'003-reference-exercises.sql'],[4,'004-workout-timing.sql'],[5,'005-shared-sessions.sql']]){
  for(const sql of(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await db.execute(sql);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
 const failing={execute:db.execute.bind(db),async transaction(mode){const tx=await db.transaction(mode);return {execute(sql){if(typeof sql==='string'&&sql.startsWith('INSERT INTO catalog_equipment_backup'))throw Error('injected metadata failure');return tx.execute(sql);},commit:tx.commit.bind(tx),close:tx.close.bind(tx)};}};
 await assert.rejects(migrate(failing),/injected metadata failure/);
 assert.equal((await db.execute('PRAGMA table_info(catalog_families)')).rows.some(r=>r.name==='equipment'),false);
 assert.equal((await db.execute('SELECT max(version) AS v FROM schema_migrations')).rows[0].v,5);
});
test('reference metadata validates single equipment and optional distinct default muscles',()=>{
 const ref={name:'Press',exerciseType:'compound',equipment:'Barbell',description:'<img>',defaultPrimaryMuscles:[],defaultSecondaryMuscles:[]};
 assert.ok(catalog.validateReference(ref).reference);
 for(const patch of [{equipment:undefined},{equipment:'Unknown'},{description:'x'.repeat(2001)},{defaultPrimaryMuscles:['Chest','Chest']},{defaultPrimaryMuscles:['Chest'],defaultSecondaryMuscles:['Chest']}])assert.ok(catalog.validateReference({...ref,...patch}).error);
 assert.ok(catalog.validateReference({...ref,description:'x'.repeat(2000)}).reference);
});

test('migrations avoid HAVING without GROUP BY, which the remote Turso parser rejects',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 const statements=[],record=target=>new Proxy(target,{get:(o,key)=>key==='execute'?(stmt=>{statements.push(typeof stmt==='string'?stmt:stmt.sql);return o.execute(stmt);}):typeof o[key]==='function'?o[key].bind(o):o[key]});
 await migrate(new Proxy(db,{get:(o,key)=>key==='transaction'?async mode=>record(await o.transaction(mode)):typeof o[key]==='function'?o[key].bind(o):o[key]}));
 assert.ok(statements.length>8);
 for(const sql of statements)assert.ok(!/\bHAVING\b/i.test(sql)||/\bGROUP\s+BY\b/i.test(sql),sql);
});
