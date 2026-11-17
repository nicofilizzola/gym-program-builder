import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutAdvance} from '../src/workout-focus-advance.js';
import {focusFixture} from './fixtures/workout-focus.js';
const ref={exerciseId:'straight',setId:'sw'},next={exerciseId:'straight',setId:'s1'};
const a1={exerciseId:'a',setId:'a1'},b1={exerciseId:'b',setId:'b1'},a2={exerciseId:'a',setId:'a2'},b2={exerciseId:'b',setId:'b2'},a3={exerciseId:'a',setId:'a3'},b3={exerciseId:'b',setId:'b3'},e1={exerciseId:'empty',setId:'e1'};
const mark=(log,ids,done=true)=>{for(const ex of log.exercises)for(const s of ex.sets)if(ids.includes(s.id))s.done=done;return log;};
const working=id=>({id,kind:'working',weightKg:null,reps:8,rir:null,done:false,note:''});
// Three full rounds (A1/A2 ×3), then one straight set.
function threeRounds(){const log=focusFixture();log.exercises[1].sets.push(working('a3'));log.exercises[2].sets.push(working('b2'),working('b3'));log.exercises[3].sets.push(working('e1'));return log;}
// `log` is the state before `at` is completed; `finish` reports a further explicit completion on the current log, as the port does.
function harness({reduced=false,log=focusFixture(),ref:at=ref}={}){let time=0,id=0;const tasks=new Map(),jumps=[],before=log,after=mark(structuredClone(before),[at.setId]);const state={log:after,viewed:at,autoNext:true,suspended:false};const timers={setTimeout(fn,delay){tasks.set(++id,{fn,at:time+delay});return id;},clearTimeout(id){tasks.delete(id);},advance(ms){time+=ms;for(const [id,t] of tasks)if(t.at<=time){tasks.delete(id);t.fn();}}};const c=createWorkoutAdvance({read:()=>state,onAdvance:r=>{jumps.push(r);state.viewed=r;},timers,reduced:()=>reduced});
 const finish=(r,viewed=state.viewed)=>{const b=state.log,a=mark(structuredClone(b),[r.setId]);state.log=a;c.completed({before:b,after:a,ref:r,viewed,autoNext:state.autoNext});};
 return {c,state,jumps,timers,before,after,finish,complete:()=>c.completed({before,after,ref:at,viewed:at,autoNext:true})};}
test('advances only the current explicit completion at 650ms',()=>{const h=harness();h.complete();h.timers.advance(649);assert.deepEqual(h.jumps,[]);h.timers.advance(1);assert.deepEqual(h.jumps,[next]);});
test('browsing, repeated events, undo and preference off stay put',()=>{for(const which of ['browsing','repeat','undo','off']){const h=harness();if(which==='browsing')h.state.viewed=next;if(which==='off')h.state.autoNext=false;if(which==='repeat')h.before.exercises[0].sets[0].done=true;if(which==='undo')h.after.exercises[0].sets[0].done=false;h.complete();h.timers.advance(1000);assert.deepEqual(h.jumps,[],which);}});
test('removal, suspension, changed owner or viewed ref cancel a queued advance',()=>{for(const which of ['removal','suspend','owner','viewed','off','undo']){const h=harness();h.complete();if(which==='removal')h.state.log.exercises[0].sets.splice(1,1);if(which==='suspend')h.state.suspended=true;if(which==='owner')h.state.log.id='other';if(which==='viewed')h.state.viewed=next;if(which==='off')h.state.autoNext=false;if(which==='undo')h.state.log.exercises[0].sets[0].done=false;h.timers.advance(650);assert.deepEqual(h.jumps,[],which);}});
test('late state reads do not schedule without an explicit completion',()=>{const h=harness();h.timers.advance(5000);assert.deepEqual(h.jumps,[]);});
test('cancel and destroy clear pending work and reduced motion advances immediately',()=>{for(const which of ['cancel','destroy']){const h=harness();h.complete();h.c[which]();h.timers.advance(1000);assert.deepEqual(h.jumps,[]);}const h=harness({reduced:true});h.complete();assert.deepEqual(h.jumps,[next]);});
test('final completed set advances to review without inventing a set',()=>{const h=harness();for(const ex of h.before.exercises)for(const s of ex.sets)if(s.id!=='sw')s.done=true;for(const ex of h.after.exercises)for(const s of ex.sets)s.done=true;h.complete();h.timers.advance(650);assert.deepEqual(h.jumps,[null]);});

