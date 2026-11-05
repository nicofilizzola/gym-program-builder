import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createWorkoutRepository} from '../server/workout-repository.js';
import {validateWorkoutLog,workoutSummary} from '../src/workout-log.js';
import {finishWorkout,swapExercise} from '../src/workout-edit.js';

const set=(id,weightKg,reps,rir=null)=>({id,weightKg,reps,rir,done:true});
const exercise=(id,variantId,sets)=>({id,variantId,referenceId:variantId&&'f-'+variantId,name:'Ex '+id,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],target:null,sets});
const mk=({id='a',status='active',startedAt='2026-11-03T10:00:00.000+00:00',finishedAt=null,exercises=[exercise('e1','v1',[set('s1',80,8)])]}={})=>
 validateWorkoutLog({id,logVersion:1,status,name:'Push',startedAt,finishedAt,source:{kind:'blank'},exercises}).log;
const fin=(id,startedAt,finishedAt,exercises)=>mk({id,status:'finished',startedAt,finishedAt,exercises});
async function setup(t){
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 return {db,repo:createWorkoutRepository(db,{now:()=>'2026-11-03T00:00:00.000Z'})};
}
const count=async(db,table)=>Number((await db.execute(`SELECT COUNT(*) c FROM ${table}`)).rows[0].c);

test('save creates, updates and replays idempotently',async t=>{
 const {repo}=await setup(t);
 const log=mk();
 assert.deepEqual(await repo.save({id:'a',revision:0,log}),{id:'a',revision:1,log});
 assert.deepEqual(await repo.save({id:'a',revision:0,log}),{id:'a',revision:1,log});
 await assert.rejects(repo.save({id:'a',revision:0,log:mk({exercises:[]})}),{code:'CONFLICT',details:{reason:'revision_conflict'},message:'Workout changed on another device.'});
 const next=mk({exercises:[exercise('e1','v1',[set('s1',82.5,8)])]});
 assert.equal((await repo.save({id:'a',revision:1,log:next})).revision,2);
 assert.deepEqual((await repo.get('a')).log,next);
 assert.deepEqual(await repo.save({id:'a',revision:1,log:next}),{id:'a',revision:2,log:next},'update replay after a lost acknowledgement');
 await assert.rejects(repo.save({id:'a',revision:1,log}),{code:'CONFLICT',details:{reason:'revision_conflict'}});
 await assert.rejects(repo.save({id:'a',revision:2,log:{...next,name:''}}),{code:'INVALID'});
 await assert.rejects(repo.save({id:'a',revision:2,log:{...next,id:'b'}}),{code:'INVALID'});
 for(const id of ['','x'.repeat(101),3])await assert.rejects(repo.save({id,revision:0,log:{...log,id}}),{code:'INVALID'});
 await assert.rejects(repo.save({id:'a',revision:-1,log}),{code:'INVALID'});
 await assert.rejects(repo.get('missing'),{code:'NOT_FOUND'});
});

test('only one active log exists',async t=>{
 const {repo}=await setup(t);
 await repo.save({id:'a',revision:0,log:mk()});
 assert.equal((await repo.active()).id,'a');
 await assert.rejects(repo.save({id:'b',revision:0,log:mk({id:'b'})}),{code:'CONFLICT',details:{reason:'active_exists'},message:'Another workout is already in progress.'});
 const done=fin('a','2026-11-03T10:00:00.000+00:00','2026-11-03T11:00:00.000+00:00');
 await repo.save({id:'a',revision:1,log:done});
 assert.equal(await repo.active(),null);
 await repo.save({id:'b',revision:0,log:mk({id:'b'})});
 await assert.rejects(repo.save({id:'a',revision:2,log:mk()}),{code:'INVALID'});
 await assert.rejects(repo.save({id:'a',revision:1,log:mk()}),{code:'CONFLICT',details:{reason:'revision_conflict'}},'stale active write after another device finished it');
});

test('variant index follows finish, edits and delete',async t=>{
 const {db,repo}=await setup(t);
 const active=mk();
 await repo.save({id:'a',revision:0,log:active});
 assert.equal(await count(db,'workout_log_variants'),0);
 const finished=finishWorkout(active,new Date('2026-11-03T11:00:00Z')).log;
 await repo.save({id:'a',revision:1,log:finished});
 const variants=async()=>(await db.execute('SELECT variant_id FROM workout_log_variants')).rows.map(r=>r.variant_id);
 assert.deepEqual(await variants(),['v1']);
 const swapped=swapExercise(finished,'e1',{id:'v2',familyId:'f',name:'X',primaryMuscles:['Chest'],secondaryMuscles:[]});
 await repo.save({id:'a',revision:2,log:swapped});
 assert.deepEqual(await variants(),['v2']);
 await assert.rejects(repo.remove({id:'a',revision:2}),{code:'CONFLICT',details:{reason:'revision_conflict'}});
 await repo.remove({id:'a',revision:3});
 assert.equal(await count(db,'workout_logs'),0);
 assert.equal(await count(db,'workout_log_variants'),0);
 await repo.remove({id:'a',revision:3});
});

