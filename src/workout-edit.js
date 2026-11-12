import {logExerciseFromEntry,normalizeLogName,toLocalIso,validateWorkoutLog,WORKOUT_LIMITS} from './workout-log.js';
import {pairRole as supersetRole,moveBlockOrder,unpair,removeExercise as removePairMember} from './superset.js';

export const NO_SETS='Log at least one working set, or discard the workout.';

const mapExercise=(log,exerciseId,fn)=>{
 if(!log.exercises.some(e=>e.id===exerciseId))return log;
 return {...log,exercises:log.exercises.map(e=>e.id===exerciseId?fn(e):e)};
};
const mapSet=(log,exerciseId,setId,fn)=>{
 const ex=log.exercises.find(e=>e.id===exerciseId);
 if(!ex||!ex.sets.some(s=>s.id===setId))return log;
 return mapExercise(log,exerciseId,e=>({...e,sets:e.sets.map(s=>s.id===setId?fn(s):s)}));
};

export const setLogName=(log,text)=>({...log,name:normalizeLogName(text)});

export const addExercise=(log,entry,makeId)=>({...log,exercises:[...log.exercises,logExerciseFromEntry(entry,makeId)]});

export const swapExercise=(log,exerciseId,entry)=>mapExercise(log,exerciseId,e=>({...e,
 variantId:entry.id,referenceId:entry.familyId,name:entry.name,equipment:entry.equipment??null,
 primaryMuscles:[...entry.primaryMuscles],secondaryMuscles:[...entry.secondaryMuscles],target:null}));

export const setWorkoutNote=(log,text)=>({...log,note:text});

export const setExerciseNote=(log,exerciseId,text)=>mapExercise(log,exerciseId,e=>({...e,note:text}));
export const setSetNote=(log,exerciseId,setId,text)=>mapSet(log,exerciseId,setId,s=>({...s,note:text}));

export const removeExercise=(log,exerciseId)=>{
 const i=log.exercises.findIndex(e=>e.id===exerciseId);
 return i<0?log:{...log,exercises:removePairMember(log.exercises,i)};
};

export function unlinkSuperset(log,exerciseId){
 const i=log.exercises.findIndex(e=>e.id===exerciseId);
 return i<0?log:{...log,exercises:unpair(log.exercises,i)};
}

/** Moves a whole block (single exercise or superset pair) to another block position. */
export function moveLogBlock(log,fromBlock,toBlock){
 const order=moveBlockOrder(log.exercises,fromBlock,toBlock);
 return order.every((v,i)=>v===i)?log:{...log,exercises:order.map(i=>log.exercises[i])};
}

export function moveLogExercise(log,from,to){
 const n=log.exercises.length;
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=n||to>=n||from===to)return log;
 const exercises=[...log.exercises];
 exercises.splice(to,0,exercises.splice(from,1)[0]);
 return {...log,exercises};
}

const blankSet=(id,kind,values)=>({id,kind,weightKg:null,reps:null,rir:null,done:false,note:'',...values});

const atLimit=(log,exerciseId)=>(log.exercises.find(e=>e.id===exerciseId)?.sets.length??0)>=WORKOUT_LIMITS.sets;

export const addSet=(log,exerciseId,makeId,values={})=>atLimit(log,exerciseId)?log:mapExercise(log,exerciseId,e=>
 ({...e,sets:[...e.sets,blankSet(makeId(),'working',values)]}));

/** Inserts a warm-up after the last warm-up (first position when there is none). */
export const addWarmup=(log,exerciseId,makeId,values={})=>atLimit(log,exerciseId)?log:mapExercise(log,exerciseId,e=>{
 let at=0;e.sets.forEach((s,i)=>{if(s.kind==='warmup')at=i+1;});
 const sets=[...e.sets];sets.splice(at,0,blankSet(makeId(),'warmup',{kind:'warmup',...values}));
 return {...e,sets};
});

export const removeSet=(log,exerciseId,setId)=>{
 const ex=log.exercises.find(e=>e.id===exerciseId);
 if(!ex||!ex.sets.some(s=>s.id===setId))return log;
 return mapExercise(log,exerciseId,e=>({...e,sets:e.sets.filter(s=>s.id!==setId)}));
};

export const updateSet=(log,exerciseId,setId,patch)=>mapSet(log,exerciseId,setId,s=>({...s,...patch}));

