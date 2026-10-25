import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
const entry={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,c:createCatalogRepository(db),r:createRepository(db)};}
test('catalog creation is idempotent and archive does not destroy family identity',async t=>{
 const {c}=await setup(t);const args={id:'bench',familyId:'press',familyName:'Bench press',entry};
 const e=await c.create(args);assert.equal(e.revision,1);assert.equal((await c.create(args)).id,'bench');
 await assert.rejects(c.create({...args,id:'duplicate',entry:{...entry,name:'bENCH'}}),{code:'CONFLICT'});
 await c.create({...args,id:'incline',entry:{...entry,name:'Incline bench'}});
 let archived=await c.archive({id:e.id,revision:1,archived:true});assert.equal(archived.archived,true);
 await assert.rejects(c.archive({id:e.id,revision:1,archived:false}),{code:'CONFLICT'});
 assert.equal((await c.archive({id:e.id,revision:archived.revision,archived:false})).familyId,'press');
 assert.equal((await c.list()).entries.length,2);
});
test('catalog edits atomically update each linked document once and protect impact previews',async t=>{
 const {c,r,db}=await setup(t);await c.create({id:'bench',familyId:'press',familyName:'Bench press',entry});
 const ex={...entry,sets:4,repRange:{min:6,max:8},catalogId:'bench',catalogRevision:1,familyId:'press'};
 const template={name:'Upper',exercises:[ex],goals:{Chest:8}};
 await r.create({id:'t',kind:'template',document:template});
 const program={name:'Week',mode:'schedule',goals:{},workouts:[{...template,id:'w1',day:0},{...template,id:'w2',day:null}]};
 await r.create({id:'p',kind:'program',document:program});
 // Isolate catalog propagation from document validation, implemented in the next task.
 for(const [id,value] of [['t',template],['p',program]])await db.execute({sql:'UPDATE documents SET document_json=? WHERE id=?',args:[JSON.stringify(value),id]});
 const impact=await c.impact('bench');assert.deepEqual(impact,[{id:'p',revision:1,count:2},{id:'t',revision:1,count:1}]);
 await r.update({id:'t',revision:1,document:{...template,name:'Changed'}});
 await db.execute({sql:'UPDATE documents SET document_json=? WHERE id=?',args:[JSON.stringify({...template,name:'Changed'}),'t']});
 await assert.rejects(c.update({id:'bench',revision:1,entry:{...entry,primaryMuscles:['Front delts']},impact}),{code:'CONFLICT'});
 const changed=await c.update({id:'bench',revision:1,entry:{...entry,name:'Bench corrected',primaryMuscles:['Front delts']},impact:await c.impact('bench')});
 assert.equal(changed.revision,2);
 const p=await r.get('p');assert.equal(p.revision,2);assert.equal(p.document.workouts[1].day,null);assert.equal(p.document.workouts[0].exercises[0].sets,4);assert.equal(p.document.workouts[0].exercises[0].name,'Bench corrected');
 assert.deepEqual(p.document.workouts[0].exercises[0].primaryMuscles,['Front delts']);
 await assert.rejects(r.update({id:'p',revision:1,document:{...p.document,name:'Stale edit'}}),{code:'CONFLICT'});
});
