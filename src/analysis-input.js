import {MUSCLE_GROUPS} from './muscles.js';
import {EQUIPMENT} from './catalog.js';
import {validateExercise,validateGoal,timingError} from './validate.js';
import {normalizeWorkoutTiming} from './duration.js';

export const analysisError=(message,code='INVALID',status=400,details={})=>Object.assign(new Error(message),{code,status,...details});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function prepareAnalysisSnapshot(workout) {
 const fail=(message,details)=>{throw analysisError(message,'INVALID',400,details);};
 if(!object(workout)||!Array.isArray(workout.exercises))fail('Invalid session template.');
 if(!workout.exercises.length)fail('Add an exercise before analyzing.');
 if(workout.exercises.length>40)fail('Analyze at most 40 exercises at a time.');
 if(typeof workout.name!=='string'||[...workout.name].length>200)fail('Session name must be at most 200 characters.');
 const value=normalizeWorkoutTiming(workout);
 for(const key of ['extraMinutes','bufferPercent'])if(timingError(value[key],key))fail(timingError(value[key],key));
 if(!object(value.goals))fail('Invalid session goals.');
 const goals={};for(const m of Object.keys(value.goals))if(!MUSCLE_GROUPS.includes(m)||validateGoal(value.goals[m]))fail('Invalid session goal.');
 for(const m of MUSCLE_GROUPS)if(Object.hasOwn(value.goals,m))goals[m]=value.goals[m];
 const exercises=value.exercises.map((ex,i)=>{
  const bad=(message,field)=>fail(`Exercise ${i+1}: ${message}`,{exerciseIndex:i,field});
  if(!object(ex)||typeof ex.name!=='string'||[...ex.name].length>200)bad('Name must be at most 200 characters.','name');
  if(!object(ex.repRange))bad('Choose a valid rep range.','repRange');
  for(const key of ['primaryMuscles','secondaryMuscles'])if(!Array.isArray(ex[key])||new Set(ex[key]).size!==ex[key].length)bad('Choose valid, distinct muscles.','muscles');
  const errors=validateExercise(ex);for(const [field,error]of Object.entries(errors))bad(error,field);
  if(Object.hasOwn(ex,'equipment')&&!EQUIPMENT.includes(ex.equipment))bad('Choose valid equipment.','equipment');
  return {position:i+1,name:ex.name,...(Object.hasOwn(ex,'equipment')?{equipment:ex.equipment}:{}),sets:ex.sets,repRange:{min:ex.repRange.min,max:ex.repRange.max},restSeconds:ex.restSeconds,primaryMuscles:MUSCLE_GROUPS.filter(m=>ex.primaryMuscles.includes(m)),secondaryMuscles:MUSCLE_GROUPS.filter(m=>ex.secondaryMuscles.includes(m))};
 });
 return {name:value.name.trim()||'Untitled session',exercises,goals,extraMinutes:value.extraMinutes,bufferPercent:value.bufferPercent};
}
export const analysisFingerprint=snapshot=>JSON.stringify(snapshot);
