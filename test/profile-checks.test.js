import test from 'node:test';
import assert from 'node:assert/strict';
import {profileChecks} from '../src/profile-checks.js';
import {normalizeProfile} from '../src/profile.js';

const sess=(day,sets=3,equipment)=>({day,name:'S',extraMinutes:0,bufferPercent:0,goals:{},exercises:[{name:'Bench',sets,restSeconds:120,warmupSets:0,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],...(equipment?{equipment}:{})}]});
const profile=normalizeProfile({maxTrainingDaysPerWeek:2,availableWeekdays:[0,2,4],maxSessionsPerDay:1,maxSessionMinutes:20,equipment:['Dumbbell']});
test('week checks',()=>{
  const r=profileChecks({mode:'schedule',workouts:[sess(0),sess(0),sess(1),sess(3,10,'Barbell'),sess(null)]},profile);
  assert.equal(r.unscheduledCount,1);
  assert.deepEqual(r.trainingDays,{count:3,max:2});
  assert.deepEqual(r.unavailableDays,[{day:1,occurrences:[3]},{day:3,occurrences:[4]}]);
  assert.deepEqual(r.crowdedDays,[{day:0,count:2,max:1}]);
  assert.deepEqual(r.longSessions,[{occurrence:4,name:'S',displayMinutes:30,max:20}]);
  assert.deepEqual(r.equipmentMismatches,[{occurrence:4,exercisePosition:1,name:'Bench',equipment:'Barbell'}]);
});
test('sequence mode skips day checks; empty profile yields no findings',()=>{
  const r=profileChecks({mode:'simple',workouts:[sess(0),sess(0),sess(1)]},profile);
  assert.deepEqual([r.trainingDays,r.unavailableDays,r.crowdedDays,r.unscheduledCount],[null,[],[],0]);
  const none=profileChecks({mode:'schedule',workouts:[sess(0,10,'Barbell')]},normalizeProfile());
  assert.deepEqual(none,{unscheduledCount:0,trainingDays:null,unavailableDays:[],crowdedDays:[],longSessions:[],equipmentMismatches:[]});
});
test('lists are ordered by day, and by occurrence then exercise position',()=>{
  const two=(day)=>{const s=sess(day,3,'Barbell');s.exercises.push({...s.exercises[0],name:'  ',equipment:'Cable'});return s;};
  const p=normalizeProfile({availableWeekdays:[0],maxSessionsPerDay:1,equipment:['Dumbbell']});
  const r=profileChecks({mode:'schedule',workouts:[two(5),two(2),two(5),two(2)]},p);
  assert.deepEqual(r.unavailableDays,[{day:2,occurrences:[2,4]},{day:5,occurrences:[1,3]}]);
  assert.deepEqual(r.crowdedDays,[{day:2,count:2,max:1},{day:5,count:2,max:1}]);
  assert.deepEqual(r.equipmentMismatches.slice(0,3).map(m=>[m.occurrence,m.exercisePosition,m.name]),[[1,1,'Bench'],[1,2,'Untitled exercise'],[2,1,'Bench']]);
});
test('unscheduled sessions count for long sessions and equipment but not days; names fall back',()=>{
  const s=sess(null,10,'Barbell');s.name='  ';
  for(const mode of ['schedule','simple']){
    const r=profileChecks({mode,workouts:[s]},profile);
    assert.deepEqual(r.longSessions,[{occurrence:1,name:'Untitled workout',displayMinutes:30,max:20}]);
    assert.equal(r.equipmentMismatches.length,1);
    assert.deepEqual([r.trainingDays,r.unavailableDays,r.crowdedDays],[null,[],[]]);
  }
  assert.equal(profileChecks({mode:'schedule',workouts:[s]},profile).unscheduledCount,1);
});
test('does not mutate inputs',()=>{
  const input={mode:'schedule',workouts:[sess(3,10,'Barbell')]};
  const copy=structuredClone(input),pcopy=structuredClone(profile);
  profileChecks(input,profile);
  assert.deepEqual(input,copy);assert.deepEqual(profile,pcopy);
});
