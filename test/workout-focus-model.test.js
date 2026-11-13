import test from 'node:test';
import assert from 'node:assert/strict';
import {focusFixture} from './fixtures/workout-focus.js';
import {setKey,projectWorkout,focusFallback,focusGroups,repRangeHint,repsCaption,completionMilestone,progressClusters,nearestIndex} from '../src/workout-focus-model.js';

test('projects pair warmups then rounds without changing storage',()=>{
 const log=focusFixture(),before=structuredClone(log),p=projectWorkout(log);
 assert.deepEqual(p.items.map(i=>i.ref.setId),['sw','s1','s2','aw','bw','a1','b1','a2']);
 assert.deepEqual(log,before);assert.equal(p.workingKeys.length,5);assert.equal(p.doneKeys.size,0);
 assert.deepEqual(p.current,{exerciseId:'straight',setId:'sw'});
 assert.deepEqual(p.items.slice(5).map(i=>[i.member,i.round]),[['A1',1],['A2',1],['A1',2]]);
 assert.equal(p.items[7].preview.label.includes('No partner set'),true);
});
test('falls forward then backward after removal and survives reorder',()=>{
 const p=projectWorkout(focusFixture()).items,ref=p[5].ref;
 assert.deepEqual(focusFallback(p,p.filter(i=>i!==p[5]),ref),p[6].ref);
 assert.deepEqual(focusFallback(p,[p[0]],ref),p[0].ref);
 assert.deepEqual(focusFallback(p,[...p].reverse(),ref),ref);
 assert.equal(focusFallback(p,[],ref),null);
});
test('repeated variants and delimiter-containing IDs remain separate',()=>{
 const log=focusFixture();log.exercises[0].variantId=log.exercises[1].variantId='same';
 assert.equal(projectWorkout(log).items.length,8);
 assert.notEqual(setKey({exerciseId:'a:b',setId:'c'}),setKey({exerciseId:'a',setId:'b:c'}));
 log.exercises.forEach(e=>e.sets.forEach(s=>s.done=true));assert.equal(projectWorkout(log).current,null);
});
test('range is inclusive and advisory, never invented for warmups or absent targets',()=>{
 const range={min:8,max:10},hint=reps=>repRangeHint({kind:'working',reps,range});
 assert.equal(hint(6).text,'2 below target · Aim for 8–10 reps');
 assert.equal(hint(12).text,'2 above target · Aim for 8–10 reps');
 for(const n of [8,10])assert.equal(hint(n).state,'within');
 assert.equal(hint(1).delta,7);assert.equal(hint(100).delta,90);assert.equal(hint(null).state,'target');
 assert.equal(repRangeHint({kind:'working',reps:8,range,invalid:true}),null);
 assert.equal(repRangeHint({kind:'warmup',reps:8,range}),null);
 assert.equal(repRangeHint({kind:'working',reps:8,range:null}),null);
});
test('repsCaption folds the target into the Reps label',()=>{
 const range={min:8,max:12},c=(reps,extra={})=>repsCaption({kind:'working',reps,range,...extra});
 assert.deepEqual(c(null),{text:'Reps · 8–12',outside:false});
 assert.deepEqual(c(10),{text:'Reps · 8–12',outside:false});
 assert.deepEqual(c(6),{text:'Reps · 2 below 8–12',outside:true});
 assert.deepEqual(c(13),{text:'Reps · 1 above 8–12',outside:true});
 assert.deepEqual(c(8,{invalid:true}),{text:'Reps',outside:false});
 assert.deepEqual(repsCaption({kind:'warmup',reps:8,range}),{text:'Reps',outside:false});
 assert.deepEqual(repsCaption({kind:'working',reps:8,range:null}),{text:'Reps',outside:false});
 assert.equal(repsCaption({kind:'working',reps:8,range:{min:8,max:8}}).text,'Reps · 8');
});
test('milestones require real completed work and a completed partner',()=>{
 const before=focusFixture(),after=structuredClone(before);after.exercises[2].sets[1].done=true;
 assert.equal(completionMilestone(before,after,{exerciseId:'b',setId:'b1'}).kind,'set');
 after.exercises[1].sets[1].done=true;
 assert.equal(completionMilestone(before,after,{exerciseId:'b',setId:'b1'}).kind,'round');
 after.exercises[1].sets[2].done=true;
 assert.equal(completionMilestone(before,after,{exerciseId:'a',setId:'a2'}).kind,'pair');
 after.exercises[0].sets.slice(1).forEach(s=>s.done=true);
 assert.equal(completionMilestone(before,after,{exerciseId:'straight',setId:'s2'}).kind,'exercise');
});

test('focusGroups follows runs of one exercise and keeps keys through changes',()=>{
 const k=(e,s)=>setKey({exerciseId:e,setId:s}),groups=focusGroups(projectWorkout(focusFixture()).items);
 assert.deepEqual(groups.map(g=>[g.exerciseId,g.keys]),[['straight',[k('straight','sw'),k('straight','s1'),k('straight','s2')]],['a',[k('a','aw')]],['b',[k('b','bw')]],['a',[k('a','a1')]],['b',[k('b','b1')]],['a',[k('a','a2')]]]);
 assert.deepEqual(groups.map(g=>g.key),groups.map(g=>g.keys[0]));
 assert.equal(groups[3].exerciseIndex,1);
 const noWarmup=focusFixture();noWarmup.exercises[0].sets.shift();
 assert.equal(focusGroups(projectWorkout(noWarmup).items,groups)[0].key,groups[0].key);
 const unlinked=focusFixture();delete unlinked.exercises[1].superset;
 const after=focusGroups(projectWorkout(unlinked).items,groups);
 assert.deepEqual(after.map(g=>g.key),[groups[0].key,groups[1].key,groups[2].key]);
 assert.equal(new Set(after.map(g=>g.key)).size,after.length);
});

test('progressClusters groups working sets by exercise and superset',()=>{
 const k=(e,s)=>setKey({exerciseId:e,setId:s});
 assert.deepEqual(progressClusters(projectWorkout(focusFixture()).items),[{key:'straight',keys:[k('straight','s1'),k('straight','s2')]},{key:'a',keys:[k('a','a1'),k('b','b1'),k('a','a2')]}]);
 const log=focusFixture();log.exercises.forEach(e=>{e.sets=e.sets.filter(s=>s.kind==='warmup');});
 assert.deepEqual(progressClusters(projectWorkout(log).items),[]);
});

test('nearestIndex clamps to the ends',()=>{
 assert.equal(nearestIndex([10,30,50],-100),0);assert.equal(nearestIndex([10,30,50],41),2);assert.equal(nearestIndex([10,30,50],20),0);
 assert.equal(nearestIndex([10],500),0);assert.equal(nearestIndex([],5),-1);
});
