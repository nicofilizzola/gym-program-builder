import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeProgramVolumeSplit,computeProgramVolume,contributingWorkouts,weeklyHeatLevel} from '../src/program-volume.js';
import {barScale,goalStatus,visibleMuscles,heatLevel} from '../src/volume.js';
const workout=()=>({name:'Upper',day:null,goals:{},exercises:[
 {name:'Bench',sets:4,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Triceps','Front delts']},
 {name:'Dips',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest','Triceps'],secondaryMuscles:['Front delts']},
 {name:'Pull',sets:3,repRange:{min:8,max:12},primaryMuscles:['Lats'],secondaryMuscles:['Biceps','Upper back']}]});
test('weekly sums count scheduled and unscheduled independent workouts once',()=>{
 const p={workouts:[{...workout(),id:'1',day:0},{...workout(),id:'2'}],goals:{Chest:14},mode:'simple'};
 const v=computeProgramVolume(p);
 assert.deepEqual(v,{Chest:14,Lats:6,'Upper back':3,Biceps:3,Triceps:10,'Front delts':7,'Side delts':0,'Rear delts':0,Abs:0,Quads:0,Hamstrings:0,Calves:0});
 assert.deepEqual(computeProgramVolumeSplit(p).Triceps,{direct:6,indirect:4});
 assert.equal(contributingWorkouts(p,'Chest'),2);
 assert.equal(weeklyHeatLevel(v.Chest),3);
 assert.deepEqual(computeProgramVolume({...p,goals:{Chest:30}}),v);
 assert.deepEqual(computeProgramVolume({...p,mode:'schedule',workouts:[...p.workouts].reverse()}),v);
 assert.equal(computeProgramVolume({...p,workouts:p.workouts.slice(1)}).Chest,7);
 assert.equal(goalStatus(v.Chest,14).status,'met');assert.equal(goalStatus(v.Chest,15).status,'under');assert.equal(goalStatus(v.Chest,13).status,'over');
 const empty=computeProgramVolume({workouts:[]});assert.equal(empty.Chest,0);
 assert.deepEqual(visibleMuscles(empty,{Calves:30}),['Calves']);assert.equal(30/barScale(empty,{Calves:30}),0.75);
});

test('weekly heat uses weekly boundaries without changing session heat',()=>{
 for(const [volume,expected] of [[0,0],[0.5,1],[6,1],[6.5,2],[12,2],[12.5,3],[18,3],[18.5,4],[30,4],[100,4]]) {
  assert.equal(weeklyHeatLevel(volume),expected);
 }
 assert.equal(heatLevel(3.5),2);
 assert.equal(heatLevel(9.5),4);
 const secondary={workouts:[{exercises:[{sets:1,primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}]}]};
 assert.equal(computeProgramVolume(secondary).Triceps,0.5);
 assert.equal(weeklyHeatLevel(computeProgramVolume(secondary).Triceps),1);
 assert.equal(weeklyHeatLevel(computeProgramVolume({workouts:[]}).Chest),0);
});

