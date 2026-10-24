import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
test('SQLite records persist, enforce revisions and safely retry lost acknowledgements',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gym-'));const url=`file:${join(dir,'test.db')}`;
 let db=createDb({url});t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await migrate(db);await migrate(db);
 const r=createRepository(db);const document={name:'Upper',exercises:[],goals:{}};
 const a=await r.create({id:'a',kind:'template',document});assert.equal(a.revision,1);
 assert.equal((await r.create({id:'a',kind:'template',document})).revision,1);
 await assert.rejects(r.create({id:'a',kind:'template',document:{...document,name:'different'}}),{code:'CONFLICT'});
 const next={...document,name:'New'};
 const b=await r.update({id:'a',revision:1,document:next});assert.equal(b.revision,2);
 assert.equal((await r.update({id:'a',revision:1,document:next})).revision,2);
 await assert.rejects(r.update({id:'a',revision:1,document}),{code:'CONFLICT'});
 const results=await Promise.allSettled(['One','Two'].map(name=>r.update({id:'a',revision:2,document:{...document,name}})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(r.remove({id:'a',revision:1}),{code:'CONFLICT'});
 db.close();db=createDb({url});const reopened=createRepository(db);assert.equal((await reopened.get('a')).revision,3);
 assert.equal((await reopened.list('template')).length,1);assert.equal((await reopened.list('program')).length,0);
 await assert.rejects(reopened.update({id:'a',revision:3,document:{...document,goals:{Chest:31}}}),{code:'INVALID'});
 assert.equal((await reopened.get('a')).revision,3);
 await reopened.remove({id:'a',revision:3});await reopened.remove({id:'a',revision:3});
 await assert.rejects(reopened.get('a'),{code:'NOT_FOUND'});
});


test('repository preserves sequences and rejects invalid updates atomically',async t=>{
 const db=createDb({url:'file::memory:'});t.after(()=>db.close());await migrate(db);
 const r=createRepository(db),document={name:'',mode:'simple',goals:{},workouts:[{id:'a',day:null,name:'',exercises:[],goals:{}}],
  sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'}]};
 await r.create({id:'cycle',kind:'program',document});
 assert.deepEqual((await r.get('cycle')).document,document);
 await assert.rejects(r.update({id:'cycle',revision:1,document:{...document,sequence:[]}}),{code:'INVALID'});
 assert.equal((await r.get('cycle')).revision,1);
 const restOnly={...document,workouts:[],sequence:[{type:'rest',id:'r'}]};
 await r.update({id:'cycle',revision:1,document:restOnly});
 await assert.rejects(r.update({id:'cycle',revision:1,document}),{code:'CONFLICT'});
 assert.deepEqual((await r.get('cycle')).document,restOnly);
});

