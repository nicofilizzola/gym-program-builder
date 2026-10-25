import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';

test('legacy reads normalize without writes and retries compare normalized timing',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gym-timing-')),db=createDb({url:'file:'+join(dir,'test.db')});
 t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});});await migrate(db);
 const legacy={name:'Old',exercises:[{name:'Curl',sets:3,repRange:{min:8,max:12},primaryMuscles:['Biceps'],secondaryMuscles:[]}],goals:{}};
 const json=JSON.stringify(legacy);
 await db.execute({sql:'INSERT INTO documents VALUES(?,?,1,?,?,?)',args:['old','template',json,'before','before']});
 const r=createRepository(db),read=await r.get('old');
 assert.equal(read.document.extraMinutes,5);assert.equal(read.document.bufferPercent,10);assert.equal(read.document.exercises[0].restSeconds,120);
 const raw=(await db.execute('SELECT * FROM documents WHERE id=\'old\'')).rows[0];
 assert.equal(raw.document_json,json);assert.equal(raw.revision,1);assert.equal(raw.updated_at,'before');
 assert.equal((await r.create({id:'old',kind:'template',document:read.document})).revision,1);
 // Simulate a legacy response whose successful revision-1 update was lost.
 await db.execute('UPDATE documents SET revision=2 WHERE id=\'old\'');
 assert.equal((await r.update({id:'old',revision:1,document:read.document})).revision,2);
 const next={...read.document,extraMinutes:15,bufferPercent:25,exercises:[{...read.document.exercises[0],restSeconds:45}]};
 assert.equal((await r.update({id:'old',revision:2,document:next})).revision,3);
 assert.deepEqual((await r.get('old')).document,next);
 await assert.rejects(r.update({id:'old',revision:2,document:{...next,extraMinutes:20}}),{code:'CONFLICT'});
 await assert.rejects(r.update({id:'old',revision:3,document:{...next,bufferPercent:7}}),{code:'INVALID'});
 assert.equal((await r.get('old')).revision,3);
});
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

