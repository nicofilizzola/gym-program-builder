import {MUSCLE_GROUPS} from './muscles.js';
import {EQUIPMENT,CATALOG_NAME_MAX} from './catalog.js';
import {supersetIssue} from './validate.js';

export const WORKOUT_LIMITS=Object.freeze({weightMax:999.75,weightStep:0.25,repsMin:1,repsMax:100,rirMax:5,nameMax:120,exerciseNameMax:CATALOG_NAME_MAX,exercises:40,sets:20,bytes:262144,lastTimeIds:40,historyPage:30});

const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/;
const pad=(n,w=2)=>String(n).padStart(w,'0');

/** ISO 8601 with the local UTC offset, e.g. 2026-11-03T18:05:00.000+01:00. */
export function toLocalIso(date){
 const off=-date.getTimezoneOffset(),abs=Math.abs(off);
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(),3)}${off<0?'-':'+'}${pad(Math.floor(abs/60))}:${pad(abs%60)}`;
}

export const LOG_VERSION=2;
const SET_KINDS=['warmup','working'];
const emptySet=(makeId,kind='working')=>({id:makeId(),kind,weightKg:null,reps:null,rir:null,done:false});

/** Trim, default to 'Workout' when empty, cap at the name limit. */
export const normalizeLogName=text=>(String(text).trim()||'Workout').slice(0,WORKOUT_LIMITS.nameMax);

export function createWorkoutLog({id,now,makeId,template,program,occurrenceId}){
 const name=normalizeLogName(template?template.document.name:'');
 const source=!template?{kind:'blank'}
  :program?{kind:'program',programId:program.id,occurrenceId,templateId:template.id,programName:program.name,templateName:name}
  :{kind:'template',templateId:template.id,templateName:name};
 const exercises=(template?template.document.exercises:[]).map(ex=>({
  id:makeId(),variantId:ex.catalogId??null,referenceId:ex.familyId??null,name:ex.name,equipment:ex.equipment??null,
  primaryMuscles:[...ex.primaryMuscles],secondaryMuscles:[...ex.secondaryMuscles],
  target:{sets:ex.sets,warmupSets:ex.warmupSets??0,repRange:{min:ex.repRange.min,max:ex.repRange.max},restSeconds:ex.restSeconds},
  ...(ex.superset?{superset:{restBetweenSeconds:ex.superset.restBetweenSeconds,restAfterRoundSeconds:ex.superset.restAfterRoundSeconds}}:{}),
  sets:[...Array.from({length:ex.warmupSets??0},()=>emptySet(makeId,'warmup')),...Array.from({length:ex.sets},()=>emptySet(makeId,'working'))]
 }));
 return {id,logVersion:LOG_VERSION,status:'active',name,startedAt:toLocalIso(now),finishedAt:null,source,exercises};
}

export function logExerciseFromEntry(entry,makeId){
 return {id:makeId(),variantId:entry.id,referenceId:entry.familyId,name:entry.name,equipment:entry.equipment??null,
  primaryMuscles:[...entry.primaryMuscles],secondaryMuscles:[...entry.secondaryMuscles],target:null,sets:[emptySet(makeId)]};
}

export function workoutSummary(log){
 return {id:log.id,name:log.name,source:log.source,startedAt:log.startedAt,finishedAt:log.finishedAt,
  doneSets:log.exercises.reduce((n,ex)=>n+ex.sets.filter(s=>s.done&&s.kind==='working').length,0)};
}

const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const isText=v=>typeof v==='string'&&v!=='';
const isInt=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const isDate=v=>typeof v==='string'&&ISO.test(v)&&!Number.isNaN(Date.parse(v));
const fail=error=>({error});

function validateSource(s){
 if(!isObject(s))return null;
 if(s.kind==='blank')return {kind:'blank'};
 if(s.kind==='template'&&isText(s.templateId)&&typeof s.templateName==='string')return {kind:'template',templateId:s.templateId,templateName:s.templateName};
 if(s.kind==='program'&&[s.programId,s.occurrenceId,s.templateId].every(isText)&&typeof s.programName==='string'&&typeof s.templateName==='string')
  return {kind:'program',programId:s.programId,occurrenceId:s.occurrenceId,templateId:s.templateId,programName:s.programName,templateName:s.templateName};
 return null;
}

function validateTarget(t){
 if(!isObject(t)||!isObject(t.repRange))return null;
 const {sets,warmupSets,repRange:{min,max},restSeconds}=t;
 if(!isInt(sets,1,10)||!isInt(warmupSets,0,5)||!isInt(min,1,30)||!isInt(max,1,30)||min>max||!isInt(restSeconds,0,300))return null;
 return {sets,warmupSets,repRange:{min,max},restSeconds};
}

function validateMuscles(list,where){
 if(!Array.isArray(list))return fail(`${where}: Muscles must be a list.`);
 for(const m of list)if(!MUSCLE_GROUPS.includes(m))return fail(`${where}: unknown muscle group ${JSON.stringify(m)}.`);
 if(new Set(list).size!==list.length)return fail(`${where}: duplicate muscle group.`);
 return {list:[...list]};
}

function validateSet(s,where){
 if(!isObject(s)||!isText(s.id))return fail(`${where}: Invalid set.`);
 const {kind,weightKg,reps,rir,done}=s;
 if(!SET_KINDS.includes(kind))return fail(`${where}: Invalid set kind.`);
 if(weightKg!==null&&!(typeof weightKg==='number'&&weightKg>=0&&weightKg<=WORKOUT_LIMITS.weightMax&&Number.isInteger(weightKg*4)))
  return fail(`${where}: Weight must be a multiple of 0.25 from 0 to 999.75 kg.`);
 if(reps!==null&&!isInt(reps,WORKOUT_LIMITS.repsMin,WORKOUT_LIMITS.repsMax))return fail(`${where}: Reps must be a whole number from 1 to 100.`);
 if(rir!==null&&!isInt(rir,0,WORKOUT_LIMITS.rirMax))return fail(`${where}: RIR must be a whole number from 0 to 5.`);
 if(typeof done!=='boolean')return fail(`${where}: Done must be true or false.`);
 if(done&&reps===null)return fail(`${where}: A completed set needs reps.`);
 return {set:{id:s.id,kind,weightKg,reps,rir,done}};
}

function validateExercise(ex,i,finished){
 const where=`Exercise ${i+1}`;
 if(!isObject(ex)||!isText(ex.id))return fail(`${where}: Invalid exercise.`);
 if(![ex.variantId,ex.referenceId].every(v=>v===null||isText(v))||(ex.variantId===null)!==(ex.referenceId===null))return fail(`${where}: Invalid catalog link.`);
 if(typeof ex.name!=='string'||ex.name===''||ex.name.length>WORKOUT_LIMITS.exerciseNameMax)return fail(`${where}: Name must be 1–${WORKOUT_LIMITS.exerciseNameMax} characters.`);
 if(ex.equipment!==null&&!EQUIPMENT.includes(ex.equipment))return fail(`${where}: Invalid equipment.`);
 const primary=validateMuscles(ex.primaryMuscles,where);if(primary.error)return primary;
 const secondary=validateMuscles(ex.secondaryMuscles,where);if(secondary.error)return secondary;
 const target=ex.target===null?null:validateTarget(ex.target);
 if(ex.target!==null&&!target)return fail(`${where}: Invalid target.`);
 if(!Array.isArray(ex.sets))return fail(`${where}: Sets must be a list.`);
 if(ex.sets.length>WORKOUT_LIMITS.sets)return fail(`${where}: At most 20 sets.`);
 if(finished&&!ex.sets.some(s=>isObject(s)&&s.kind==='working'))return fail(`${where}: A finished workout needs at least one working set per exercise.`);
 const sets=[];
 for(let j=0;j<ex.sets.length;j++){
  const r=validateSet(ex.sets[j],`${where}, set ${j+1}`);if(r.error)return r;
  if(finished&&!r.set.done)return fail(`${where}, set ${j+1}: A finished workout needs every set completed.`);
  if(r.set.kind==='warmup'&&sets.some(p=>p.kind==='working'))return fail(`${where}: Warm-up sets must come before working sets.`);
  sets.push(r.set);
 }
 const out={id:ex.id,variantId:ex.variantId,referenceId:ex.referenceId,name:ex.name,equipment:ex.equipment,primaryMuscles:primary.list,secondaryMuscles:secondary.list,target,...(ex.superset!==undefined?{superset:ex.superset}:{}),sets};
 return {exercise:out};
}

/** Version 1 logs lack kind/warmupSets; fill them in so one validator handles both. */
function upgradeV1(value){
 const exercises=Array.isArray(value.exercises)?value.exercises.map((ex,i)=>{
  if(!isObject(ex))return ex;
  if(ex.superset!==undefined)return {__bad:`Exercise ${i+1}: Invalid superset.`};
  const sets=Array.isArray(ex.sets)?ex.sets.map((s,j)=>isObject(s)?(s.kind!==undefined?{__bad:`Exercise ${i+1}, set ${j+1}: Invalid set kind.`}:{...s,kind:'working'}):s):ex.sets;
  const target=isObject(ex.target)?{...ex.target,warmupSets:0}:ex.target;
  return {...ex,sets,target};
 }):value.exercises;
 return {...value,exercises};
}

/** Strict validation shared by client and server; returns a canonical copy. */
export function validateWorkoutLog(value){
 if(!isObject(value))return fail('Invalid workout log.');
 if(!isText(value.id))return fail('Invalid id.');
 if(value.logVersion!==1&&value.logVersion!==2)return fail('Unsupported log version.');
 if(value.logVersion===1){
  const up=upgradeV1(value);
  const badEx=Array.isArray(up.exercises)&&up.exercises.find(e=>isObject(e)&&e.__bad);
  if(badEx)return fail(badEx.__bad);
  const badSet=Array.isArray(up.exercises)&&up.exercises.flatMap(e=>isObject(e)&&Array.isArray(e.sets)?e.sets:[]).find(s=>isObject(s)&&s.__bad);
  if(badSet)return fail(badSet.__bad);
  value=up;
 }
 if(value.status!=='active'&&value.status!=='finished')return fail('Invalid status.');
 const finished=value.status==='finished';
 if(typeof value.name!=='string'||value.name===''||value.name.length>WORKOUT_LIMITS.nameMax)return fail('Name must be 1–120 characters.');
 if(!isDate(value.startedAt))return fail('Start time must be an ISO 8601 date with a UTC offset.');
 if(finished){
  if(value.finishedAt===null)return fail('A finished workout needs a finish time.');
  if(!isDate(value.finishedAt))return fail('Finish time must be an ISO 8601 date with a UTC offset.');
  if(Date.parse(value.finishedAt)<=Date.parse(value.startedAt))return fail('Finish time must be after start time.');
 }else if(value.finishedAt!==null)return fail('An active workout has no finish time.');
 const source=validateSource(value.source);
 if(!source)return fail('Invalid source.');
 if(!Array.isArray(value.exercises))return fail('Exercises must be a list.');
 if(value.exercises.length>WORKOUT_LIMITS.exercises)return fail('At most 40 exercises.');
 if(finished&&!value.exercises.length)return fail('A finished workout needs at least one exercise.');
 const exercises=[];
 for(let i=0;i<value.exercises.length;i++){
  const r=validateExercise(value.exercises[i],i,finished);if(r.error)return r;
  exercises.push(r.exercise);
 }
 const issue=supersetIssue(exercises);
 if(issue)return fail(issue.message);
 for(const e of exercises)if(e.superset)e.superset={restBetweenSeconds:e.superset.restBetweenSeconds,restAfterRoundSeconds:e.superset.restAfterRoundSeconds};
 return {log:{id:value.id,logVersion:LOG_VERSION,status:value.status,name:value.name,startedAt:value.startedAt,finishedAt:value.finishedAt,source,exercises}};
}