// Superset rounds: either partner first; only the round's completion moves vertically.
for(const [first,second] of [[a1,b1],[b1,a1]])test(`round ${first.setId}→${second.setId}: in-place switch at once, forward travel at 650ms`,()=>{
 const h=harness({ref:first});h.complete();assert.deepEqual(h.jumps,[second]);
 // Exactly one member logged; earlier straight and warm-up sets stay open.
 assert.deepEqual(h.state.log.exercises.flatMap(e=>e.sets).filter(s=>s.done).map(s=>s.id),[first.setId]);
 h.timers.advance(5000);assert.deepEqual(h.jumps,[second]);
 h.finish(second);h.timers.advance(649);assert.deepEqual(h.jumps,[second]);h.timers.advance(1);assert.deepEqual(h.jumps,[second,a2]);
});
test('three rounds in order make exactly three vertical advances',()=>{
 const log=mark(threeRounds(),['sw','s1','s2','aw','bw']),h=harness({log,ref:a1});let vertical=0;h.complete();
 for(const [one,two] of [[null,b1],[a2,b2],[a3,b3]]){
  if(one){h.finish(one);}const immediate=h.jumps.length;assert.deepEqual(h.jumps.at(-1),two);h.finish(two);h.timers.advance(649);assert.equal(h.jumps.length,immediate);h.timers.advance(1);if(h.jumps.length>immediate)vertical++;
 }
 assert.equal(vertical,3);assert.deepEqual(h.jumps,[b1,a2,b2,a3,b3,e1]);
});
test('a later round advances forward past earlier holes; with none after it, to review',()=>{
 const h=harness({log:threeRounds(),ref:a2});h.complete();assert.deepEqual(h.jumps,[b2]);h.finish(b2);h.timers.advance(650);assert.deepEqual(h.jumps,[b2,a3]);
 assert.deepEqual(h.state.log.exercises.flatMap(e=>e.sets).filter(s=>s.done).map(s=>s.id),['a2','b2']);
 const end=harness({ref:a2});end.complete();end.timers.advance(649);assert.deepEqual(end.jumps,[]);end.timers.advance(1);assert.deepEqual(end.jumps,[null]);
});
test('an absent or zero-working partner: the existing member completes the round',()=>{
 const log=focusFixture();log.exercises[2].sets=log.exercises[2].sets.filter(s=>s.kind==='warmup');
 const h=harness({log,ref:a1});h.complete();h.timers.advance(649);assert.deepEqual(h.jumps,[]);h.timers.advance(1);assert.deepEqual(h.jumps,[a2]);
 assert.deepEqual(h.state.log.exercises[2].sets.map(s=>s.id),['bw']);
});
test('first partner completion never switches when off, browsing, suspended or a straight set is not first-current',()=>{
 for(const which of ['off','browsing','suspended']){const h=harness({ref:a1});if(which==='off')h.state.autoNext=false;if(which==='suspended')h.state.suspended=true;if(which==='browsing')h.state.viewed=b1;h.c.completed({before:h.before,after:h.after,ref:a1,viewed:which==='browsing'?b1:a1,autoNext:which!=='off'});h.timers.advance(1000);assert.deepEqual(h.jumps,[],which);}
 // Straight sets keep the first-current gate: s2 completed while s1 is open stays put.
 const h=harness({ref:{exerciseId:'straight',setId:'s2'}});h.complete();h.timers.advance(1000);assert.deepEqual(h.jumps,[]);
});
test('a pending round advance is revalidated at 649ms against fresh state',()=>{
 for(const which of ['cancel','destroy','suspend','off','owner','status','viewed','undo-first','undo-second','membership','target-removed','target-done']){
  const h=harness({ref:a1});h.complete();h.finish(b1);h.timers.advance(649);const s=h.state;
  if(which==='cancel')h.c.cancel();if(which==='destroy')h.c.destroy();if(which==='suspend')s.suspended=true;if(which==='off')s.autoNext=false;
  if(which==='owner')s.log.id='other';if(which==='status')s.log.status='finished';if(which==='viewed')s.viewed=a1;
  if(which==='undo-first')mark(s.log,['a1'],false);if(which==='undo-second')mark(s.log,['b1'],false);
  if(which==='membership')s.log.exercises[2].sets=s.log.exercises[2].sets.filter(x=>x.id!=='b1');
  if(which==='target-removed')s.log.exercises[1].sets=s.log.exercises[1].sets.filter(x=>x.id!=='a2');
  if(which==='target-done')mark(s.log,['a2']);
  h.timers.advance(1000);assert.deepEqual(h.jumps,[b1],which);
 }
});
test('reduced motion switches and advances a round instantly',()=>{const h=harness({reduced:true,ref:b1});h.complete();assert.deepEqual(h.jumps,[a1]);h.finish(a1);assert.deepEqual(h.jumps,[a1,a2]);});
