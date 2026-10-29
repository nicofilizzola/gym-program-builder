import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
test('reference equipment is inherited while default muscles only initialize future variants',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const c=createCatalogRepository(db),r=createRepository(db);
 const ref=await c.createReference({id:'ref',name:'Press',exerciseType:'compound',equipment:'Barbell',description:'Reference notes',defaultPrimaryMuscles:['Chest'],defaultSecondaryMuscles:['Triceps']});
 const v=await c.create({id:'v',familyId:ref.id,entry:{name:'Paused',primaryMuscles:['Chest'],secondaryMuscles:[],description:'Pause two seconds'}});
 assert.equal(v.equipment,'Barbell');assert.equal(v.referenceDescription,'Reference notes');
 await assert.rejects(c.create({id:'forged',familyId:ref.id,entry:{name:'Other',equipment:'Dumbbell',primaryMuscles:['Chest'],secondaryMuscles:[]}}),{code:'INVALID'});
 await r.create({id:'t',kind:'template',document:{name:'Push',exercises:[{name:v.name,sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],catalogId:v.id,catalogRevision:v.revision,familyId:ref.id,equipment:v.equipment}],goals:{}}});
 let current=await c.getReference(ref.id);
 await c.updateReference({...current,defaultPrimaryMuscles:['Front delts']});assert.deepEqual((await c.list()).entries[0].primaryMuscles,['Chest']);assert.equal((await r.get('t')).revision,1);
 current=await c.getReference(ref.id);const impact=await c.referenceImpact(ref.id);
 await c.updateReference({...current,equipment:'Machine',description:'New notes',impact});
 const saved=(await r.get('t')).document.exercises[0];assert.equal(saved.equipment,'Machine');assert.equal(saved.referenceDescription,'New notes');assert.equal(saved.variantDescription,'Pause two seconds');assert.equal(saved.restSeconds,45);
 await assert.rejects(c.updateReference({...current,equipment:'Cable',impact}),{code:'CONFLICT'});
});
test('inline reference creation retry rejects changed equipment description or defaults',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const c=createCatalogRepository(db);
 const request={id:'v',familyId:'ref',familyName:'Press',referenceExerciseType:'compound',reference:{equipment:'Barbell',description:'Setup',defaultPrimaryMuscles:['Chest'],defaultSecondaryMuscles:[]},entry:{name:'Paused',primaryMuscles:['Chest'],secondaryMuscles:[]}};
 await c.create(request);assert.equal((await c.create(request)).id,'v');
 for(const patch of [{equipment:'Machine'},{description:'Different setup'},{defaultPrimaryMuscles:['Triceps']}])await assert.rejects(c.create({...request,reference:{...request.reference,...patch}}),{code:'CONFLICT'});
 assert.equal((await c.getReference('ref')).equipment,'Barbell');assert.equal((await c.list()).entries.length,1);
});
test('variant moves inherit destination metadata and reject stale impact without changing prescriptions',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const c=createCatalogRepository(db),r=createRepository(db);
 await c.createReference({id:'source',name:'Barbell press',exerciseType:'compound',equipment:'Barbell'});
 await c.createReference({id:'destination',name:'Machine press',exerciseType:'compound',equipment:'Machine',description:'Machine setup'});
 await c.createTag({id:'focus',kind:'focus',name:'Upper chest'});
 const entry=await c.create({id:'v',familyId:'source',entry:{name:'Paused',description:'Slow lower',primaryMuscles:['Chest'],secondaryMuscles:[],focusTagIds:['focus']}});
 const template=await r.create({id:'t',kind:'template',document:{name:'Push',goals:{},exercises:[{name:entry.name,sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],catalogId:'v',catalogRevision:1,familyId:'source',equipment:'Barbell'}]}});
 const request={id:'v',revision:1,destinationReferenceId:'destination',sourceReferenceRevision:(await c.getReference('source')).revision,destinationReferenceRevision:1,impact:await c.impact('v')};
 await r.update({id:'t',revision:1,document:{...template.document,name:'New draft'}});
 await assert.rejects(c.move(request),{code:'CONFLICT'});assert.equal((await c.list()).entries[0].familyId,'source');
 const moved=await c.move({...request,impact:await c.impact('v')});assert.equal(moved.equipment,'Machine');assert.equal(moved.referenceDescription,'Machine setup');assert.equal(moved.description,'Slow lower');assert.equal(moved.focusTags[0].id,'focus');assert.deepEqual(moved.primaryMuscles,['Chest']);
 const saved=(await r.get('t')).document.exercises[0];assert.equal(saved.equipment,'Machine');assert.equal(saved.restSeconds,45);assert.equal(saved.sets,4);
});
