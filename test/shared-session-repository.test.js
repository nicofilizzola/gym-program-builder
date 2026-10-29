import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import * as commandsModule from '../server/document-commands.js';
import {resolveProgram} from '../src/program-links.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const template={name:'Push',exercises:[],goals:{},extraMinutes:5,bufferPercent:10};
const program={name:'Week',mode:'schedule',workouts:[],goals:{}};
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);const r=createRepository(db);await r.create({id:'p',kind:'program',document:program});return {db,r,c:commandsModule.createDocumentCommands(db)};}
test('shared repository protects template deletion and arrangement saves own no session data',async t=>{
 const {r}=await setup(t);await r.create({id:'t',kind:'template',document:template});
 const p=await r.update({id:'p',revision:1,document:{...program,workouts:[{id:'a',templateId:'t',day:0},{id:'b',templateId:'t',day:null}]}});
 await r.update({id:'t',revision:1,document:{...template,name:'Changed'}});
 const bundle=await r.programBundle('p');
 assert.deepEqual(resolveProgram(bundle.record.document,bundle.templates).workouts.map(w=>w.name),['Changed','Changed']);
 assert.equal(p.revision,bundle.record.revision);
 await assert.rejects(r.remove({id:'t',revision:2}),e=>e.code==='IN_USE'&&e.details.programs[0].count===2);
 await r.remove({id:'p',revision:2});assert.equal((await r.get('t')).document.name,'Changed');
});
test('atomic empty session creation replays once and rolls back on failed linking',async t=>{
 const {db,r,c}=await setup(t),request={operationId:'op',programId:'p',revision:1,templateId:'t',occurrenceId:'a',template};
 const first=await c.createAndAttach(request);assert.deepEqual(await c.createAndAttach(request),first);
 assert.equal((await r.list('template')).length,1);assert.equal(first.record.document.workouts.length,1);
 await assert.rejects(c.createAndAttach({...request,template:{...template,name:'Different'}}),{code:'CONFLICT'});
 await assert.rejects(c.createAndAttach({...request,operationId:'stale',templateId:'stale'}),{code:'CONFLICT'});
 assert.equal((await r.list('template')).length,1);
 await db.execute("CREATE TRIGGER reject_link BEFORE INSERT ON program_template_links BEGIN SELECT RAISE(ABORT,'injected index failure'); END");
 await assert.rejects(c.createAndAttach({...request,operationId:'new',revision:2,templateId:'other',occurrenceId:'b'}),/injected index failure/);
 assert.equal((await r.list('template')).length,1);assert.equal((await r.get('p')).revision,2);
});
test('missing and wrong-kind link targets reject without writing an index',async t=>{
 const {r,db}=await setup(t);
 for(const templateId of ['missing','p'])await assert.rejects(r.update({id:'p',revision:1,document:{...program,workouts:[{id:'a',templateId,day:0}]}}));
 assert.equal((await r.get('p')).revision,1);assert.equal((await db.execute('SELECT * FROM program_template_links')).rows.length,0);
});
test('concurrent delete and attachment cannot leave a dangling shared template link',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gym-link-race-')),url='file:'+join(dir,'test.db');
 const first=createDb({url}),second=createDb({url});t.after(async()=>{first.close();second.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await migrate(first);const a=createRepository(first),b=createRepository(second);
 await a.create({id:'t',kind:'template',document:template});await a.create({id:'p',kind:'program',document:program});
 const actions=[()=>a.update({id:'p',revision:1,document:{...program,workouts:[{id:'w',templateId:'t',day:0}]}}),()=>b.remove({id:'t',revision:1})];
 const results=await Promise.allSettled(actions.map(action=>action()));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const dangling=await first.execute('SELECT l.template_id FROM program_template_links l LEFT JOIN documents d ON d.id=l.template_id WHERE d.id IS NULL');assert.equal(dangling.rows.length,0);
 const loserIndex=results.findIndex(r=>r.status==='rejected'),loser=results[loserIndex];
 if(loser.reason.code==='SQLITE_BUSY')await assert.rejects(actions[loserIndex](),error=>['IN_USE','NOT_FOUND'].includes(error.code));
 else assert.ok(['IN_USE','NOT_FOUND'].includes(loser.reason.code),String(loser.reason));
});
