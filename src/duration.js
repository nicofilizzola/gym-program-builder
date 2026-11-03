/** Timing inputs are stored; totals are always derived in seconds. */
export const DURATION_LIMITS = Object.freeze({
  restSeconds: Object.freeze({min:0,max:300,step:15}),
  restBetweenSeconds: Object.freeze({min:0,max:120,step:15}),
  restAfterRoundSeconds: Object.freeze({min:0,max:300,step:15}),
  extraMinutes: Object.freeze({min:0,max:60,step:1}),
  bufferPercent: Object.freeze({min:0,max:50,step:5}),
});

export function defaultRestSeconds(exerciseType) {
  if(exerciseType===undefined) return 120;
  if(exerciseType==='compound') return 180;
  if(exerciseType==='isolation') return 90;
  throw new Error('Unknown exercise type.');
}

export function normalizeWorkoutTiming(workout) {
  return {
    ...workout,
    extraMinutes:Object.hasOwn(workout,'extraMinutes')?workout.extraMinutes:5,
    bufferPercent:Object.hasOwn(workout,'bufferPercent')?workout.bufferPercent:10,
    exercises:workout.exercises.map(ex=>({...ex,restSeconds:Object.hasOwn(ex,'restSeconds')?ex.restSeconds:120,warmupSets:Object.hasOwn(ex,'warmupSets')?ex.warmupSets:0})),
  };
}

export function computeDuration(workout) {
  const value=normalizeWorkoutTiming(workout);
  let executionSeconds=0,restSeconds=0;
  for(const ex of value.exercises) {
    if(!Number.isInteger(ex.sets)||ex.sets<1||ex.sets>10) continue;
    executionSeconds+=ex.sets*60;
    restSeconds+=ex.sets*ex.restSeconds;
  }
  const extraSeconds=value.exercises.length?value.extraMinutes*60:0;
  const bufferSeconds=(executionSeconds+restSeconds+extraSeconds)*value.bufferPercent/100;
  const totalSeconds=executionSeconds+restSeconds+extraSeconds+bufferSeconds;
  return {executionSeconds,restSeconds,extraSeconds,bufferSeconds,totalSeconds,displayMinutes:Math.ceil(totalSeconds/60)};
}

export function formatDuration(seconds) {
  const rounded=Math.round(seconds),minutes=Math.floor(rounded/60),rest=rounded%60;
  return minutes?minutes+' min'+(rest?' '+rest+' sec':''):rest+' sec';
}

export const durationLabel=workout=>'~'+computeDuration(workout).displayMinutes+' min';
