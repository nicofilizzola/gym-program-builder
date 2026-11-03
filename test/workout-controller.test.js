import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutController,NO_SETS,OFFLINE_DISCARD,PENDING_FINISH,UNRECOVERED,linkedVariantIds} from '../src/workout-controller.js';
import {readMirror,writeMirror} from '../src/workout-sync.js';

const log=(over={})=>({id:'w1',logVersion:1,status:'active',name:'Push',startedAt:'2026-11-03T18:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[],...over});
const doneExercise={id:'e1',variantId:'v1',referenceId:'r1',name:'Bench',equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],target:null,sets:[{id:'s1',weightKg:50,reps:8,rir:null,done:true}]};
const memoryStorage=()=>{const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,String(v));},removeItem:k=>{map.delete(k);}};};
const offline=()=>new TypeError('Failed to fetch');
const httpError=(status,reason)=>Object.assign(Error('HTTP '+status),{status,details:reason?{reason}:undefined});
const settle=()=>new Promise(r=>setTimeout(r,0));
const idleTimers={setTimeout:()=>0,clearTimeout:()=>{}};

/** In-memory server: one map of records with revision checks. */
function fakeApi(over={}){
 const records=new Map(),calls=[];
 const api={records,calls,
  activeWorkout:async()=>[...records.values()].find(r=>r.log.status==='active')??null,
  getWorkout:async id=>{calls.push(['get',id]);if(!records.has(id))throw httpError(404);return structuredClone(records.get(id));},
  saveWorkout:async({id,revision,log:l})=>{calls.push(['save',id,revision]);const stored=records.get(id);if((stored?.revision??0)!==revision)throw httpError(409,'revision_conflict');const r={id,revision:revision+1,log:structuredClone(l)};records.set(id,r);return structuredClone(r);},
  deleteWorkout:async({id,revision})=>{calls.push(['delete',id,revision]);const stored=records.get(id);if(!stored)return;if(stored.revision!==revision)throw httpError(409,'revision_conflict');records.delete(id);},
  lastTime:async()=>({}),
  ...over};
 return api;
}
function make({api=fakeApi(),storage=memoryStorage(),choices=[],confirms=[]}={}){
 const navigations=[],errors=[],asked=[],bar={shown:null,show(d){this.shown=d;},hide(){this.shown=null;}};
 let clock=Date.parse('2026-11-03T18:00:00Z');
 const controller=createWorkoutController({api,storage,timers:idleTimers,now:()=>new Date(clock+=60000),events:new EventTarget(),bar,
  choose:async options=>{asked.push(options);return choices.shift()??null;},confirm:async options=>{asked.push(options);return confirms.shift()??false;},
  navigate:async hash=>{navigations.push(hash);},onError:error=>errors.push(error)});
 return {controller,api,storage,navigations,errors,asked,bar};
}

test('linked variant ids are unique and skip unlinked exercises',()=>{
 assert.deepEqual(linkedVariantIds(log({exercises:[{variantId:'a'},{variantId:null},{variantId:'a'},{variantId:'b'}]})),['a','b']);
});

test('boot adopts a server active log, or resumes a dirty mirror without dropping either log',async()=>{
 {
  const api=fakeApi();api.records.set('other',{id:'other',revision:2,log:log({id:'other',name:'Legs'})});
  const {controller,bar}=make({api});await controller.boot();
  assert.equal(controller.current.log.id,'other');controller.refreshBar();assert.equal(bar.shown.name,'Legs');
 }
 {
  // Dirty mirror of an unsynced log while another device's log is active: the mirror's log is kept.
  const api=fakeApi(),storage=memoryStorage();api.records.set('other',{id:'other',revision:2,log:log({id:'other'})});
  writeMirror(storage,{log:log({name:'Local'}),baseRevision:0,dirty:true,lastTime:null});
  const {controller}=make({api,storage});await controller.boot();
  assert.equal(controller.current.log.id,'w1');assert.ok(api.calls.some(c=>c[0]==='get'&&c[1]==='w1'));
  assert.equal(readMirror(storage).log.name,'Local');
 }
 {
  const storage=memoryStorage();writeMirror(storage,{log:log(),baseRevision:3,dirty:true,lastTime:{v1:null}});
  const api=fakeApi({activeWorkout:async()=>{throw offline();}});
  const {controller}=make({api,storage});await controller.boot();
  assert.equal(controller.current.log.id,'w1');assert.equal(controller.current.sync.revision,3);
 }
});

test('start builds the log, then a second start asks Resume, Finish or Discard',async()=>{
 const {controller,api,navigations,asked}=make({choices:['resume']});
 const template={id:'t1',document:{name:'Push A',exercises:[]}};
 assert.equal(await controller.start({template}),true);
 const first=controller.current.log;
 assert.equal(first.name,'Push A');assert.deepEqual(first.source,{kind:'template',templateId:'t1',templateName:'Push A'});
 assert.equal(navigations.at(-1),'#/workouts/'+first.id);
 assert.equal(await controller.start({}),false);
 assert.equal(asked[0].title,'Workout in progress');
 assert.equal(asked[0].message,'Resume, finish or discard Push A before starting a new workout.');
 assert.deepEqual(asked[0].choices.map(c=>[c.value,c.label,Boolean(c.destructive)]),[['resume','Resume current',false],['finish','Finish current',false],['discard','Discard current',true]]);
 assert.equal(navigations.at(-1),'#/workouts/'+first.id);
 controller.current.sync.dispose();void api;
});

