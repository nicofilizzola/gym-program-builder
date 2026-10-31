import {prepareAnalysisSnapshot,analysisError} from './analysis-input.js';
import {normalizeProgramContext} from './program-context.js';
import {getSequence} from './program-sequence.js';
import {MUSCLE_GROUPS} from './muscles.js';
import {LIMITS,validateGoalFor} from './validate.js';

export const PROGRAM_ANALYSIS_MAX_BYTES=262144;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(message,details={})=>{throw analysisError(message,'INVALID',400,details);};
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=100;
function header(value){
 if(!object(value)||typeof value.name!=='string'||[...value.name].length>200)fail('Program name must be at most 200 characters.');
 if(!['schedule','simple'].includes(value.mode))fail('Invalid program layout.');
 if(!object(value.goals))fail('Invalid program goals.');
 for(const [muscle,goal]of Object.entries(value.goals))if(!MUSCLE_GROUPS.includes(muscle)||typeof goal!=='number'||validateGoalFor(goal,LIMITS.weeklyGoal))fail('Invalid program goal.');
 let context;try{context=normalizeProgramContext(value.context);}catch(error){fail(error.message);}
 return {focus:'hypertrophy',name:value.name.trim()||'Untitled program',context,mode:value.mode,goals:Object.fromEntries(MUSCLE_GROUPS.filter(m=>Object.hasOwn(value.goals,m)).map(m=>[m,value.goals[m]]))};
}
function cleanWorkout(value,occurrenceIndex){
 try{
  const clean=prepareAnalysisSnapshot(value);
  clean.exercises=clean.exercises.map((ex,i)=>{
   const raw=value.exercises[i];
   for(const key of ['referenceDescription','variantDescription','brand'])if(Object.hasOwn(raw,key)){
    if(typeof raw[key]!=='string'||raw[key].length>(key==='brand'?80:2000))fail('Invalid exercise '+key+'.',{exerciseIndex:i,field:'name'});
    ex[key]=raw[key].replace(/\r\n?/g,'\n');
   }
   if(Object.hasOwn(raw,'focusTags')){
    if(!Array.isArray(raw.focusTags)||raw.focusTags.some(t=>typeof t!=='string'||!t.trim()||t.length>80)||new Set(raw.focusTags.map(t=>t.trim().toLocaleLowerCase())).size!==raw.focusTags.length)fail('Invalid exercise Focus tags.',{exerciseIndex:i,field:'name'});
    ex.focusTags=raw.focusTags.map(t=>t.trim());
   }
   return ex;
  });
  return clean;
 }catch(error){throw analysisError(`Session ${occurrenceIndex+1}: ${error.message}`,'INVALID',400,{occurrenceIndex,...(Number.isInteger(error.exerciseIndex)?{exerciseIndex:error.exerciseIndex,field:error.field}:{})});}
}
function bounds(snapshot){
 const templates=new Map(snapshot.templates.map(t=>[t.key,t.workout]));
 if(snapshot.workouts.reduce((sum,w)=>sum+templates.get(w.templateKey).exercises.length,0)>400)fail('Analyze at most 400 exercise instances across the program.');
 if(new TextEncoder().encode(JSON.stringify({snapshot})).length>PROGRAM_ANALYSIS_MAX_BYTES)throw analysisError('Program analysis request must be at most 256 KiB.','TOO_LARGE',413);
 return snapshot;
}
function occurrences(value){
 if(!Array.isArray(value)||!value.length)fail('Add a session with exercises before analyzing.');
 if(value.length>50)fail('Analyze at most 50 session occurrences.');
}

/** Convert the current resolved projection, never the persisted arrangement alone. */
export function prepareProgramAnalysisSnapshot(program){
 const result=header(program);occurrences(program.workouts);
 const identities=new Map(),contents=new Map(),workoutKeys=new Map();
 result.templates=[];
 result.workouts=program.workouts.map((w,i)=>{
  if(!object(w)||!identity(w.id)||workoutKeys.has(w.id)||!identity(w.templateId))fail(`Session ${i+1}: Missing or duplicate session/template identity.`,{occurrenceIndex:i});
  const key='workout-'+(i+1);workoutKeys.set(w.id,key);
  const workout=cleanWorkout(w,i),text=JSON.stringify(workout);
  if(contents.has(w.templateId)&&contents.get(w.templateId)!==text)fail(`Session ${i+1}: Shared template content is inconsistent.`,{occurrenceIndex:i});
  if(!identities.has(w.templateId)){
   const templateKey='template-'+(identities.size+1);identities.set(w.templateId,templateKey);contents.set(w.templateId,text);result.templates.push({key:templateKey,workout});
  }
  if(w.day!==null&&(!Number.isInteger(w.day)||w.day<0||w.day>6))fail(`Session ${i+1}: Invalid weekday.`,{occurrenceIndex:i});
  return {key,templateKey:identities.get(w.templateId),day:w.day};
 });
 if(Object.hasOwn(program,'sequence')&&!Array.isArray(program.sequence))fail('Invalid program sequence.');
 const used=new Set(workoutKeys.keys());let rest=0;
 result.sequence=getSequence(program).map(entry=>{
  if(entry?.type==='workout'&&workoutKeys.has(entry.workoutId))return {type:'workout',workoutKey:workoutKeys.get(entry.workoutId)};
  if(entry?.type!=='rest'||!identity(entry.id)||used.has(entry.id))fail('Invalid program sequence.');
  used.add(entry.id);return {type:'rest',key:'rest-'+(++rest)};
 });
 return validateProgramAnalysisSnapshot(result);
}

/** Independent wire boundary: no database or catalog identities are needed here. */
export function validateProgramAnalysisSnapshot(value){
 const result=header(value);if(value.focus!=='hypertrophy')fail('Program analysis supports hypertrophy only.');
 occurrences(value.workouts);
 if(!Array.isArray(value.templates)||!value.templates.length||value.templates.length>value.workouts.length)fail('Invalid analysis templates.');
 const templateKeys=new Set(value.templates.map((t,i)=>{
  if(!object(t)||t.key!=='template-'+(i+1))fail('Invalid analysis template key.');return t.key;
 }));
 result.workouts=value.workouts.map((w,i)=>{
  if(!object(w)||w.key!=='workout-'+(i+1)||!templateKeys.has(w.templateKey))fail(`Session ${i+1}: Invalid template reference.`,{occurrenceIndex:i});
  if(w.day!==null&&(!Number.isInteger(w.day)||w.day<0||w.day>6))fail('Invalid weekday.',{occurrenceIndex:i});
  return {key:w.key,templateKey:w.templateKey,day:w.day};
 });
 result.templates=value.templates.map(t=>{
  const index=result.workouts.findIndex(w=>w.templateKey===t.key);if(index<0)fail('Unused analysis template.');
  return {key:t.key,workout:cleanWorkout(t.workout,index)};
 });
 if(!Array.isArray(value.sequence))fail('Invalid program sequence.');
 let rest=0,workout=0;
 result.sequence=value.sequence.map(entry=>{
  if(entry?.type==='workout'&&entry.workoutKey===result.workouts[workout]?.key){workout++;return {type:'workout',workoutKey:entry.workoutKey};}
  if(entry?.type!=='rest'||entry.key!=='rest-'+(++rest))fail('Invalid program sequence.');
  return {type:'rest',key:entry.key};
 });
 if(workout!==result.workouts.length)fail('Sequence must reference every session once in order.');
 return bounds(result);
}
