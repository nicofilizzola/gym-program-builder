import {MUSCLE_GROUPS} from './muscles.js';
import {computeVolumeSplit} from './volume.js';

/** Weekly totals use their own heat bands; session heat remains independent. */
export const WEEKLY_HEAT_BANDS=Object.freeze([6,12,18]);
export function weeklyHeatLevel(volume) {
  return volume<=0?0:1+WEEKLY_HEAT_BANDS.filter(limit=>volume>limit).length;
}

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