test('lastTime returns the first occurrence in the latest finished log, excluding the current log',async t=>{
 const {repo}=await setup(t);
 await repo.save({id:'L1',revision:0,log:fin('L1','2026-11-01T10:00:00.000+00:00','2026-11-01T11:00:00.000+00:00',[exercise('e1','v1',[set('s1',80,8)])])});
 const l2=fin('L2','2026-11-02T10:00:00.000+00:00','2026-11-02T11:00:00.000+00:00',[exercise('e1','v1',[set('s1',85,6)]),exercise('e2','v1',[set('s2',60,12)])]);
 await repo.save({id:'L2',revision:0,log:l2});
 assert.deepEqual(await repo.lastTime({variantIds:['v1','v2']}),{v1:{logId:'L2',finishedAt:l2.finishedAt,sets:[{weightKg:85,reps:6,rir:null,kind:'working'}]}});
 const r=await repo.lastTime({variantIds:['v1'],exclude:'L2'});
 assert.equal(r.v1.logId,'L1');assert.deepEqual(r.v1.sets,[{weightKg:80,reps:8,rir:null,kind:'working'}]);
 assert.deepEqual(await repo.lastTime({variantIds:[]}),{});
 await assert.rejects(repo.lastTime({variantIds:Array.from({length:41},(_,i)=>'v'+i)}),{code:'INVALID'});
});

test('lastTime returns kind per set, working for version 1 logs',async t=>{
 const {repo,db}=await setup(t);
 const v2=validateWorkoutLog({id:'W2',logVersion:2,status:'finished',name:'Push',startedAt:'2026-11-02T10:00:00.000+00:00',finishedAt:'2026-11-02T11:00:00.000+00:00',source:{kind:'blank'},
  exercises:[exercise('e1','v2',[{id:'a',kind:'warmup',weightKg:40,reps:8,rir:null,done:true},{id:'b',kind:'working',weightKg:80,reps:8,rir:2,done:true}])]}).log;
 await repo.save({id:'W2',revision:0,log:v2});
 await repo.save({id:'W1',revision:0,log:fin('W1','2026-11-01T10:00:00.000+00:00','2026-11-01T11:00:00.000+00:00',[exercise('e1','v1',[set('s1',80,8)])])});
 const raw=JSON.parse((await db.execute("SELECT log_json FROM workout_logs WHERE id='W1'")).rows[0].log_json);
 for(const ex of raw.exercises)for(const s of ex.sets)delete s.kind;
 raw.logVersion=1;
 await db.execute({sql:"UPDATE workout_logs SET log_json=? WHERE id='W1'",args:[JSON.stringify(raw)]});
 const r=await repo.lastTime({variantIds:['v1','v2']});
 assert.deepEqual(r.v2.sets.map(s=>s.kind),['warmup','working']);
 assert.deepEqual(r.v1.sets.map(s=>s.kind),['working']);
});

test('history orders by real time across UTC offsets and paginates',async t=>{
 const {repo}=await setup(t);
 const l1=fin('L1','2026-11-03T10:00:00.000+02:00','2026-11-03T12:00:00.000+02:00');
 const l2=fin('L2','2026-11-03T09:30:00.000+00:00','2026-11-03T10:30:00.000+00:00');
 await repo.save({id:'L1',revision:0,log:l1});await repo.save({id:'L2',revision:0,log:l2});
 await repo.save({id:'act',revision:0,log:mk({id:'act'})});
 assert.deepEqual(await repo.list(),{records:[workoutSummary(l2),workoutSummary(l1)],hasMore:false});
 for(let i=0;i<29;i++){
  const id='M'+String(i).padStart(2,'0');
  await repo.save({id,revision:0,log:fin(id,'2026-10-01T10:00:00.000+00:00','2026-10-01T11:00:00.000+00:00')});
 }
 const first=await repo.list();
 assert.equal(first.records.length,30);assert.equal(first.hasMore,true);
 const last=first.records.at(-1);
 const second=await repo.list({before:last.startedAt,beforeId:last.id});
 assert.equal(second.records.length,1);assert.equal(second.hasMore,false);
 assert.equal(new Set([...first.records,...second.records].map(r=>r.id)).size,31);
});

test('stored version 1 logs are summarized and read back as version 2',async t=>{
 const {db,repo}=await setup(t);
 const v1={id:'old',logVersion:1,status:'finished',name:'Old',startedAt:'2026-11-03T10:00:00.000+00:00',finishedAt:'2026-11-03T11:00:00.000+00:00',source:{kind:'blank'},
  exercises:[exercise('e1','v1',[set('s1',80,8),set('s2',80,8)])]};
 await db.execute({sql:'INSERT INTO workout_logs(id,revision,status,started_at,finished_at,log_json,created_at,updated_at) VALUES(?,1,?,?,?,?,?,?)',
  args:['old','finished',v1.startedAt,v1.finishedAt,JSON.stringify(v1),'x','x']});
 assert.equal((await repo.list()).records[0].doneSets,2);
 const got=(await repo.get('old')).log;
 assert.equal(got.logVersion,2);assert.ok(got.exercises[0].sets.every(s=>s.kind==='working'));
});
