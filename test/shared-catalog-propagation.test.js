import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {resolveProgram} from '../src/program-links.js';
import {computeProgramVolume} from '../src/program-volume.js';

test('catalog propagates to one shared template while every occurrence contributes volume',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const r=createRepository(db),c=createCatalogRepository(db),entry={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]};
 await c.create({id:'bench',familyId:'press',familyName:'Press',referenceExerciseType:'compound',entry});
 const workout={name:'Push',goals:{Chest:4},extraMinutes:5,bufferPercent:10,exercises:[{...entry,catalogId:'bench',familyId:'press',catalogRevision:1,sets:4,restSeconds:45,repRange:{min:8,max:12}}]};
 await r.create({id:'t',kind:'template',document:workout});
 const program={name:'P',mode:'schedule',goals:{},workouts:[{id:'a',templateId:'t',day:0},{id:'b',templateId:'t',day:null}]};
 await r.create({id:'p',kind:'program',document:program});
 await r.create({id:'q',kind:'program',document:{...program,workouts:[{id:'c',templateId:'t',day:1}]}});
 assert.deepEqual(await c.impact('bench'),[{id:'t',revision:1,count:1}]);
 await c.update({id:'bench',revision:1,entry:{...entry,name:'Bench updated'},impact:await c.impact('bench')});
 assert.equal((await r.get('t')).revision,2);
 for(const id of ['p','q']){
  const bundle=await r.programBundle(id),value=resolveProgram(bundle.record.document,bundle.templates);
  assert.equal(bundle.record.revision,1);
  assert.equal(value.workouts[0].exercises[0].name,'Bench updated');
  assert.equal(value.workouts[0].exercises[0].restSeconds,45);
  assert.equal(computeProgramVolume(value).Chest,id==='p'?8:4);
 }
});
