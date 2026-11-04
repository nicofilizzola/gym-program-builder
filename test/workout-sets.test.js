import test from 'node:test';
import assert from 'node:assert/strict';
import {formatLastTime,setPlaceholder,parseWeight,parseReps,stepWeight,stepReps,formatElapsed} from '../src/workout-sets.js';

test('formatLastTime shows weight × reps, bodyweight and RIR',()=>{
 assert.equal(formatLastTime([{weightKg:80,reps:8,rir:2},{weightKg:80,reps:7,rir:null},{weightKg:77.5,reps:8,rir:null}]),'80×8 @2 · 80×7 · 77.5×8');
 assert.equal(formatLastTime([{weightKg:null,reps:10,rir:null},{weightKg:0,reps:9,rir:1}]),'BW×10 · BW×9 @1');
 assert.equal(formatLastTime([]),'No history');
});
test('parseWeight accepts comma decimals and enforces steps',()=>{
 assert.deepEqual(parseWeight('82,5'),{value:82.5});assert.deepEqual(parseWeight(' 80 '),{value:80});
 assert.deepEqual(parseWeight(''),{value:null});
 for(const text of ['82.3','-5','1000','abc'])assert.ok(parseWeight(text).error);
 assert.equal(parseWeight('82.3').error,'Weight must be a multiple of 0.25 from 0 to 999.75 kg.');
 assert.deepEqual(parseReps('8'),{value:8});for(const text of ['0','101','8.5','x'])assert.ok(parseReps(text).error);
 assert.equal(parseReps('0').error,'Reps must be a whole number from 1 to 100.');
 assert.deepEqual(parseReps(''),{value:null});
});
test('setPlaceholder prefers last time, then the previous row, then the target',()=>{
 const last=[{weightKg:80,reps:8,rir:2},{weightKg:80,reps:7,rir:null}];
 const ex={target:{sets:4,repRange:{min:6,max:10},restSeconds:90},sets:[{},{},{},{}]};
 assert.deepEqual(setPlaceholder(ex,0,last),{weightKg:80,reps:8,rir:2});
 assert.deepEqual(setPlaceholder(ex,1,last),{weightKg:80,reps:7,rir:null});
 assert.deepEqual(setPlaceholder(ex,2,last),{weightKg:80,reps:7,rir:null});
 const typed={...ex,sets:[{weightKg:null,reps:null,rir:null},{weightKg:null,reps:null,rir:null},{weightKg:85,reps:null,rir:null},{}]};
 assert.deepEqual(setPlaceholder(typed,3,last),{weightKg:85,reps:7,rir:null});
 assert.deepEqual(setPlaceholder({target:{sets:3,repRange:{min:6,max:10},restSeconds:90},sets:[{}]},0,null),{weightKg:null,reps:6,rir:null});
 assert.deepEqual(setPlaceholder({target:null,sets:[{}]},0,null),{weightKg:null,reps:null,rir:null});
 assert.deepEqual(setPlaceholder({target:null,sets:[{weightKg:50,reps:5,rir:1},{}]},1,[]),{weightKg:50,reps:5,rir:1});
});
test('steppers clamp and start from the placeholder',()=>{
 assert.equal(stepWeight(null,80,2.5),82.5);assert.equal(stepWeight(1,null,-2.5),0);assert.equal(stepWeight(999,null,2.5),999.75);
 assert.equal(stepReps(null,8,1),9);assert.equal(stepReps(1,null,-1),1);assert.equal(stepReps(100,null,1),100);
});
test('formatElapsed',()=>{assert.equal(formatElapsed(0),'0 min');assert.equal(formatElapsed(32*60000),'32 min');assert.equal(formatElapsed(65*60000),'1 h 05 min');});
