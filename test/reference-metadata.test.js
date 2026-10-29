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
