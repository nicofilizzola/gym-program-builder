import { MUSCLE_GROUPS } from './muscles.js';
import { LIMITS, validateExercise, validateGoalFor, timingError, supersetError } from './validate.js';
import { normalizeWorkoutTiming } from './duration.js';
import {EQUIPMENT} from './catalog.js';
import {normalizeProgramContext,hasProgramContext} from './program-context.js';

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
  value=normalizeWorkoutTiming(value);
  const title=name(value.name,draft);
  for(const key of ['extraMinutes','bufferPercent']) {
    const error=timingError(value[key],key);if(error)fail(error);
  }
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
      const clean={name:ex.name,sets:ex.sets,restSeconds:ex.restSeconds,warmupSets:ex.warmupSets,repRange:{min:ex.repRange.min,max:ex.repRange.max},primaryMuscles:MUSCLE_GROUPS.filter(m=>ex.primaryMuscles.includes(m)),secondaryMuscles:MUSCLE_GROUPS.filter(m=>ex.secondaryMuscles.includes(m))};
      if(Object.hasOwn(ex,'superset')){
        if(!object(ex.superset))fail('Invalid superset.');
        clean.superset={restBetweenSeconds:ex.superset.restBetweenSeconds,restAfterRoundSeconds:ex.superset.restAfterRoundSeconds};
      }
      for(const key of ['referenceDescription','variantDescription','brand'])if(Object.hasOwn(ex,key)){
        if(typeof ex[key]!=='string'||ex[key].length>(key==='brand'?80:2000))fail('Invalid exercise '+key+'.');
        clean[key]=ex[key].replace(/\r\n?/g,'\n');
      }
      if(Object.hasOwn(ex,'equipment')){if(!EQUIPMENT.includes(ex.equipment))fail('Invalid equipment.');clean.equipment=ex.equipment;}
      if(Object.hasOwn(ex,'focusTags')){
        if(!Array.isArray(ex.focusTags)||ex.focusTags.some(v=>typeof v!=='string'||!v.trim()||v.length>80)||new Set(ex.focusTags.map(v=>v.trim().toLocaleLowerCase())).size!==ex.focusTags.length)fail('Invalid Focus tags.');
        clean.focusTags=ex.focusTags.map(v=>v.trim());
      }
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
  const pairError=supersetError(exercises);if(pairError)fail(pairError);
  return {name:title,exercises,goals:goals(value.goals,LIMITS.goal),extraMinutes:value.extraMinutes,bufferPercent:value.bufferPercent};
}
function validate(kind,value,{draft=false,embedded=false}={}) {
  try {
    if(kind==='template') return {document:workout(value,draft)};
    if(kind!=='program'||!object(value)||!Array.isArray(value.workouts)) fail('Invalid document kind or format.');
    const title=name(value.name,draft);
    if(!['simple','schedule'].includes(value.mode)) fail('Invalid program mode.');
    const ids=new Set();
    const workouts=value.workouts.map((w,i)=>{
      try {
        if(!object(w)||typeof w.id!=='string'||!w.id||w.id.length>100||ids.has(w.id)) fail('Missing or duplicate workout ID.');
        ids.add(w.id);
        if(w.day!==null&&(!Number.isInteger(w.day)||w.day<0||w.day>6)) fail('Invalid weekday.');
        if(embedded)return {...workout(w,draft),id:w.id,day:w.day};
        if(typeof w.templateId!=='string'||!w.templateId||w.templateId.length>100)fail('Missing or invalid session template ID.');
        if(Object.keys(w).some(key=>!['id','templateId','day'].includes(key)))fail('Embedded session content is not allowed in a program.');
        return {id:w.id,templateId:w.templateId,day:w.day};
      } catch(error) {fail(`Workout ${i+1}: ${error.message}`);}
    });
    const document={name:title,mode:value.mode,workouts,goals:goals(value.goals,LIMITS.weeklyGoal)};
    if(Object.hasOwn(value,'context')){
      const context=normalizeProgramContext(value.context);
      if(hasProgramContext({context}))document.context=context;
    }
    if(Object.hasOwn(value,'sequence')) {
      if(!Array.isArray(value.sequence))fail('Invalid program sequence.');
      const used=new Set(ids),references=[];
      document.sequence=value.sequence.map(entry=>{
        if(!object(entry))fail('Invalid sequence entry.');
        if(entry.type==='workout') {
          if(typeof entry.workoutId!=='string'||!ids.has(entry.workoutId))fail('Unknown sequence workout.');
          references.push(entry.workoutId);
          return {type:'workout',workoutId:entry.workoutId};
        }
        if(entry.type!=='rest'||typeof entry.id!=='string'||!entry.id||used.has(entry.id))fail('Missing or duplicate rest ID.');
        used.add(entry.id);return {type:'rest',id:entry.id};
      });
      if(references.length!==workouts.length||references.some((ref,i)=>ref!==workouts[i].id))fail('Sequence must reference every workout once in order.');
    }
    return {document};
  } catch(error) {return {error:error.message};}
}
export const validateDocument=(kind,value,{draft=false}={})=>validate(kind,value,{draft});
/** Only portable legacy files use this boundary; repository writes never do. */
export const validateLegacyDocument=(kind,value,{draft=false}={})=>validate(kind,value,{draft,embedded:true});
