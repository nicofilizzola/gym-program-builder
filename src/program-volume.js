import {MUSCLE_GROUPS} from './muscles.js';
import {computeVolumeSplit} from './volume.js';

export function computeProgramVolumeSplit(program) {
  const result=Object.fromEntries(MUSCLE_GROUPS.map(m=>[m,{direct:0,indirect:0}]));
  for(const workout of program.workouts) {
    const split=computeVolumeSplit(workout);
    for(const m of MUSCLE_GROUPS) {result[m].direct+=split[m].direct;result[m].indirect+=split[m].indirect;}
  }
  return result;
}
export function computeProgramVolume(program) {
  return Object.fromEntries(Object.entries(computeProgramVolumeSplit(program)).map(([m,s])=>[m,s.direct+s.indirect]));
}
export function contributingWorkouts(program,muscle) {
  return program.workouts.filter(w=>w.exercises.some(e=>e.primaryMuscles.includes(muscle)||e.secondaryMuscles.includes(muscle))).length;
}
