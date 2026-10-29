import {resolveProgram} from '../src/program-links.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
import {snapshotExercise} from '../src/catalog.js';
import {computeProgramVolume} from '../src/program-volume.js';
const definition={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']};
async function fixture(t){
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const c=createCatalogRepository(db),r=createRepository(db);
 const entry=await c.create({id:'v',familyId:'r1',referenceExerciseType:'compound',familyName:'Press',entry:definition});await c.createReference({equipment:'Barbell',exerciseType:'compound',id:'r2',name:'Destination'});
 const workout={name:'Upper',goals:{Chest:6},exercises:[snapshotExercise({sets:4,repRange:{min:6,max:8}},entry)]};
 await r.create({id:'t',kind:'template',document:workout});await r.create({id:'p',kind:'program',document:{name:'Week',mode:'schedule',goals:{Chest:12},workouts:[{id:'w1',templateId:'t',day:0},{id:'w2',templateId:'t',day:null}]}});
 const request=async()=>({id:'v',revision:(await c.list()).entries.find(e=>e.id==='v').revision,destinationReferenceId:'r2',sourceReferenceRevision:(await c.getReference('r1')).revision,destinationReferenceRevision:(await c.getReference('r2')).revision,impact:await c.impact('v')});
 return {db,c,r,workout,request};
}
test('moving a variant updates linked snapshots once per document and replays safely',async t=>{
 const {c,r,workout,request}=await fixture(t);const args=await request(),before=await r.programBundle('p').then(b=>resolveProgram(b.record.document,b.templates));
 assert.equal(computeProgramVolume(before).Chest,8);assert.equal(computeProgramVolume(before).Triceps,4);
 const moved=await c.move(args);assert.equal(moved.id,'v');assert.equal(moved.familyId,'r2');assert.equal(moved.revision,2);
 assert.equal((await c.getReference('r1')).revision,args.sourceReferenceRevision+1);assert.equal((await c.getReference('r2')).revision,args.destinationReferenceRevision+1);
 const bundle=await r.programBundle('p'),program={...bundle.record,document:resolveProgram(bundle.record.document,bundle.templates)};assert.equal(program.revision,1);assert.equal((await r.get('t')).revision,2);
 assert.equal(program.document.workouts[1].day,null);assert.deepEqual(program.document.goals,{Chest:12});assert.equal(computeProgramVolume(program.document).Chest,8);
 for(const w of program.document.workouts){assert.equal(w.exercises[0].sets,4);assert.deepEqual(w.exercises[0].repRange,{min:6,max:8});assert.equal(w.exercises[0].familyId,'r2');}
 await c.move(args);assert.equal((await r.get('p')).revision,1);
 await assert.rejects(r.update({id:'t',revision:1,document:{...workout,name:'Unsaved edit'}}),{code:'CONFLICT'});
 const copy=await r.create({id:'copy',kind:'template',copyOf:'t',document:{...workout,exercises:[{...workout.exercises[0],sets:7}]}});
 assert.equal(copy.document.exercises[0].familyId,'r2');assert.equal(copy.document.exercises[0].sets,7);
});
test('invalid destinations, collisions and stale previews never partially move a variant',async t=>{
 const {c,r,request}=await fixture(t);let args=await request();
 for(const bad of [{destinationReferenceId:'r1'},{destinationReferenceId:'missing'},{revision:0},{sourceReferenceRevision:0},{destinationReferenceRevision:0},{impact:[]}]){
  await assert.rejects(c.move({...args,...bad}));assert.equal((await r.get('t')).revision,1);assert.equal((await c.list()).entries[0].familyId,'r1');
 }
 const other=await c.create({id:'other',familyId:'r2',entry:definition});await c.archive({id:other.id,revision:other.revision,archived:true});
 args=await request();await assert.rejects(c.move(args),{code:'CONFLICT'});
 const ref=await c.getReference('r2');await c.archiveReference({id:ref.id,revision:ref.revision,archived:true});
 await assert.rejects(c.move(await request()),{code:'INVALID'});
});
test('moves preserve inherited and individual archives and roll back failed propagation',async t=>{
 const {c,r,db,request}=await fixture(t);const source=await c.getReference('r1');await c.archiveReference({id:'r1',revision:source.revision,archived:true});
 const args=await request();await db.execute("CREATE TRIGGER reject_move BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'move failure'); END");
 await assert.rejects(c.move(args));assert.equal((await c.getReference('r1')).revision,args.sourceReferenceRevision);assert.equal((await r.get('t')).revision,1);assert.equal((await c.list()).entries[0].individuallyArchived,false);
 await db.execute('DROP TRIGGER reject_move');
 const moved=await c.move(args);assert.equal(moved.archived,true);assert.equal(moved.individuallyArchived,true);assert.equal(moved.referenceArchived,false);
});
