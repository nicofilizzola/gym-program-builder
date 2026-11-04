import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkoutLog} from '../src/workout-log.js';
import {addSet} from '../src/workout-edit.js';
import {MIRROR_KEY,readMirror,writeMirror,clearMirror,backoffDelay,isNetworkError,conflictReason,recoveryDecision,createWorkoutSync} from '../src/workout-sync.js';

const log=(over={})=>({id:'w1',logVersion:1,status:'active',name:'Push',startedAt:'2026-11-03T18:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[],...over});
const memoryStorage=()=>{const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,String(v));},removeItem:k=>{map.delete(k);}};};
const throwingStorage=()=>({getItem:()=>null,setItem:()=>{throw Object.assign(Error('quota'),{name:'QuotaExceededError'});},removeItem:()=>{}});
const fakeTimers=()=>{
 let next=1;const tasks=new Map(),delays=[];
 return {tasks,delays,
  setTimeout(fn,ms){const id=next++;tasks.set(id,{fn,ms});delays.push(ms);return id;},
  clearTimeout(id){tasks.delete(id);},
  pending:ms=>[...tasks.values()].filter(t=>ms===undefined||t.ms===ms).length,
  run(ms){for(const [id,t] of [...tasks]){if(ms!==undefined&&t.ms!==ms)continue;tasks.delete(id);t.fn();}}};
};
const settle=()=>new Promise(r=>setTimeout(r,0));
const httpError=(status,reason)=>Object.assign(Error('HTTP '+status),{status,code:'x',details:reason?{reason}:undefined});
const make=(over={})=>{
 const storage=over.storage??memoryStorage(),timers=over.timers??fakeTimers(),events=over.events??new EventTarget();
 const statuses=[],records=[],conflicts=[];
 const sync=createWorkoutSync({api:over.api,storage,timers,events,record:over.record??{id:'w1',revision:0,log:log()},lastTime:over.lastTime??null,dirty:over.dirty??false,
  onStatus:s=>statuses.push(s),onRecord:r=>records.push(r),onConflict:r=>conflicts.push(r)});
 return {sync,storage,timers,events,statuses,records,conflicts};
};
const echoApi=()=>{const calls=[];let rev=0;return {calls,saveWorkout:async({id,revision,log:l})=>{calls.push({id,revision,log:structuredClone(l)});rev=revision+1;return {id,revision:rev,log:structuredClone(l)};}};};

test('backoff schedule',()=>{assert.deepEqual([0,1,2,3,4,9].map(backoffDelay),[2000,4000,8000,16000,30000,30000]);});

test('error classification',()=>{
 assert.equal(isNetworkError(new TypeError('Failed to fetch')),true);
 assert.equal(isNetworkError(httpError(503)),true);
 assert.equal(isNetworkError(httpError(500)),true);
 assert.equal(isNetworkError(httpError(401)),false);
 assert.equal(isNetworkError(httpError(409)),false);
 assert.equal(conflictReason(httpError(409,'revision_conflict')),'revision_conflict');
 assert.equal(conflictReason(httpError(409,'active_exists')),'active_exists');
 assert.equal(conflictReason(httpError(409)),'revision_conflict');
 assert.equal(conflictReason(httpError(500)),null);
 assert.equal(conflictReason(new TypeError('x')),null);
});

