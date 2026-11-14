import {resolveProgram} from '../src/program-links.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
const entry={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,c:createCatalogRepository(db),r:createRepository(db)};}
test('catalog creation is idempotent and archive does not destroy family identity',async t=>{
 const {c}=await setup(t);const args={id:'bench',familyId:'press',referenceExerciseType:'compound',familyName:'Bench press',entry};
 const e=await c.create(args);assert.equal(e.revision,1);assert.equal((await c.create(args)).id,'bench');
 await assert.rejects(c.create({...args,id:'duplicate',entry:{...entry,name:'bENCH'}}),{code:'CONFLICT'});
 await c.create({...args,id:'incline',entry:{...entry,name:'Incline bench'}});
 let archived=await c.archive({id:e.id,revision:1,archived:true});assert.equal(archived.archived,true);
 await assert.rejects(c.archive({id:e.id,revision:1,archived:false}),{code:'CONFLICT'});
 assert.equal((await c.archive({id:e.id,revision:archived.revision,archived:false})).familyId,'press');
 assert.equal((await c.list()).entries.length,2);
});
test('a failed propagation transaction rolls back both definitions and document revisions',async t=>{
 const {c,r,db}=await setup(t);await c.create({id:'bench',familyId:'press',referenceExerciseType:'compound',familyName:'Press',entry});
 const linked={...entry,sets:3,repRange:{min:8,max:12},catalogId:'bench',catalogRevision:1,familyId:'press'};
 await r.create({id:'t',kind:'template',document:{name:'Upper',exercises:[linked],goals:{}}});
 await db.execute("CREATE TRIGGER reject_propagation BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'test write failure'); END");
 await assert.rejects(c.update({id:'bench',revision:1,entry:{...entry,name:'Changed'},impact:await c.impact('bench')}));
 const catalog=await c.list();assert.equal(catalog.entries[0].name,'Bench');assert.equal(catalog.entries[0].revision,1);assert.equal((await r.get('t')).revision,1);
});
test('catalog edits atomically update each linked document once and protect impact previews',async t=>{
 const {c,r,db}=await setup(t);await c.create({id:'bench',familyId:'press',referenceExerciseType:'compound',familyName:'Bench press',entry});
 const ex={...entry,sets:4,repRange:{min:6,max:8},catalogId:'bench',catalogRevision:1,familyId:'press'};
 const template={name:'Upper',exercises:[ex],goals:{Chest:8}};
 await r.create({id:'t',kind:'template',document:template});
 const program={name:'Week',mode:'schedule',goals:{},workouts:[{id:'w1',templateId:'t',day:0},{id:'w2',templateId:'t',day:null}]};
 await r.create({id:'p',kind:'program',document:program});
 const impact=await c.impact('bench');assert.deepEqual(impact,[{id:'t',revision:1,count:1}]);
 await r.update({id:'t',revision:1,document:{...template,name:'Changed'}});
 await db.execute({sql:'UPDATE documents SET document_json=? WHERE id=?',args:[JSON.stringify({...template,name:'Changed'}),'t']});
 await assert.rejects(c.update({id:'bench',revision:1,entry:{...entry,primaryMuscles:['Front delts']},impact}),{code:'CONFLICT'});
 const changed=await c.update({id:'bench',revision:1,entry:{...entry,name:'Bench corrected',primaryMuscles:['Front delts']},impact:await c.impact('bench')});
 assert.equal(changed.revision,2);
 const bundle=await r.programBundle('p'),p={...bundle.record,document:resolveProgram(bundle.record.document,bundle.templates)};assert.equal(p.revision,1);assert.equal(p.document.workouts[1].day,null);assert.equal(p.document.workouts[0].exercises[0].sets,4);assert.equal(p.document.workouts[0].exercises[0].name,'Bench corrected');
 assert.deepEqual(p.document.workouts[0].exercises[0].primaryMuscles,['Front delts']);
 await assert.rejects(r.update({id:'t',revision:1,document:{...template,name:'Stale edit'}}),{code:'CONFLICT'});
});