test('Finish current refuses a log without done sets',async()=>{
 const {controller}=make({choices:['finish']});
 await controller.start({});
 await assert.rejects(controller.start({}),{message:NO_SETS});
});

test('discard: rev>0 offline keeps the workout; rev 0 never acknowledged clears it; a missing log is success',async()=>{
 {
  const api=fakeApi();const {controller,storage}=make({api});
  await controller.start({});await controller.current.sync.flush();
  const id=controller.current.log.id;
  api.deleteWorkout=async()=>{throw offline();};
  await assert.rejects(controller.discard(),{message:OFFLINE_DISCARD});
  assert.equal(controller.current.log.id,id);assert.ok(readMirror(storage));
  api.deleteWorkout=async()=>{throw httpError(404);};
  assert.equal(await controller.discard(),true);assert.equal(controller.current,null);assert.equal(readMirror(storage),null);
 }
 {
  const api=fakeApi({saveWorkout:async()=>{throw offline();},getWorkout:async()=>{throw offline();}});
  const {controller,storage}=make({api});
  await controller.start({});
  assert.equal(await controller.discard(),true);assert.equal(readMirror(storage),null);
 }
});

test('a finished log waiting to sync is pending and blocks a new start',async()=>{
 const api=fakeApi();const {controller}=make({api,choices:['finish'],confirms:[]});
 await controller.start({});await controller.current.sync.flush();
 controller.current.sync.change({...controller.current.log,exercises:[doneExercise]});await controller.current.sync.flush();
 api.saveWorkout=async()=>{throw offline();};
 await assert.rejects(controller.start({}),{message:PENDING_FINISH});
 assert.equal(controller.current,null);
 assert.equal(controller.pendingSummary().doneSets,1);
});

test('conflict dialog: copy, Keep this device’s version, and re-entry is ignored while resolving',async()=>{
 const api=fakeApi();
 let release;const gate=new Promise(r=>{release=r;});
 const {controller,asked}=make({api,choices:['keep']});
 await controller.start({});await controller.current.sync.flush();
 const id=controller.current.log.id;
 api.records.get(id).revision=5;
 api.getWorkout=async()=>{await gate;return structuredClone(api.records.get(id));};
 controller.current.sync.change({...controller.current.log,name:'Local'});
 await controller.current.sync.flush().catch(()=>{});
 await settle();
 assert.equal(asked.length,1);
 assert.equal(asked[0].title,'Workout changed elsewhere');assert.equal(asked[0].message,'This workout was changed on another device.');
 assert.deepEqual(asked[0].choices.map(c=>c.label),["Keep this device's version",'Use saved version']);
 // While keepLocal waits, discard and further dialogs are ignored.
 assert.equal(await controller.discard(),false);
 assert.equal(asked.length,1);
 release();await settle();await settle();await controller.current.sync.flush();
 assert.equal(api.records.get(id).log.name,'Local');assert.equal(api.records.get(id).revision,6);
});

test('adopt takes over from a clean owned log but never from unsynced local changes',async()=>{
 const api=fakeApi();const {controller,storage}=make({api});
 await controller.start({});await controller.current.sync.flush();
 const other={id:'other',revision:1,log:log({id:'other',name:'Legs'})};
 assert.equal(controller.adopt(other),true);assert.equal(controller.current.log.id,'other');
 assert.equal(readMirror(storage).log.id,'other');
 controller.current.sync.change({...controller.current.log,name:'Edited'});
 assert.equal(controller.adopt({id:'third',revision:1,log:log({id:'third'})}),false);
 assert.equal(controller.current.log.name,'Edited');
 assert.equal(controller.adopt({id:'x',revision:1,log:log({id:'x',status:'finished'})}),false);
 controller.current.sync.dispose();
});

test('a failed boot is retried and never lets start or adopt overwrite an unowned dirty mirror',async()=>{
 const storage=memoryStorage();writeMirror(storage,{log:log({name:'Unsynced'}),baseRevision:2,dirty:true,lastTime:null});
 let failing=true;
 const api=fakeApi();const active=api.activeWorkout;
 api.activeWorkout=async()=>{if(failing)throw httpError(401);return active();};
 api.records.set('w1',{id:'w1',revision:2,log:log()});
 const {controller,asked}=make({api,storage});
 await assert.rejects(controller.boot(),{status:401});
 // Not booted: adopting another active log or starting must leave the mirror alone.
 assert.equal(controller.adopt({id:'other',revision:1,log:log({id:'other'})}),false);
 await assert.rejects(controller.start({}),{status:401});
 assert.equal(readMirror(storage).log.name,'Unsynced');assert.equal(readMirror(storage).dirty,true);
 // After sign-in the boot runs again and recovers the mirror, so start asks about it.
 failing=false;
 await controller.boot();
 assert.equal(controller.current.log.name,'Unsynced');
 assert.equal(await controller.start({}),false);
 assert.equal(asked.at(-1).title,'Workout in progress');
 assert.equal(readMirror(storage).log.name,'Unsynced');
 controller.current.sync.dispose();
});

test('start refuses while a dirty mirror is not owned after boot',async()=>{
 const storage=memoryStorage(),api=fakeApi();
 const {controller}=make({api,storage});
 await controller.boot();
 writeMirror(storage,{log:log({id:'stray',name:'Stray'}),baseRevision:0,dirty:true,lastTime:null});
 await assert.rejects(controller.start({}),{message:UNRECOVERED});
 assert.equal(controller.adopt({id:'other',revision:1,log:log({id:'other'})}),false);
 assert.equal(readMirror(storage).log.id,'stray');
});
