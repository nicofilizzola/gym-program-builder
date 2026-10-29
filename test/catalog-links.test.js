import test from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {parseDocument,serializeDocument} from '../src/document-file.js';
const entry={name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']};
const ex={...entry,sets:4,repRange:{min:6,max:8},catalogId:'bench',familyId:'press',catalogRevision:1};
const doc={name:'Upper',exercises:[ex],goals:{}};
test('document links are resolved by the server and reject unknown and new archived links',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const r=createRepository(db),c=createCatalogRepository(db);
 await c.create({id:'bench',familyId:'press',referenceExerciseType:'compound',familyName:'Press',entry});
 const created=await r.create({id:'t',kind:'template',document:{...doc,exercises:[{...ex,name:'Forged',primaryMuscles:['Abs']}]}});
 assert.equal(created.document.exercises[0].name,'Bench');assert.deepEqual(created.document.exercises[0].primaryMuscles,['Chest']);
 await assert.rejects(r.create({id:'unknown',kind:'template',document:{...doc,exercises:[{...ex,catalogId:'unknown'}]}}),{code:'INVALID'});
 await c.archive({id:'bench',revision:1,archived:true});
 await assert.rejects(r.create({id:'new',kind:'template',document:doc}),{code:'INVALID'});
 assert.equal((await r.update({id:'t',revision:1,document:{...doc,name:'Upper edited'}})).document.exercises[0].sets,4);
 assert.equal((await r.create({id:'copy',kind:'template',document:doc,copyOf:'t'})).document.exercises[0].catalogId,'bench');
 const program={name:'Week',mode:'simple',goals:{},workouts:[{id:'w',templateId:'t',day:null}]};
 await r.create({id:'program',kind:'program',document:program});
 const bundle=await r.programBundle('program');
 assert.equal(bundle.templates[0].document.exercises[0].catalogId,'bench');
 assert.equal(bundle.templates[0].document.exercises[0].catalogCopyOf,undefined);
 await assert.rejects(r.create({id:'forgedcopy',kind:'program',document:{...program,workouts:[{id:'w',templateId:'nonexistent',day:null}]}}),{code:'NOT_FOUND'});
});
test('propagation conflicts stale edits and save as copy resolves latest mappings',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const r=createRepository(db),c=createCatalogRepository(db);
 await c.create({id:'bench',familyId:'press',referenceExerciseType:'compound',familyName:'Press',entry});await r.create({id:'t',kind:'template',document:doc});
 await c.update({id:'bench',revision:1,entry:{...entry,primaryMuscles:['Front delts']},impact:await c.impact('bench')});
 await assert.rejects(r.update({id:'t',revision:1,document:{...doc,name:'My unsaved edit'}}),{code:'CONFLICT'});
 const copied=await r.create({id:'copy',kind:'template',copyOf:'t',document:{...doc,exercises:[{...ex,sets:7}]}});
 assert.equal(copied.document.exercises[0].sets,7);assert.deepEqual(copied.document.exercises[0].primaryMuscles,['Front delts']);
});
test('portable files discard catalog identity without changing saved definitions',()=>{
 const encoded=serializeDocument('template',doc);assert.equal(JSON.parse(encoded).template.exercises[0].catalogId,undefined);
 const imported=parseDocument(JSON.stringify({version:2,kind:'template',template:doc}));assert.equal(imported.document.exercises[0].catalogId,undefined);assert.equal(imported.document.exercises[0].name,'Bench');assert.equal(doc.exercises[0].catalogId,'bench');
});