/** Marking done fills empty fields from the placeholder; reps are required. Undoing keeps values. */
export function toggleSetDone(log,exerciseId,setId,placeholder){
 const ex=log.exercises.find(e=>e.id===exerciseId),current=ex&&ex.sets.find(s=>s.id===setId);
 if(!current)return {log};
 if(current.done)return {log:updateSet(log,exerciseId,setId,{done:false})};
 const ph=placeholder||{};
 const filled={weightKg:current.weightKg??ph.weightKg??null,reps:current.reps??ph.reps??null,rir:current.rir??(current.kind==='warmup'?null:ph.rir)??null};
 if(filled.reps===null)return {error:'Enter reps'};
 return {log:updateSet(log,exerciseId,setId,{...filled,done:true})};
}

export const undoneSetCount=log=>log.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.kind==='working'&&!s.done).length,0);

const hasDoneWorking=e=>e.sets.some(s=>s.kind==='working'&&s.done);

export function finishWorkout(log,now){
 let exercises=log.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.done)}));
 // Dissolve pairs that lose a member before removing exercises, so the survivor stays valid.
 for(let i=exercises.length-1;i>=0;i--){
  if(hasDoneWorking(exercises[i]))continue;
  exercises=removePairMember(exercises,i);
 }
 exercises=exercises.filter(hasDoneWorking);
 if(!exercises.length)return {error:NO_SETS};
 const result=validateWorkoutLog({...log,status:'finished',finishedAt:toLocalIso(now),exercises});
 return result.error?{error:result.error}:{log:result.log};
}

/** Where focus goes after a working set of a paired exercise became done; null keeps focus. */
export function nextGuidedSet(log,exerciseId,setId){
 const i=log.exercises.findIndex(e=>e.id===exerciseId);
 if(i<0)return null;
 const ex=log.exercises[i],set=ex.sets.find(s=>s.id===setId);
 if(!set||set.kind!=='working')return null;
 const role=supersetRole(log.exercises,i);
 if(!role)return null;
 const partner=log.exercises[role==='first'?i+1:i-1];
 const open=e=>e&&e.sets.find(s=>s.kind==='working'&&!s.done);
 const p=open(partner);if(p)return {exerciseId:partner.id,setId:p.id};
 const own=open(ex);return own?{exerciseId:ex.id,setId:own.id}:null;
}

/** The standard warning before finishing a log with undone sets, or null when every set is done. */
export function finishConfirmation(log){
 const open=undoneSetCount(log);
 return open?{title:'Finish workout?',message:`${open===1?'1 set':`${open} sets`} not completed — finish anyway? Uncompleted sets will be removed.`,confirmLabel:'Finish workout'}:null;
}

/**
 * The one finish flow: refuses a log without done sets, confirms undone sets, then finishes the latest log.
 * `read` returns the current log, or null once the caller no longer owns it. Resolves {log}, {error} or {cancelled:true}.
 */
export async function confirmFinish(read,{confirm,now}){
 const before=read();
 if(!before)return {cancelled:true};
 if(!before.exercises.some(hasDoneWorking))return {error:NO_SETS};
 const ask=finishConfirmation(before);
 if(ask&&!await confirm(ask))return {cancelled:true};
 const current=read();
 return current?finishWorkout(current,now()):{cancelled:true};
}

const DATE=/^(\d{4})-(\d\d)-(\d\d)$/,TIME=/^(\d\d):(\d\d)$/;

/** Sets the start and end of a finished workout; an end before the start means the next day. */
export function setWorkoutTimes(log,{date,startTime,endTime}){
 const d=DATE.exec(date||''),s=TIME.exec(startTime||''),e=TIME.exec(endTime||'');
 if(!d||!s||!e)return {error:'Enter a valid date and times.'};
 const [y,mo,da]=[+d[1],+d[2],+d[3]];
 const build=(t,extraDays=0)=>new Date(y,mo-1,da+extraDays,+t[1],+t[2]);
 const start=build(s);
 const roundTrips=start.getFullYear()===y&&start.getMonth()===mo-1&&start.getDate()===da&&start.getHours()===+s[1]&&start.getMinutes()===+s[2];
 if(!roundTrips||+e[1]>23||+e[2]>59)return {error:'Enter a valid date and times.'};
 if(endTime===startTime)return {error:'End time must be after the start time.'};
 const end=build(e,endTime<startTime?1:0);
 return {log:{...log,startedAt:toLocalIso(start),finishedAt:toLocalIso(end)}};
}