const duplicateVariant={code:'CONFLICT',message:'A variant with this name and the same tags already exists in this reference exercise, possibly archived. Change the name or a tag.',details:{field:'name',reason:'duplicate-variant'}};
async function sameNameFixture(t){
 const f=await setup(t);
 await f.c.createReference({id:'press',name:'Press',exerciseType:'compound',equipment:'Barbell'});
 for(const [id,kind] of [['hammer','brand'],['technogym','brand'],['stretch','focus'],['upper','focus']])await f.c.createTag({id,kind,name:id});
 return {...f,create:(id,brandId=null,focusTagIds=[],extra={})=>f.c.create({id,familyId:'press',entry:{...entry,name:'Chest press',brandId,focusTagIds},...extra})};
}
test('same-name variants need different tags',async t=>{
 const {c,create}=await sameNameFixture(t);
 await create('bare');await create('hammer','hammer');
 await assert.rejects(create('duplicate','hammer'),duplicateVariant);
 await assert.rejects(create('accent','hammer',[],{entry:{...entry,name:'Chest Préss',brandId:'hammer'}}),duplicateVariant);
 const tech=await create('tech','technogym');await c.archive({id:tech.id,revision:tech.revision,archived:true});
 await assert.rejects(create('archived','technogym'),duplicateVariant);
 await create('focused','hammer',['stretch','upper']);
 await assert.rejects(create('reordered','hammer',['upper','stretch']),duplicateVariant);
 await c.archiveTag({id:'hammer',revision:1,archived:true});
 await assert.rejects(create('archived-brand','hammer'),duplicateVariant);
});
test('create from and edit apply the same rule without self-conflict',async t=>{
 const {c,create}=await sameNameFixture(t);await create('bare');await create('hammer','hammer');
 await assert.rejects(create('copy','hammer',[],{sourceVariantId:'hammer'}),duplicateVariant);
 await create('focused','hammer',['stretch'],{sourceVariantId:'hammer'});
 await assert.rejects(c.update({id:'bare',revision:1,entry:{...entry,name:'Chest press',brandId:'hammer'},impact:[]}),duplicateVariant);
 const edited=await c.update({id:'hammer',revision:1,entry:{...entry,name:'Chest press',brandId:'hammer',description:'New description'},impact:[]});
 assert.equal(edited.description,'New description');assert.equal(edited.revision,2);
});
test('concurrent creates of the same name and tags let one through',async t=>{
 const {create}=await sameNameFixture(t);
 const results=await Promise.allSettled([create('one','hammer'),create('two','hammer')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.details.reason,'duplicate-variant');
});
test('the old index refusal maps to the conflict',async t=>{
 const {db,create,c}=await sameNameFixture(t);await create('hammer','hammer');
 await db.execute('CREATE UNIQUE INDEX catalog_family_name ON catalog_entries(family_id, lower(name))');
 await assert.rejects(create('tech','technogym'),duplicateVariant);
 assert.deepEqual((await c.list()).entries.map(e=>e.id),['hammer']);
});
test('migration 010 drops the index once',async t=>{
 const {db}=await setup(t);
 assert.equal((await db.execute("SELECT name FROM sqlite_master WHERE name='catalog_family_name'")).rows.length,0);
 const before=(await db.execute('SELECT * FROM schema_migrations')).rows;
 assert.equal(before.filter(r=>Number(r.version)===10).length,1);
 await migrate(db);assert.deepEqual((await db.execute('SELECT * FROM schema_migrations')).rows,before);
});
test('seed skips a starter that would conflict but allows different tags',async t=>{
 const {STARTER_CATALOG,seedCatalog}=await import('../server/catalog-seed.js');const first=STARTER_CATALOG[0];
 for(const tagged of [false,true]){
  const {c,db}=await setup(t);
  if(tagged)await c.createTag({id:'brand',kind:'brand',name:'Brand'});
  await c.create({id:'personal',familyId:first.familyId,familyName:first.familyName,referenceExerciseType:first.exerciseType,entry:{...first,brandId:tagged?'brand':null}});
  await seedCatalog(db);const ids=(await c.list()).entries.map(e=>e.id);
  assert.equal(ids.includes(first.id),tagged);assert.ok(ids.includes('personal'));
  for(const starter of STARTER_CATALOG.slice(1))assert.ok(ids.includes(starter.id));
 }
});
