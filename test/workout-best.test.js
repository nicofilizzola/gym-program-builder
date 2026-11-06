import test from 'node:test';
import assert from 'node:assert/strict';
import {bestPerRep,selectBestPerformance} from '../src/workout-best.js';
const c=(weightKg,reps,finishedAt='2026-11-02T11:00:00Z',logId='a')=>({weightKg,reps,finishedAt,logId});
const all=[c(100,8),c(95,12),c(110,5),c(100,10)];
test('range is inclusive',()=>{
 assert.deepEqual(selectBestPerformance(all,{min:8,max:12}),all[3]);
 assert.deepEqual(selectBestPerformance(all,{min:12,max:12}),all[1]);
 assert.equal(selectBestPerformance(all,{min:20,max:30}),null);
});
test('unranged allows 1 through 100 and weight outranks reps',()=>{
 assert.deepEqual(selectBestPerformance(all),all[2]);
 assert.deepEqual(selectBestPerformance([c(1,1),c(0,100)]),c(1,1));
 assert.equal(selectBestPerformance([]),null);
});
test('equal weights prefer reps then real finish instant then log id',()=>{
 const early=c(100,10,'2026-11-02T12:00:00+02:00'),late=c(100,10,'2026-11-02T11:00:00Z','b');
 assert.deepEqual(selectBestPerformance([early,late,c(100,8)]),late);
 assert.equal(selectBestPerformance([late,{...late,logId:'z'}]).logId,'z');
});
test('BW prefers more reps',()=>{
 assert.deepEqual(selectBestPerformance([c(0,8),c(0,12)]),c(0,12));
 assert.deepEqual(selectBestPerformance([c(0.25,8),c(0,12)]),c(0.25,8));
});
test('reduction preserves every possible range winner without mutation',()=>{
 const candidates=[...all,...Array.from({length:100},(_,i)=>c(i%9,i+1)),c(1,8)],before=structuredClone(candidates);
 const reduced=bestPerRep(candidates);
 assert.ok(reduced.length<=100);assert.deepEqual(reduced.map(x=>x.reps),Array.from({length:100},(_,i)=>i+1));
 for(let min=1;min<=100;min++)for(let max=min;max<=100;max++)assert.deepEqual(selectBestPerformance(candidates,{min,max}),selectBestPerformance(reduced,{min,max}));
 assert.deepEqual(candidates,before);
});
test('same candidates support different occurrence targets',()=>{
 assert.equal(selectBestPerformance(all,{min:4,max:6}).weightKg,110);
 assert.equal(selectBestPerformance(all,{min:8,max:12}).weightKg,100);
});