test('mirror helpers read, write and clear; corrupt or failing storage reads as null',()=>{
 const s=memoryStorage();const m={log:log(),baseRevision:2,dirty:true,lastTime:{v:{sets:[]}}};
 assert.equal(readMirror(s),null);
 assert.equal(writeMirror(s,m),true);assert.deepEqual(readMirror(s),m);assert.ok(s.map.has(MIRROR_KEY));
 clearMirror(s);assert.equal(readMirror(s),null);
 s.setItem(MIRROR_KEY,'{not json');assert.equal(readMirror(s),null);
 s.setItem(MIRROR_KEY,JSON.stringify({log:null,baseRevision:1,dirty:true}));assert.equal(readMirror(s),null);
 assert.equal(writeMirror(throwingStorage(),m),false);
 const broken={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');},removeItem:()=>{throw Error('denied');}};
 assert.equal(readMirror(broken),null);assert.doesNotThrow(()=>clearMirror(broken));
});

test('recoveryDecision covers every row of the table',()=>{
 const rec=(revision,status='active')=>({id:'w1',revision,log:log({status})});
 const clean=b=>({log:log(),baseRevision:b,dirty:false,lastTime:null});
 const dirty=b=>({log:log(),baseRevision:b,dirty:true,lastTime:null});
 const d=a=>recoveryDecision(a).action;
 assert.equal(d({mirror:null,server:rec(3),reachable:true}),'use-server');
 assert.equal(d({mirror:null,server:null,reachable:true}),'none');
 assert.equal(d({mirror:null,server:null,reachable:false}),'none');
 assert.equal(d({mirror:clean(3),server:rec(3),reachable:true}),'use-server');
 assert.equal(d({mirror:clean(3),server:rec(4,'finished'),reachable:true}),'clear-mirror');
 assert.equal(d({mirror:clean(3),server:null,reachable:true}),'clear-mirror');
 assert.equal(d({mirror:dirty(3),server:null,reachable:false}),'resume-local');
 assert.equal(d({mirror:dirty(0),server:null,reachable:true}),'resume-local');
 assert.equal(d({mirror:dirty(3),server:rec(3),reachable:true}),'resume-local');
 assert.equal(d({mirror:dirty(3),server:rec(4),reachable:true}),'conflict');
 assert.equal(d({mirror:dirty(3),server:null,reachable:true}),'conflict');
 // Outside the table: never discard local data.
 assert.equal(d({mirror:clean(3),server:null,reachable:false}),'resume-local');
 assert.equal(d({mirror:clean(0),server:null,reachable:true}),'resume-local');
});

test('every change is mirrored synchronously before saving',async()=>{
 const api=echoApi();const {sync,storage,timers,statuses}=make({api,lastTime:{v1:{sets:[]}}});
 sync.change(log({name:'Legs'}));
 const m=readMirror(storage);assert.equal(m.log.name,'Legs');assert.equal(m.dirty,true);assert.equal(m.baseRevision,0);assert.deepEqual(m.lastTime,{v1:{sets:[]}});
 assert.equal(api.calls.length,0);assert.equal(timers.delays[0],400);
 timers.run(400);await settle();
 assert.equal(api.calls.length,1);assert.equal(api.calls[0].revision,0);
 const after=readMirror(storage);assert.equal(after.baseRevision,1);assert.equal(after.dirty,false);assert.equal(after.log.name,'Legs');
 assert.equal(statuses.at(-1),'Saved');assert.equal(sync.revision,1);assert.equal(sync.log.name,'Legs');assert.equal(sync.isDirty(),false);
 sync.setLastTime({v2:{sets:[]}});assert.deepEqual(readMirror(storage).lastTime,{v2:{sets:[]}});assert.deepEqual(sync.lastTime,{v2:{sets:[]}});
 sync.dispose();assert.ok(readMirror(storage),'dispose keeps the mirror');
});

test('a change made while a save is in flight stays dirty in the mirror',async()=>{
 let release;const calls=[];
 const api={saveWorkout:({id,revision,log:l})=>{calls.push(revision);return new Promise(r=>{release=()=>r({id,revision:revision+1,log:l});});}};
 const {sync,storage,timers}=make({api});
 sync.change(log({name:'A'}));timers.run(400);await settle();
 sync.change(log({name:'B'}));release();await settle();
 const m=readMirror(storage);assert.equal(m.log.name,'B');assert.equal(m.dirty,true);assert.equal(m.baseRevision,1);
 timers.run(400);await settle();release();await settle();
 assert.deepEqual(calls,[0,1]);assert.equal(readMirror(storage).dirty,false);assert.equal(readMirror(storage).log.name,'B');sync.dispose();
});

test('mirror is cleared once a finished log is acknowledged and nothing is dirty',async()=>{
 const api=echoApi();const {sync,storage,timers}=make({api,record:{id:'w1',revision:2,log:log()}});
 sync.change(log({status:'finished',finishedAt:'2026-11-03T19:00:00.000+01:00'}));
 assert.equal(readMirror(storage).dirty,true);
 timers.run(400);await settle();assert.equal(readMirror(storage),null);sync.dispose();
});

test('a dirty resumed log saves automatically',async()=>{
 const api=echoApi();const {sync,storage,timers}=make({api,dirty:true,record:{id:'w1',revision:3,log:log({name:'Local'})}});
 assert.equal(readMirror(storage).dirty,true);timers.run(400);await settle();
 assert.deepEqual(api.calls.map(c=>[c.revision,c.log.name]),[[3,'Local']]);assert.equal(readMirror(storage).dirty,false);sync.dispose();
});

test('network failures retry automatically with backoff and on online',async()=>{
 let n=0;const calls=[];
 const api={saveWorkout:async({id,revision,log:l})=>{calls.push(revision);n++;if(n<=2)throw new TypeError('Failed to fetch');return {id,revision:revision+1,log:l};}};
 const {sync,storage,timers,events,statuses}=make({api});
 sync.change(log({name:'Offline set'}));timers.run(400);await settle();
 assert.equal(statuses.at(-1),'Offline · saved on this device');assert.equal(timers.pending(2000),1);
 // Editing while offline neither saves nor schedules a duplicate retry.
 sync.change(log({name:'Offline set 2'}));assert.equal(statuses.at(-1),'Offline · saved on this device');assert.equal(timers.tasks.size,1);
 assert.equal(readMirror(storage).log.name,'Offline set 2');
 timers.run(2000);await settle();
 assert.equal(calls.length,2);assert.equal(timers.pending(4000),1);
 events.dispatchEvent(new Event('online'));events.dispatchEvent(new Event('online'));await settle();
 assert.equal(calls.length,4,'replays the failed envelope, then saves the newer edit, once');
 assert.equal(timers.tasks.size,0);assert.equal(statuses.at(-1),'Saved');
 assert.deepEqual(timers.delays.filter(d=>d!==400),[2000,4000]);
 assert.equal(readMirror(storage).dirty,false);assert.equal(readMirror(storage).log.name,'Offline set 2');
 // A later failure starts the schedule again from 2 s.
 n=0;sync.change(log({name:'Again'}));timers.run(400);await settle();assert.equal(timers.pending(2000),1);
 sync.dispose();assert.equal(timers.tasks.size,0,'dispose cancels the retry');
 events.dispatchEvent(new Event('online'));await settle();assert.equal(calls.length,5,'online after dispose does nothing');
});

test('5xx counts as offline; other 4xx pause without retry',async()=>{
 const api={saveWorkout:async()=>{throw httpError(503);}};
 const a=make({api});a.sync.change(log());a.timers.run(400);await settle();
 assert.equal(a.statuses.at(-1),'Offline · saved on this device');assert.equal(a.timers.pending(2000),1);a.sync.dispose();
 const b=make({api:{saveWorkout:async()=>{throw httpError(400);}}});b.sync.change(log());b.timers.run(400);await settle();
 assert.equal(b.statuses.at(-1),'Couldn’t save');assert.equal(b.timers.tasks.size,0);b.sync.dispose();
});

test('401 and 409 pause without retry',async()=>{
 const a=make({api:{saveWorkout:async()=>{throw httpError(401);}}});
 a.sync.change(log({name:'Kept'}));a.timers.run(400);await settle();
 assert.equal(a.statuses.at(-1),'Sign in to sync');assert.equal(a.timers.tasks.size,0);
 assert.equal(readMirror(a.storage).log.name,'Kept');assert.equal(readMirror(a.storage).dirty,true);
 a.events.dispatchEvent(new Event('online'));await settle();assert.equal(a.timers.tasks.size,0);a.sync.dispose();
 for(const reason of ['revision_conflict','active_exists']){
  const c=make({api:{saveWorkout:async()=>{throw httpError(409,reason);}}});
  c.sync.change(log());c.timers.run(400);await settle();
  assert.equal(c.statuses.at(-1),'Conflict');assert.deepEqual(c.conflicts,[reason]);assert.equal(c.timers.tasks.size,0);
  assert.equal(readMirror(c.storage).dirty,true);c.sync.dispose();
 }
});

test('keepLocal overwrites with the server revision; useSaved replaces local',async()=>{
 // revision_conflict
 {
  const calls=[];let conflict=true;
  const api={getWorkout:async id=>({id,revision:7,log:log({name:'Server'})}),
   saveWorkout:async({id,revision,log:l})=>{calls.push([revision,l.name]);if(conflict){conflict=false;throw httpError(409,'revision_conflict');}return {id,revision:revision+1,log:l};}};
  const {sync,storage,timers,conflicts,statuses}=make({api,record:{id:'w1',revision:5,log:log()}});
  sync.change(log({name:'Local'}));timers.run(400);await settle();assert.deepEqual(conflicts,['revision_conflict']);
  const keeping=sync.keepLocal();assert.equal(readMirror(storage).log.name,'Local');await keeping;
  assert.deepEqual(calls,[[5,'Local'],[7,'Local']]);assert.equal(sync.revision,8);assert.equal(readMirror(storage).log.name,'Local');
  assert.equal(readMirror(storage).dirty,false);assert.equal(statuses.at(-1),'Saved');sync.dispose();
 }
 // revision_conflict where the server copy was deleted
 {
  const calls=[];let conflict=true;
  const api={getWorkout:async()=>{throw httpError(404);},
   saveWorkout:async({id,revision,log:l})=>{calls.push(revision);if(conflict){conflict=false;throw httpError(409,'revision_conflict');}return {id,revision:revision+1,log:l};}};
  const {sync,timers}=make({api,record:{id:'w1',revision:5,log:log()}});
  sync.change(log({name:'Local'}));timers.run(400);await settle();
  await sync.keepLocal();assert.deepEqual(calls,[5,0]);sync.dispose();
 }
 // active_exists
 {
  const calls=[],deleted=[];let conflict=true;
  const api={activeWorkout:async()=>({id:'other',revision:4,log:log({id:'other'})}),deleteWorkout:async args=>{deleted.push(args);},
   saveWorkout:async({id,revision,log:l})=>{calls.push([id,revision]);if(conflict){conflict=false;throw httpError(409,'active_exists');}return {id,revision:revision+1,log:l};}};
  const {sync,timers,conflicts}=make({api});
  sync.change(log({name:'Local'}));timers.run(400);await settle();assert.deepEqual(conflicts,['active_exists']);
  await sync.keepLocal();
  assert.deepEqual(deleted,[{id:'other',revision:4}]);assert.deepEqual(calls,[['w1',0],['w1',0]]);assert.equal(sync.revision,1);sync.dispose();
 }
 // useSaved with a server record
 {
  const api={getWorkout:async id=>({id,revision:9,log:log({name:'Server'})}),saveWorkout:async()=>{throw httpError(409,'revision_conflict');}};
  const {sync,storage,timers}=make({api,record:{id:'w1',revision:5,log:log()}});
  sync.change(log({name:'Local'}));timers.run(400);await settle();
  const saved=await sync.useSaved();assert.equal(saved.revision,9);assert.equal(saved.log.name,'Server');
  const m=readMirror(storage);assert.equal(m.log.name,'Server');assert.equal(m.dirty,false);assert.equal(m.baseRevision,9);
  assert.equal(sync.log.name,'Server');assert.equal(sync.isDirty(),false);sync.dispose();
 }
 // useSaved when the server copy is gone
 {
  const api={getWorkout:async()=>{throw httpError(404);},saveWorkout:async()=>{throw httpError(409,'revision_conflict');}};
  const {sync,storage,timers}=make({api,record:{id:'w1',revision:5,log:log()}});
  sync.change(log({name:'Local'}));timers.run(400);await settle();
  assert.equal(await sync.useSaved(),null);assert.equal(readMirror(storage),null);sync.dispose();
 }
});

test('storage failure never blocks logging',async()=>{
 const api=echoApi();const {sync,timers,statuses}=make({api,storage:throwingStorage()});
 assert.doesNotThrow(()=>sync.change(log({name:'Set'})));
 assert.equal(statuses.at(-1),'Not saved on this device');
 timers.run(400);await settle();assert.equal(api.calls.length,1);assert.equal(statuses.at(-1),'Not saved on this device');
 assert.ok(!statuses.includes('Offline · saved on this device'));assert.ok(!statuses.includes('Saved'));
 sync.dispose();
});

test('offline with a failing mirror reports it is not saved on this device',async()=>{
 const api={saveWorkout:async()=>{throw new TypeError('Failed to fetch');}};
 const {sync,timers,statuses}=make({api,storage:throwingStorage()});
 sync.change(log());timers.run(400);await settle();
 assert.equal(statuses.at(-1),'Not saved on this device');assert.equal(timers.pending(2000),1);sync.dispose();
});

test('a failed mirror write never leaves an older copy behind',async()=>{
 const api=echoApi();const storage=memoryStorage();let broken=false;const set=storage.setItem;
 storage.setItem=(k,v)=>{if(broken)throw Error('quota');set(k,v);};
 const {sync,timers,statuses}=make({api,storage,record:{id:'w1',revision:2,log:log()}});
 sync.change(log({name:'A'}));assert.equal(readMirror(storage).log.name,'A');
 broken=true;sync.change(log({name:'B'}));
 assert.equal(readMirror(storage),null,'stale dirty mirror removed');assert.equal(statuses.at(-1),'Not saved on this device');
 timers.run(400);await settle();assert.equal(api.calls.at(-1).log.name,'B');
 assert.equal(readMirror(storage),null);assert.equal(statuses.at(-1),'Not saved on this device','ack whose mirror write failed keeps the warning');
 broken=false;sync.change(log({name:'C'}));timers.run(400);await settle();
 assert.equal(statuses.at(-1),'Saved');assert.equal(readMirror(storage).log.name,'C');assert.equal(readMirror(storage).dirty,false);sync.dispose();
});

test('resume after sign-in replays the paused save',async()=>{
 let signedIn=false;const calls=[];
 const api={saveWorkout:async({id,revision,log:l})=>{calls.push(revision);if(!signedIn)throw httpError(401);return {id,revision:revision+1,log:l};}};
 const {sync,storage,timers,statuses}=make({api,record:{id:'w1',revision:2,log:log()}});
 await sync.resume();assert.equal(calls.length,0,'no-op when not paused');
 sync.change(log({name:'Set'}));timers.run(400);await settle();assert.equal(statuses.at(-1),'Sign in to sync');
 signedIn=true;await sync.resume();
 assert.deepEqual(calls,[2,2]);assert.equal(statuses.at(-1),'Saved');
 const m=readMirror(storage);assert.equal(m.dirty,false);assert.equal(m.baseRevision,3);assert.equal(m.log.name,'Set');
 await sync.resume();assert.equal(calls.length,2);sync.dispose();
});

test('resume leaves a conflict to the conflict flow',async()=>{
 const calls=[];const api={saveWorkout:async()=>{calls.push(1);throw httpError(409,'revision_conflict');}};
 const {sync,timers,statuses}=make({api});
 sync.change(log());timers.run(400);await settle();await sync.resume();
 assert.equal(calls.length,1);assert.equal(statuses.at(-1),'Conflict');sync.dispose();
});

test('keepLocal never re-activates a finished server copy; a finishing transform saves it finished at the server revision',async()=>{
 const finishedAt='2026-11-03T19:00:00.000+01:00';
 const server={id:'w1',revision:7,log:log({name:'Server',status:'finished',finishedAt})};
 const calls=[];let conflict=true;
 const api={getWorkout:async()=>structuredClone(server),
  saveWorkout:async({id,revision,log:l})=>{
   calls.push([revision,l.status,l.name]);
   if(conflict){conflict=false;throw httpError(409,'revision_conflict');}
   if(revision===server.revision&&l.status==='active')throw httpError(400);
   return {id,revision:revision+1,log:l};
  }};
 const {sync,storage,timers,conflicts,statuses}=make({api,record:{id:'w1',revision:5,log:log()}});
 sync.change(log({name:'Local'}));timers.run(400);await settle();assert.deepEqual(conflicts,['revision_conflict']);
 assert.equal((await sync.savedVersion()).log.status,'finished');
 // Without finishing, Keep is refused before any save: the local copy and the conflict stay.
 await assert.rejects(sync.keepLocal(),{code:'finished_elsewhere',message:'This workout was finished on another device.'});
 assert.equal(calls.length,1);assert.equal(readMirror(storage).log.name,'Local');assert.equal(readMirror(storage).dirty,true);
 // Finishing the local copy saves it over the finished server copy.
 await sync.keepLocal({transform:l=>({...l,status:'finished',finishedAt})});
 assert.deepEqual(calls.at(-1),[7,'finished','Local']);assert.equal(sync.revision,8);
 assert.equal(readMirror(storage),null,'a synced finish clears the mirror');assert.equal(statuses.at(-1),'Saved');sync.dispose();
});

test('keepLocal for active_exists only discards the workout that was confirmed',async()=>{
 const deleted=[];let active={id:'third',revision:2,log:log({id:'third'})};let conflict=true;
 const api={activeWorkout:async()=>active,deleteWorkout:async args=>{deleted.push(args);},
  saveWorkout:async({id,revision,log:l})=>{if(conflict){conflict=false;throw httpError(409,'active_exists');}return {id,revision:revision+1,log:l};}};
 const {sync,timers}=make({api});
 sync.change(log({name:'Local'}));timers.run(400);await settle();
 await assert.rejects(sync.keepLocal({otherId:'other'}),{code:'other_changed'});
 await assert.rejects(sync.keepLocal({otherId:null}),{code:'other_changed'},'none was active when chosen');
 assert.deepEqual(deleted,[]);
 active={id:'other',revision:4,log:log({id:'other'})};
 await sync.keepLocal({otherId:'other'});
 assert.deepEqual(deleted,[{id:'other',revision:4}]);assert.equal(sync.revision,1);sync.dispose();
});

test('resume replays a paused non-network failure (Retry)',async()=>{
 let fail=true;const calls=[];
 const api={saveWorkout:async({id,revision,log:l})=>{calls.push(revision);if(fail)throw httpError(400);return {id,revision:revision+1,log:l};}};
 const {sync,timers,statuses}=make({api,record:{id:'w1',revision:2,log:log()}});
 sync.change(log({name:'Set'}));timers.run(400);await settle();
 assert.equal(statuses.at(-1),'Couldn’t save');assert.equal(timers.tasks.size,0);
 fail=false;await sync.resume();assert.deepEqual(calls,[2,2]);assert.equal(statuses.at(-1),'Saved');sync.dispose();
});

test('a dirty version 1 mirror recovers as before and validates to version 2',()=>{
 const v1=log({exercises:[{id:'e1',variantId:null,referenceId:null,name:'Row',equipment:null,primaryMuscles:['Lats'],secondaryMuscles:[],
  target:{sets:1,repRange:{min:8,max:12},restSeconds:90},sets:[{id:'s1',weightKg:null,reps:null,rir:null,done:false}]}]});
 const storage=memoryStorage();writeMirror(storage,{log:v1,baseRevision:3,dirty:true,lastTime:null});
 const mirror=readMirror(storage);
 assert.equal(recoveryDecision({mirror,server:{id:'w1',revision:3,log:v1},reachable:true}).action,'resume-local');
 assert.equal(recoveryDecision({mirror,server:{id:'w1',revision:4,log:v1},reachable:true}).action,'conflict');
 const r=validateWorkoutLog(mirror.log);
 assert.equal(r.log.logVersion,2);assert.equal(r.log.exercises[0].sets[0].kind,'working');
});

test('a version 1 log is upgraded on adopt, so the first edit saves',async()=>{
 const v1=log({exercises:[{id:'e1',variantId:null,referenceId:null,name:'Row',equipment:null,primaryMuscles:['Lats'],secondaryMuscles:[],
  target:{sets:1,repRange:{min:8,max:12},restSeconds:90},sets:[{id:'s1',weightKg:null,reps:null,rir:null,done:false}]}]});
 const api=echoApi(),{sync,timers}=make({api,record:{id:'w1',revision:2,log:v1}});
 assert.equal(sync.log.logVersion,2);
 sync.change(addSet(sync.log,'e1',()=>'n1'));
 timers.run();await settle();
 assert.equal(api.calls.length,1);
 assert.equal(api.calls[0].log.logVersion,2);assert.ok(validateWorkoutLog(api.calls[0].log).log);
});
