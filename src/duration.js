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
  const S=60,exs=value.exercises;
  let warmupSeconds=0,executionSeconds=0,restSeconds=0;
  const valid=ex=>Number.isInteger(ex.sets)&&ex.sets>=1&&ex.sets<=10;
  const counted=ex=>valid(ex)?{sets:ex.sets,warmups:Number.isInteger(ex.warmupSets)&&ex.warmupSets>0?ex.warmupSets:0}:{sets:0,warmups:0};
  // Blocks follow the same rule as supersetBlocks (kept inline: superset.js imports this module).
  for(let i=0;i<exs.length;i++) {
    const ex=exs[i];
    if(ex.superset&&i+1<exs.length) {
      const a=counted(ex),b=counted(exs[i+1]),{restBetweenSeconds:t,restAfterRoundSeconds:R}=ex.superset;
      const W=a.warmups+b.warmups;
      warmupSeconds+=W*S;
      if(W>0) restSeconds+=R;
      for(let k=1;k<=Math.max(a.sets,b.sets);k++) {
        if(k<=a.sets&&k<=b.sets) {executionSeconds+=2*S;restSeconds+=t+R;}
        else {executionSeconds+=S;restSeconds+=R;}
      }
      i++;
      continue;
    }
    const c=counted(ex);
    warmupSeconds+=c.warmups*S;
    if(c.warmups>0) restSeconds+=ex.restSeconds;
    executionSeconds+=c.sets*S;
    restSeconds+=c.sets*ex.restSeconds;
  }
  const extraSeconds=exs.length?value.extraMinutes*60:0;
  const subtotal=warmupSeconds+executionSeconds+restSeconds+extraSeconds;
  const bufferSeconds=subtotal*value.bufferPercent/100;
  const totalSeconds=subtotal+bufferSeconds;
  return {warmupSeconds,executionSeconds,restSeconds,extraSeconds,bufferSeconds,totalSeconds,displayMinutes:Math.ceil(totalSeconds/60)};
}

export function formatDuration(seconds) {
  const rounded=Math.round(seconds),minutes=Math.floor(rounded/60),rest=rounded%60;
  return minutes?minutes+' min'+(rest?' '+rest+' sec':''):rest+' sec';
}

export const durationLabel=workout=>'~'+computeDuration(workout).displayMinutes+' min';
