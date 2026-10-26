import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
import {seedCatalog,STARTER_CATALOG} from '../server/catalog-seed.js';
import {snapshotExercise} from '../src/catalog.js';
import {defaultRestSeconds} from '../src/duration.js';

const definition={name:'Press',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,c:createCatalogRepository(db),r:createRepository(db)};}

test('reference type is required for creation, validated and revision protected',async t=>{
 const {c}=await setup(t);
 for(const exerciseType of [undefined,null,'unknown',42])await assert.rejects(c.createReference({id:'bad',name:'Reference',exerciseType}),{code:'INVALID'});
 await assert.rejects(c.create({id:'bad-variant',familyId:'bad-inline',familyName:'Inline',entry:definition}),{code:'INVALID'});
 const inline=await c.create({id:'inline-v',familyId:'inline',familyName:'Inline',referenceExerciseType:'isolation',entry:definition});
 assert.equal(inline.exerciseType,'isolation');
 const ref=await c.createReference({id:'r',name:'Reference',exerciseType:'compound'});
 assert.equal(ref.exerciseType,'compound');assert.equal((await c.createReference({id:'r',name:'Reference',exerciseType:'compound'})).revision,1);
 await assert.rejects(c.createReference({id:'r',name:'Reference',exerciseType:'isolation'}),{code:'CONFLICT'});
 const updated=await c.updateReference({id:'r',revision:1,name:'Reference',exerciseType:'isolation'});
 assert.equal(updated.exerciseType,'isolation');assert.equal(updated.revision,2);
 assert.equal((await c.updateReference({id:'r',revision:1,name:'Reference',exerciseType:'isolation'})).revision,2);
 await assert.rejects(c.updateReference({id:'r',revision:1,name:'Reference',exerciseType:'compound'}),{code:'CONFLICT'});
 await assert.rejects(c.updateReference({id:'r',revision:2,name:'Reference',exerciseType:'other'}),{code:'INVALID'});
});
test('variants read their reference default while propagation and moves preserve saved rest',async t=>{
 const {c,r}=await setup(t);
 await c.createReference({id:'compound',name:'Press',exerciseType:'compound'});
 await c.createReference({id:'isolation',name:'Fly',exerciseType:'isolation'});
 const entry=await c.create({id:'v',familyId:'compound',entry:definition});
 const variant=await c.create({id:'v2',familyId:'compound',entry:{...definition,name:'Alternate'}});
 assert.equal(entry.exerciseType,'compound');assert.equal(variant.exerciseType,'compound');
 const ex=snapshotExercise({sets:3,restSeconds:45,repRange:{min:8,max:12}},entry);
 const workout={name:'Upper',goals:{},extraMinutes:12,bufferPercent:25,exercises:[ex]};
 await r.create({id:'t',kind:'template',document:workout});
 await r.create({id:'p',kind:'program',document:{name:'Week',mode:'simple',goals:{},workouts:[{...workout,id:'w',day:null}]}});
 const parent=await c.getReference('compound');
 await c.updateReference({id:parent.id,revision:parent.revision,name:parent.name,exerciseType:'isolation'});
 assert.equal((await c.list()).entries.find(e=>e.id==='v').exerciseType,'isolation');
 assert.equal((await r.get('t')).revision,1);
 await c.update({id:'v',revision:1,entry:{...definition,name:'Updated'},impact:await c.impact('v')});
 const source=await c.getReference('compound'),dest=await c.getReference('isolation');
 await c.move({id:'v',revision:2,destinationReferenceId:dest.id,sourceReferenceRevision:source.revision,destinationReferenceRevision:dest.revision,impact:await c.impact('v')});
 for(const record of [await r.get('t'),await r.get('p')]) {
  const w=record.kind==='template'?record.document:record.document.workouts[0];
  assert.equal(w.extraMinutes,12);assert.equal(w.bufferPercent,25);assert.equal(w.exercises[0].restSeconds,45);assert.equal(w.exercises[0].familyId,'isolation');
 }
 const saved=(await r.get('t')).document;
 const copy=await r.create({id:'copy',kind:'template',copyOf:'t',document:saved});
 assert.equal(copy.document.exercises[0].restSeconds,45);
});
test('reviewed seed classifications survive reruns without overwriting personal edits',async t=>{
 const {db,c}=await setup(t);await seedCatalog(db);
 let list=await c.list();
 assert.equal(list.entries.length,STARTER_CATALOG.length);
 assert.ok(list.families.every(f=>['compound','isolation'].includes(f.exerciseType)));
 assert.equal(defaultRestSeconds(list.entries.find(e=>e.id==='seed-barbell-bench-press').exerciseType),180);
 assert.equal(defaultRestSeconds(list.entries.find(e=>e.id==='seed-dumbbell-curl').exerciseType),90);
 const bench=await c.getReference('seed-family-bench');
 await c.updateReference({id:bench.id,revision:bench.revision,name:bench.name,exerciseType:'isolation'});
 await seedCatalog(db);assert.equal((await c.getReference(bench.id)).exerciseType,'isolation');
 // Rehearse v1-seeded database upgrade while preserving renamed and archived references.
 await db.execute('DELETE FROM catalog_seed_versions WHERE version=2');
 await db.execute("UPDATE catalog_families SET exercise_type=NULL WHERE id IN ('seed-family-bench','seed-family-row','seed-family-squat')");
 await db.execute("UPDATE catalog_families SET name='My row' WHERE id='seed-family-row'");
 await db.execute("UPDATE catalog_families SET archived=1 WHERE id='seed-family-squat'");
 await seedCatalog(db);
 assert.equal((await c.getReference('seed-family-bench')).exerciseType,'compound');
 assert.equal((await c.getReference('seed-family-row')).exerciseType,null);
 assert.equal((await c.getReference('seed-family-squat')).exerciseType,null);
 await db.execute("INSERT INTO catalog_families(id,name) VALUES('legacy','Custom reference')");
 assert.equal((await c.getReference('legacy')).exerciseType,null);
 assert.equal((await c.list()).families.find(f=>f.id==='legacy').exerciseType,null);
});
