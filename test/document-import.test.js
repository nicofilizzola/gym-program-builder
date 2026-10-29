import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createDocumentCommands} from '../server/document-commands.js';
const template={name:'Push',exercises:[],goals:{},extraMinutes:5,bufferPercent:10};
const bundle={version:3,kind:'program',templates:[{key:'t',template}],program:{name:'Week',mode:'schedule',goals:{},workouts:[{key:'a',templateKey:'t',day:0},{key:'b',templateKey:'t',day:null}]}};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,r:createRepository(db),c:createDocumentCommands(db)};}
test('import remaps sharing atomically and exact replay creates no extra records',async t=>{
 const {r,c}=await setup(t),request={operationId:'import',bundle};
 const first=await c.importDocument(request);assert.deepEqual(await c.importDocument(request),first);
 assert.equal(first.templates.length,1);assert.notEqual(first.templates[0].id,'t');
 assert.equal(first.record.document.workouts[0].templateId,first.record.document.workouts[1].templateId);
 assert.equal((await r.list('template')).length,1);
 await assert.rejects(c.importDocument({...request,bundle:{...bundle,kind:'other'}}),{code:'CONFLICT'});
});
test('import failures and stale replacements leave library untouched',async t=>{
 const {db,r,c}=await setup(t);
 const first=await c.importDocument({operationId:'first',bundle});
 await assert.rejects(c.importDocument({operationId:'stale',targetId:first.record.id,revision:0,bundle}),{code:'CONFLICT'});
 await db.execute("CREATE TRIGGER reject_import BEFORE INSERT ON documents WHEN NEW.kind='program' BEGIN SELECT RAISE(ABORT,'import failure'); END");
 await assert.rejects(c.importDocument({operationId:'fail',bundle}),/import failure/);
 assert.equal((await r.list('template')).length,1);assert.equal((await r.list('program')).length,1);
});
test('template editor import replaces the same shared identity while library import creates new',async t=>{
 const {r,c}=await setup(t),first=await c.importDocument({operationId:'p',bundle}),id=first.templates[0].id;
 const replacement={version:3,kind:'template',template:{...template,name:'Updated'}};
 const result=await c.importDocument({operationId:'replace',targetId:id,revision:1,bundle:replacement});
 assert.equal(result.record.id,id);assert.equal((await r.programBundle(first.record.id)).templates[0].document.name,'Updated');
 assert.equal((await r.list('template')).length,1);
 await c.importDocument({operationId:'library',bundle:replacement});assert.equal((await r.list('template')).length,2);
 await assert.rejects(c.importDocument({operationId:'wrong',targetId:id,revision:2,bundle}),{code:'INVALID'});
});
