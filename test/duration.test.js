import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as duration from '../src/duration.js';
import {createExercise} from '../src/exercise.js';
import {createTemplate,copyWorkout} from '../src/program.js';
import {supersetBlocks} from '../src/superset.js';

const workout=(exercises,extraMinutes=5,bufferPercent=10)=>({name:'Upper',exercises,goals:{},extraMinutes,bufferPercent});
test('duration counts final rests and buffers the full unrounded subtotal',()=>{
  const w=workout([{sets:3,restSeconds:180},{sets:3,restSeconds:90}]);
  const before=structuredClone(w);
  assert.deepEqual(duration.computeDuration(w),{warmupSeconds:0,executionSeconds:360,restSeconds:810,extraSeconds:300,bufferSeconds:147,totalSeconds:1617,displayMinutes:27});
  assert.equal(duration.durationLabel(w),'~27 min');
  assert.deepEqual(w,before);
  assert.equal(duration.computeDuration(workout([{sets:3,restSeconds:120}],0,0)).totalSeconds,540);
  assert.equal(duration.computeDuration(workout([{sets:3,restSeconds:0}],0,0)).totalSeconds,180);
});
const w=(exercises,extraMinutes=0,bufferPercent=0)=>({name:'W',goals:{},exercises,extraMinutes,bufferPercent});
test('straight exercise warm-ups: 60s each, no rest between, exercise rest before first set',()=>{
  assert.deepEqual(duration.computeDuration(w([{sets:3,restSeconds:120,warmupSets:2}])),{warmupSeconds:120,executionSeconds:180,restSeconds:480,extraSeconds:0,bufferSeconds:0,totalSeconds:780,displayMinutes:13});
});
test('uneven superset: warm-ups, rounds and a leftover straight set',()=>{
  const r=duration.computeDuration(w([{sets:4,restSeconds:180,warmupSets:1,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:3,restSeconds:60,warmupSets:0}]));
  assert.equal(r.totalSeconds,1020);assert.equal(r.warmupSeconds,60);assert.equal(r.executionSeconds,420);assert.equal(r.restSeconds,540);
});
test('equal superset with no transition',()=>{
  assert.equal(duration.computeDuration(w([{sets:3,restSeconds:60,superset:{restBetweenSeconds:0,restAfterRoundSeconds:120}},{sets:3,restSeconds:60}])).totalSeconds,720);
});
test('buffer covers warm-ups; invalid sets in a pair count as zero',()=>{
  assert.equal(duration.computeDuration(w([{sets:3,restSeconds:120,warmupSets:2}],0,10)).totalSeconds,858);
  assert.equal(duration.computeDuration(w([{sets:0,restSeconds:60,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:2,restSeconds:60}])).totalSeconds,300);
});
// Spec A2: a pair runs both members' warm-ups back to back (60 s each) plus one round rest when there are any,
// then rounds of 60 + between + 60 + round rest; a leftover set is 60 + round rest.
test('superset warm-ups only on the second member',()=>{
  // W = 0 + 2 -> warm-ups 2*60 = 120, one round rest 90. Rounds 3*(60+30+60+90): execution 360, rest 3*(30+90) = 360.
  // Rest 90 + 360 = 450; total 120 + 360 + 450 = 930.
  assert.deepEqual(duration.computeDuration(w([{sets:3,restSeconds:60,warmupSets:0,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:3,restSeconds:120,warmupSets:2}])),
    {warmupSeconds:120,executionSeconds:360,restSeconds:450,extraSeconds:0,bufferSeconds:0,totalSeconds:930,displayMinutes:16});
});
test('superset warm-ups on both members add the round rest once',()=>{
  // W = 1 + 2 = 3 -> warm-ups 180, one round rest 120 (not one per member). Rounds 2*(60+15+60+120): execution 240, rest 2*(15+120) = 270.
  // Rest 120 + 270 = 390; total 180 + 240 + 390 = 810.
  assert.deepEqual(duration.computeDuration(w([{sets:2,restSeconds:60,warmupSets:1,superset:{restBetweenSeconds:15,restAfterRoundSeconds:120}},{sets:2,restSeconds:60,warmupSets:2}])),
    {warmupSeconds:180,executionSeconds:240,restSeconds:390,extraSeconds:0,bufferSeconds:0,totalSeconds:810,displayMinutes:14});
});
test('invalid sets with warm-ups contribute nothing',()=>{
  // Straight: invalid sets -> the exercise (warm-ups included) counts as 0.
  for(const sets of [0,11,1.5]) assert.equal(duration.computeDuration(w([{sets,restSeconds:120,warmupSets:3}])).totalSeconds,0);
  // Pair: A invalid with 2 warm-ups -> W = 0 (no warm-ups, no warm-up round rest); B's 2 sets are leftovers: 2*(60+90) = 300.
  assert.deepEqual(duration.computeDuration(w([{sets:0,restSeconds:60,warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:2,restSeconds:60,warmupSets:0}])),
    {warmupSeconds:0,executionSeconds:120,restSeconds:180,extraSeconds:0,bufferSeconds:0,totalSeconds:300,displayMinutes:5});
});
test('computeDuration pairs exercises exactly like supersetBlocks',()=>{
  const s={restBetweenSeconds:30,restAfterRoundSeconds:90};
  const ex=(sets,rest,warmupSets,superset)=>({sets,restSeconds:rest,warmupSets,...(superset?{superset}:{})});
  const cases=[
    [ex(3,60,1,s),ex(2,120,0)],                         // one pair
    [ex(3,60,0),ex(3,60,1,s),ex(2,90,2)],               // straight then pair
    [ex(3,60,1,s),ex(2,90,0),ex(4,120,2,s)],            // pair then a stray trailing superset -> straight
    [ex(3,60,0,s),ex(2,90,1,s),ex(4,120,0)],            // second member's superset is consumed by the pair
    [ex(2,60,0,s)],                                      // single stray superset -> straight
  ];
  // A stray trailing superset counts as straight: 1*60 warm-up + its own rest 120 + 4*(60+120) = 900.
  assert.equal(duration.computeDuration(w([ex(4,120,1,s)])).totalSeconds,900);
  for(const exercises of cases){
    const blocks=supersetBlocks(exercises);
    // Each block alone: a length-2 block is a pair, a length-1 block is straight (even with a stray superset).
    const parts=blocks.map(b=>duration.computeDuration(w(exercises.slice(b.start,b.start+b.length))).totalSeconds).reduce((a,b)=>a+b,0);
    assert.equal(duration.computeDuration(w(exercises)).totalSeconds,parts,JSON.stringify(blocks));
  }
});
test('empty and invalid-set exercises do not invent execution or rest time',()=>{
  assert.deepEqual(duration.computeDuration(workout([])),{warmupSeconds:0,executionSeconds:0,restSeconds:0,extraSeconds:0,bufferSeconds:0,totalSeconds:0,displayMinutes:0});
  for(const sets of [0,11,1.5,NaN]) assert.equal(duration.computeDuration(workout([{sets,restSeconds:120}],0,0)).totalSeconds,0);
  assert.equal(duration.computeDuration(workout([{name:'',sets:3}],0,0)).totalSeconds,540);
});
test('rounds only final total and handles maximum inputs',()=>{
  assert.equal(duration.computeDuration(workout([{sets:1,restSeconds:0}],0,5)).totalSeconds,63);
  assert.equal(duration.durationLabel(workout([{sets:1,restSeconds:0}],0,5)),'~2 min');
  assert.equal(duration.computeDuration(workout([{sets:10,restSeconds:300}],60,50)).totalSeconds,10800);
  assert.equal(duration.durationLabel(workout([{sets:10,restSeconds:300}],60,50)),'~180 min');
  assert.equal(duration.computeDuration(workout([{sets:1,restSeconds:15}],0,5)).totalSeconds,78.75);
});
test('reference defaults and legacy normalization preserve explicit inputs',()=>{
  assert.equal(duration.defaultRestSeconds('compound'),180);
  assert.equal(duration.defaultRestSeconds('isolation'),90);
  assert.equal(duration.defaultRestSeconds(),120);
  assert.throws(()=>duration.defaultRestSeconds('unknown'));
  const legacy={name:'Old',exercises:[{sets:3}],goals:{}};
  const w=duration.normalizeWorkoutTiming(legacy);
  assert.equal(w.extraMinutes,5);assert.equal(w.bufferPercent,10);assert.equal(w.exercises[0].restSeconds,120);
  assert.notEqual(w.exercises[0],legacy.exercises[0]);
  assert.equal(Object.hasOwn(legacy,'extraMinutes'),false);
  const explicit=duration.normalizeWorkoutTiming({...legacy,extraMinutes:0,bufferPercent:null,exercises:[{sets:3,restSeconds:0}]});
  assert.equal(explicit.extraMinutes,0);assert.equal(explicit.bufferPercent,null);assert.equal(explicit.exercises[0].restSeconds,0);
});
test('constructors and deep workout copies preserve independent timing and metadata',()=>{
  const t=createTemplate();t.exercises.push({...createExercise(),restSeconds:90,catalogId:'curl'});
  t.extraMinutes=12;t.bufferPercent=25;
  const w=copyWorkout(t,'w');
  assert.equal(w.extraMinutes,12);assert.equal(w.bufferPercent,25);assert.equal(w.exercises[0].restSeconds,90);
  assert.equal(w.exercises[0].catalogId,'curl');
  w.exercises[0].restSeconds=15;w.extraMinutes=0;w.bufferPercent=0;
  assert.equal(t.exercises[0].restSeconds,90);assert.equal(t.extraMinutes,12);assert.equal(t.bufferPercent,25);
  assert.equal(createExercise().restSeconds,120);
  assert.equal(createTemplate().extraMinutes,5);assert.equal(createTemplate().bufferPercent,10);
});
test('names, reps, muscles and order never change duration',()=>{
  const w=workout([{sets:3,restSeconds:180},{sets:2,restSeconds:90}]);
  const other=workout(w.exercises.toReversed().map(e=>({...e,name:'changed',repRange:{min:1,max:1},primaryMuscles:['Chest']})));
  assert.deepEqual(duration.computeDuration(w),duration.computeDuration(other));
});
test('breakdown time formats seconds without rounding calculation inputs',()=>{
  for(const [seconds,text] of [[0,'0 sec'],[30,'30 sec'],[60,'1 min'],[90,'1 min 30 sec'],[78.75,'1 min 19 sec']]) assert.equal(duration.formatDuration(seconds),text);
});
