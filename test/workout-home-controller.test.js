import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutHomeController} from '../src/workout-home-controller.js';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(over={}){
 let snapshot={activeLog:null,pending:null},listener;
 const states=[],starts=[],nav=[],sheets=[],tasks=new Map(),events=new EventTarget();let suppressed=0;
 const workouts={homeSnapshot:()=>structuredClone(snapshot),subscribe(fn){listener=fn;fn({reason:'ownership',snapshot});return()=>listener=null;},
  suppressBar(){suppressed++;return()=>suppressed--;},start:async options=>{starts.push(options);return false;},...over.workouts};
 const template={id:'t',kind:'template',document:{name:'Push',coverId:'barbell',exercises:[],goals:{}}};
 const api={getSettings:async()=>({activeProgramId:'p'}),list:async()=>[{id:'p',name:'P'}],listWorkouts:async()=>({records:[]}),
  programBundle:async()=>({record:{id:'p',document:{name:'P',mode:'simple',workouts:[{id:'a',templateId:'t',day:null},{id:'b',templateId:'t',day:null}]}},templates:[template]}),...over.api};
 const launcher={open:options=>sheets.push(options),destroy(){}};
 let timer=0;
 const controller=createWorkoutHomeController({api,workouts,launcher,onNavigate:h=>nav.push(h),onError:()=>{},onState:s=>states.push(s),
  now:()=>new Date(2026,10,6,12),events,timers:{setTimeout(fn,ms){tasks.set(++timer,{fn,ms});return timer;},clearTimeout:id=>tasks.delete(id)}});
 return {controller,api,workouts,states,starts,nav,sheets,tasks,events,get suppressed(){return suppressed;},
  emit(value,reason='change'){snapshot=value;listener?.({reason,snapshot:structuredClone(snapshot)});}};
}
test('local Resume renders before delayed recommendation and survives its failure',async()=>{
 const wait=deferred(),s=setup({api:{getSettings:()=>wait.promise},workouts:{homeSnapshot:()=>({activeLog:{id:'local',status:'active',name:'Offline',exercises:[]},pending:null}),subscribe(fn){fn({reason:'ownership',snapshot:this.homeSnapshot()});return()=>{};}}});
 assert.equal(s.states.at(-1).kind,'resume');assert.equal(s.suppressed,1);
 s.controller.resume();assert.deepEqual(s.nav,['#/workouts/local']);
 wait.reject(Error('offline'));await tick();assert.equal(s.states.at(-1).kind,'resume');
 s.controller.destroy();assert.equal(s.suppressed,0);assert.equal(s.tasks.size,0);
});
test('successful recommendation starts once and cancellation or error restores controls',async()=>{
 const s=setup();await tick();assert.equal(s.states.at(-1).kind,'recommendation');
 const pending=deferred();s.workouts.start=options=>{s.starts.push(options);return pending.promise;};
 const first=s.controller.start();await s.controller.start();assert.equal(s.starts.length,1);
 assert.equal(s.starts[0].occurrenceId,'a');assert.equal(s.starts[0].template.document.coverId,'barbell');
 pending.resolve(false);await first;assert.equal(s.states.at(-1).starting,false);
 s.workouts.start=async()=>{throw Error('start failed');};await s.controller.start();
 assert.equal(s.states.at(-1).error,'start failed');assert.equal(s.states.at(-1).starting,false);s.controller.destroy();
});
test('unknown required data never becomes an empty or first-session recommendation',async()=>{
 for(const field of ['getSettings','listWorkouts','programBundle']){
  const s=setup({api:{[field]:async()=>{throw Error('offline');}}});await tick();
  assert.equal(s.states.at(-1).kind,'error');assert.equal(s.states.at(-1).canStart,false);s.controller.destroy();
 }
 const s=setup({api:{list:async kind=>{if(kind==='template')throw Error('offline');return [{id:'p',name:'P'}];}}});
 await tick();assert.equal(s.states.at(-1).kind,'recommendation');s.controller.destroy();
});
test('no active setting has setup fallback and failed refresh disables a stale Start',async()=>{
 const empty=setup({api:{getSettings:async()=>({activeProgramId:null})}});await tick();
 assert.equal(empty.states.at(-1).kind,'empty');assert.equal(empty.states.at(-1).setupAction,'set-active');
 empty.controller.choose({setup:true});assert.equal(empty.sheets.at(-1).initialTab,'program');empty.controller.destroy();
 const s=setup();await tick();s.api.getSettings=async()=>{throw Error('offline');};await s.controller.refresh();
 assert.equal(s.states.at(-1).kind,'recommendation');assert.equal(s.states.at(-1).canStart,false);
 await s.controller.start();assert.equal(s.starts.length,0);s.controller.destroy();
});
test('pending finish advances once, active updates do not reload, late data cannot replace Resume',async()=>{
 const wait=deferred(),s=setup();await tick();
 const pending={id:'done',name:'Push',startedAt:'2026-11-06T10:00:00Z',source:{kind:'program',programId:'p',occurrenceId:'a'}};
 s.emit({activeLog:null,pending},'finish');await tick();
 assert.equal(s.states.at(-1).recommendation.next.occurrenceId,'b');
 s.api.listWorkouts=async()=>({records:[pending]});await s.controller.refresh();
 assert.equal(s.states.at(-1).recommendation.next.occurrenceId,'b');
 s.api.getSettings=()=>wait.promise;const loading=s.controller.refresh();
 s.emit({activeLog:{id:'new',status:'active',name:'New',exercises:[]},pending:null},'ownership');
 wait.resolve({activeProgramId:'p'});await loading;assert.equal(s.states.at(-1).kind,'resume');
 const count=s.states.length;s.controller.destroy();s.emit({activeLog:null,pending:null},'signout');
 assert.equal(s.states.length,count);
});
test('new refresh wins out of order and focus/midnight listeners clean up',async()=>{
 const first=deferred(),s=setup({api:{getSettings:()=>first.promise}});await tick();
 s.api.getSettings=async()=>({activeProgramId:null});await s.controller.refresh();
 first.resolve({activeProgramId:'p'});await tick();assert.equal(s.states.at(-1).kind,'empty');
 assert.equal([...s.tasks.values()][0].ms,43200000);
 let loads=0;s.api.getSettings=async()=>{loads++;return {activeProgramId:null};};
 s.events.dispatchEvent(new Event('focus'));await tick();assert.equal(loads,1);
 const [timerId,timer]=[...s.tasks][0];s.tasks.delete(timerId);timer.fn();await tick();assert.equal(loads,2);
 s.controller.destroy();s.events.dispatchEvent(new Event('focus'));await tick();
 assert.equal(loads,2);assert.equal(s.tasks.size,0);
});
