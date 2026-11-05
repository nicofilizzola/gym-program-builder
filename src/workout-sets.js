import {WORKOUT_LIMITS} from './workout-log.js';

const WEIGHT_ERROR='Weight must be a multiple of 0.25 from 0 to 999.75 kg.';
const REPS_ERROR='Reps must be a whole number from 1 to 100.';
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const num=value=>value===null||value===undefined?null:value;

const isWarmup=set=>set?.kind==='warmup';
export const workingLastSets=sets=>Array.isArray(sets)?sets.filter(set=>!isWarmup(set)):[];
export const warmupLastSets=sets=>Array.isArray(sets)?sets.filter(isWarmup):[];

export function formatLastTime(sets){
 const working=workingLastSets(sets);
 if(!working.length)return 'No history';
 return working.map(set=>{
  const weight=set.weightKg===null||set.weightKg===0?'BW':String(set.weightKg);
  const reps=set.reps===null?'?':set.reps;
  return `${weight}×${reps}${set.rir===null?'':` @${set.rir}`}`;
 }).join(' · ');
}

/** index = position in exercise.sets; the rule applies to that set's kind and counts only sets of the same kind. */
export function setPlaceholder(exercise,index,lastTimeSets){
 const warm=isWarmup(exercise.sets[index]);
 const same=exercise.sets.map((set,i)=>({set,i})).filter(item=>isWarmup(item.set)===warm);
 const k=same.findIndex(item=>item.i===index);
 const last=(warm?warmupLastSets(lastTimeSets):workingLastSets(lastTimeSets))[k];
 if(last)return {weightKg:num(last.weightKg),reps:num(last.reps),rir:num(last.rir)};
 if(k>0){
  const previous=same[k-1];
  const inherited=setPlaceholder(exercise,previous.i,lastTimeSets);
  return {
   weightKg:num(previous.set.weightKg)??inherited.weightKg,
   reps:num(previous.set.reps)??inherited.reps,
   rir:num(previous.set.rir)??inherited.rir
  };
 }
 return {weightKg:null,reps:warm?null:exercise.target?.repRange.min??null,rir:null};
}

export function parseWeight(text){
 const trimmed=String(text).trim();
 if(trimmed==='')return {value:null};
 if(!/^\d+(?:[.,]\d+)?$/.test(trimmed))return {error:WEIGHT_ERROR};
 const value=Number(trimmed.replace(',','.'));
 if(value>WORKOUT_LIMITS.weightMax||!Number.isInteger(value*4))return {error:WEIGHT_ERROR};
 return {value};
}

export function parseReps(text){
 const trimmed=String(text).trim();
 if(trimmed==='')return {value:null};
 if(!/^\d+$/.test(trimmed))return {error:REPS_ERROR};
 const value=Number(trimmed);
 if(value<WORKOUT_LIMITS.repsMin||value>WORKOUT_LIMITS.repsMax)return {error:REPS_ERROR};
 return {value};
}

export function stepWeight(value,placeholder,delta){
 const next=(value??placeholder??0)+delta;
 const snapped=Math.round(next/WORKOUT_LIMITS.weightStep)*WORKOUT_LIMITS.weightStep;
 return clamp(snapped,0,WORKOUT_LIMITS.weightMax);
}

export function stepReps(value,placeholder,delta){
 return clamp(Math.round((value??placeholder??0)+delta),WORKOUT_LIMITS.repsMin,WORKOUT_LIMITS.repsMax);
}

export function formatElapsed(ms){
 const minutes=Math.max(0,Math.floor(ms/60000));
 if(minutes<60)return `${minutes} min`;
 return `${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,'0')} min`;
}
