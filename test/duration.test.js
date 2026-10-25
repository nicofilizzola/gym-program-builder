import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as duration from '../src/duration.js';
import {createExercise} from '../src/exercise.js';
import {createTemplate,copyWorkout} from '../src/program.js';

const workout=(exercises,extraMinutes=5,bufferPercent=10)=>({name:'Upper',exercises,goals:{},extraMinutes,bufferPercent});
test('duration counts final rests and buffers the full unrounded subtotal',()=>{
  const w=workout([{sets:3,restSeconds:180},{sets:3,restSeconds:90}]);
  const before=structuredClone(w);
  assert.deepEqual(duration.computeDuration(w),{executionSeconds:360,restSeconds:810,extraSeconds:300,bufferSeconds:147,totalSeconds:1617,displayMinutes:27});
  assert.equal(duration.durationLabel(w),'~27 min');
  assert.deepEqual(w,before);
  assert.equal(duration.computeDuration(workout([{sets:3,restSeconds:120}],0,0)).totalSeconds,540);
  assert.equal(duration.computeDuration(workout([{sets:3,restSeconds:0}],0,0)).totalSeconds,180);
});
test('empty and invalid-set exercises do not invent execution or rest time',()=>{
  assert.deepEqual(duration.computeDuration(workout([])),{executionSeconds:0,restSeconds:0,extraSeconds:0,bufferSeconds:0,totalSeconds:0,displayMinutes:0});
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
