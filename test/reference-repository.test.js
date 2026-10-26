import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
import {seedCatalog} from '../server/catalog-seed.js';
import {readFile} from 'node:fs/promises';
const definition={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,c:createCatalogRepository(db),r:createRepository(db)};}
test('upgrading the previous schema preserves original IDs, archive flags and document JSON',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());
 await db.execute('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');
 for(const [version,file] of [[1,'001-initial.sql'],[2,'002-catalog.sql']]){
  const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
  for(const statement of sql.split(';').filter(s=>s.trim()))await db.execute(statement);
  await db.execute({sql:'INSERT INTO schema_migrations VALUES(?,?)',args:[version,'before']});
 }
 await db.execute("INSERT INTO catalog_families(id,name) VALUES('old-ref','Old name')");
 await db.execute({sql:'INSERT INTO catalog_entries VALUES(?,?,?,?,?,?,1,1,?,?)',args:['old-variant','old-ref','Old exercise','Barbell','["Chest"]','[]','before','before']});
 const json='{"name":"Original","exercises":[],"goals":{}}';
 await db.execute({sql:'INSERT INTO documents VALUES(?,?,1,?,?,?)',args:['old-doc','template',json,'before','before']});
 await migrate(db);await migrate(db);
 const reference=await createCatalogRepository(db).getReference('old-ref');assert.equal(reference.name,'Old name');assert.equal(reference.archived,false);
 assert.equal((await db.execute("SELECT archived FROM catalog_entries WHERE id='old-variant'")).rows[0].archived,1);
 assert.equal((await db.execute("SELECT document_json FROM documents WHERE id='old-doc'")).rows[0].document_json,json);
});
test('reference CRUD supports empty groups and idempotent create, rename and archive replay',async t=>{
 const {c}=await setup(t);
 assert.equal((await c.createReference({id:'r',name:'  Press  '})).name,'Press');assert.equal((await c.createReference({id:'r',name:'Press'})).revision,1);
 for(const name of ['', 'a'.repeat(201)])await assert.rejects(c.createReference({id:'bad',name}),{code:'INVALID'});
 assert.equal((await c.updateReference({id:'r',revision:1,name:'Bench press'})).revision,2);
 assert.equal((await c.updateReference({id:'r',revision:1,name:'Bench press'})).revision,2);
 assert.equal((await c.archiveReference({id:'r',revision:2,archived:true})).archived,true);
 assert.equal((await c.archiveReference({id:'r',revision:2,archived:true})).revision,3);
 await assert.rejects(c.archiveReference({id:'r',revision:2,archived:false}),{code:'CONFLICT'});
 assert.equal((await c.archiveReference({id:'r',revision:3,archived:false})).archived,false);
 await assert.rejects(c.getReference('unknown'),{code:'NOT_FOUND'});
});
test('parent archives preserve individual flags, document revisions, existing links and verified copies',async t=>{
 const {c,r,db}=await setup(t);await c.createReference({id:'r',name:'Press'});
 const a=await c.create({id:'a',familyId:'r',entry:definition,referenceRevision:1});
 const b=await c.create({id:'b',familyId:'r',entry:{...definition,name:'Incline'}});
 await c.archive({id:'b',revision:b.revision,archived:true});
 const ex={...definition,sets:4,repRange:{min:6,max:8},catalogId:a.id,catalogRevision:a.revision,familyId:'r'};
 await r.create({id:'t',kind:'template',document:{name:'Upper',exercises:[ex],goals:{}}});
 let ref=await c.getReference('r');
 for(let i=0;i<2;i++){
  ref=await c.archiveReference({id:'r',revision:ref.revision,archived:true});
  const data=await c.list();assert.ok(data.entries.every(e=>e.archived));assert.equal(data.entries.find(e=>e.id==='a').individuallyArchived,false);
  assert.equal(Number((await db.execute("SELECT archived FROM catalog_entries WHERE id='a'")).rows[0].archived),0);
  assert.equal((await r.get('t')).revision,1);
  await assert.rejects(c.archive({id:'a',revision:a.revision,archived:false}),{code:'INVALID'});
  await assert.rejects(c.create({id:'new',familyId:'r',entry:{...definition,name:'New'}}),{code:'INVALID'});
  const copy=await r.create({id:'copy'+i,kind:'template',document:{name:'Copy',exercises:[ex],goals:{}},copyOf:'t'});assert.equal(copy.document.exercises[0].catalogId,'a');
  ref=await c.archiveReference({id:'r',revision:ref.revision,archived:false});
  const restored=await c.list();assert.equal(restored.entries.find(e=>e.id==='a').archived,false);assert.equal(restored.entries.find(e=>e.id==='b').archived,true);
 }
});
test('child mutations invalidate reference previews and seed reruns retain reference archives',async t=>{
 const {c,db}=await setup(t);await c.createReference({id:'r',name:'Press'});
 await c.create({id:'a',familyId:'r',entry:definition});
 await assert.rejects(c.archiveReference({id:'r',revision:1,archived:true}),{code:'CONFLICT'});
 await assert.rejects(c.create({id:'b',familyId:'r',referenceRevision:1,entry:{...definition,name:'Other'}}),{code:'CONFLICT'});
 const ref=await c.getReference('r');assert.equal(ref.revision,2);
 await c.archive({id:'a',revision:1,archived:true});assert.equal((await c.getReference('r')).revision,3);
 await assert.rejects(c.archiveReference({id:'r',revision:2,archived:true}),{code:'CONFLICT'});
 await seedCatalog(db);const seeded=(await c.list()).families.find(f=>f.id.startsWith('seed-'));
 await c.archiveReference({id:seeded.id,revision:seeded.revision,archived:true});await seedCatalog(db);
 assert.equal((await c.getReference(seeded.id)).archived,true);
});
test('archive previews never combine old children with a newer reference revision',async t=>{
 const {db,c}=await setup(t);await c.create({id:'a',familyId:'r',familyName:'Press',entry:definition});
 let applied=false,pending=false,signal;
 const written=new Promise(resolve=>{signal=resolve;});
 const add=async()=>{if(applied)return;await c.create({id:'b',familyId:'r',entry:{...definition,name:'Concurrent child'}});applied=true;signal();};
 const sqlOf=value=>typeof value==='string'?value:value.sql;
 const intercepted={
  async execute(statement){
   const sql=sqlOf(statement);
   if(sql.startsWith('SELECT id,name,revision,archived FROM catalog_families'))await written;
   const result=await db.execute(statement);
   if(sql.startsWith('SELECT e.*,f.name'))await add();
   return result;
  },
  async transaction(mode){
   const tx=await db.transaction(mode);
   return {execute:async statement=>{const result=await tx.execute(statement);if(sqlOf(statement).startsWith('SELECT e.*,f.name'))pending=true;return result;},commit:async()=>{await tx.commit();if(pending)await add();},close:()=>tx.close()};
  }
 };
 const preview=await createCatalogRepository(intercepted).list();
 if(!applied)await add();
 const ref=preview.families.find(r=>r.id==='r'),count=preview.entries.filter(e=>e.familyId==='r').length;
 assert.ok((count===1&&ref.revision===2)||(count===2&&ref.revision===3),'Preview children and parent revision must describe the same committed state.');
 if(count===1)await assert.rejects(c.archiveReference({id:'r',revision:ref.revision,archived:true}),{code:'CONFLICT'});
 else assert.equal((await c.archiveReference({id:'r',revision:ref.revision,archived:true})).archived,true);
});
