import { MUSCLE_GROUPS } from './muscles.js';
import { LIMITS, validateExercise, validateGoalFor } from './validate.js';
import {EQUIPMENT} from './catalog.js';

const object = value => value !== null && typeof value==='object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
function goals(value, limits) {
  if(!object(value)) fail('Invalid goals.');
  for(const [muscle,goal] of Object.entries(value)) {
    if(!MUSCLE_GROUPS.includes(muscle)) fail(`Goal for unknown muscle group "${muscle}".`);
    if(typeof goal!=='number'||validateGoalFor(goal,limits)) fail(`Goal for ${muscle} must be a multiple of 0.5 from ${limits.min} to ${limits.max}.`);
  }
  return Object.fromEntries(MUSCLE_GROUPS.filter(m=>Object.hasOwn(value,m)).map(m=>[m,value[m]]));
}
function name(value,draft) {
  if(typeof value!=='string') fail('Invalid name.');
  if(!draft&&!value.trim()) fail('Name is required.');
  return value;
}
function workout(value,draft) {
  if(!object(value)||!Array.isArray(value.exercises)) fail('Invalid session template format.');
  const title=name(value.name,draft);
  const exercises=value.exercises.map((ex,i)=>{
    try {
      if(!object(ex)||typeof ex.name!=='string'||!object(ex.repRange)) fail('Invalid exercise format.');
      for(const key of ['primaryMuscles','secondaryMuscles']) {
        if(!Array.isArray(ex[key])) fail('Invalid muscle choices.');
        for(const m of ex[key]) if(!MUSCLE_GROUPS.includes(m)) fail(`unknown muscle group "${m}".`);
        if(new Set(ex[key]).size!==ex[key].length) fail('Duplicate muscle group.');
      }
      if(ex.primaryMuscles.some(m=>ex.secondaryMuscles.includes(m))) fail('A muscle cannot be both primary and secondary.');
      const errors=validateExercise(ex);
      if(draft) {delete errors.name;if(ex.primaryMuscles.length===0) delete errors.muscles;}
      if(Object.keys(errors).length) fail(Object.values(errors)[0]);
      const clean={name:ex.name,sets:ex.sets,repRange:{min:ex.repRange.min,max:ex.repRange.max},primaryMuscles:MUSCLE_GROUPS.filter(m=>ex.primaryMuscles.includes(m)),secondaryMuscles:MUSCLE_GROUPS.filter(m=>ex.secondaryMuscles.includes(m))};
      if(Object.hasOwn(ex,'catalogId')) {
        if(typeof ex.catalogId!=='string'||!ex.catalogId||ex.catalogId.length>100||typeof ex.familyId!=='string'||!ex.familyId||ex.familyId.length>100||!Number.isInteger(ex.catalogRevision)||ex.catalogRevision<1||!EQUIPMENT.includes(ex.equipment))fail('Invalid exercise catalog link.');
        Object.assign(clean,{catalogId:ex.catalogId,familyId:ex.familyId,catalogRevision:ex.catalogRevision,equipment:ex.equipment});
        if(Object.hasOwn(ex,'catalogCopyOf')){
          if(typeof ex.catalogCopyOf!=='string'||!ex.catalogCopyOf||ex.catalogCopyOf.length>100)fail('Invalid catalog copy source.');
          clean.catalogCopyOf=ex.catalogCopyOf;
        }
      }
      return clean;
    } catch(error) {fail(`Exercise ${i+1}: ${error.message}`);}
  });
  return {name:title,exercises,goals:goals(value.goals,LIMITS.goal)};
}
export function validateDocument(kind,value,{draft=false}={}) {
  try {
    if(kind==='template') return {document:workout(value,draft)};
    if(kind!=='program'||!object(value)||!Array.isArray(value.workouts)) fail('Invalid document kind or format.');
    const title=name(value.name,draft);
    if(!['simple','schedule'].includes(value.mode)) fail('Invalid program mode.');
    const ids=new Set();
    const workouts=value.workouts.map((w,i)=>{
      try {
        if(!object(w)||typeof w.id!=='string'||!w.id||ids.has(w.id)) fail('Missing or duplicate workout ID.');
        ids.add(w.id);
        if(w.day!==null&&(!Number.isInteger(w.day)||w.day<0||w.day>6)) fail('Invalid weekday.');
        return {...workout(w,draft),id:w.id,day:w.day};
      } catch(error) {fail(`Workout ${i+1}: ${error.message}`);}
    });
    return {document:{name:title,mode:value.mode,workouts,goals:goals(value.goals,LIMITS.weeklyGoal)}};
  } catch(error) {return {error:error.message};}
}
