import {logExerciseFromEntry,normalizeLogName,toLocalIso,validateWorkoutLog} from './workout-log.js';

export const NO_SETS='Log at least one set, or discard the workout.';

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

export const removeExercise=(log,exerciseId)=>log.exercises.some(e=>e.id===exerciseId)
 ?{...log,exercises:log.exercises.filter(e=>e.id!==exerciseId)}:log;

export function moveLogExercise(log,from,to){
 const n=log.exercises.length;
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=n||to>=n||from===to)return log;
 const exercises=[...log.exercises];
 exercises.splice(to,0,exercises.splice(from,1)[0]);
 return {...log,exercises};
}

export const addSet=(log,exerciseId,makeId,values={})=>mapExercise(log,exerciseId,e=>({...e,
 sets:[...e.sets,{id:makeId(),weightKg:null,reps:null,rir:null,done:false,...values}]}));

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
 const filled={weightKg:current.weightKg??ph.weightKg??null,reps:current.reps??ph.reps??null,rir:current.rir??ph.rir??null};
 if(filled.reps===null)return {error:'Enter reps'};
 return {log:updateSet(log,exerciseId,setId,{...filled,done:true})};
}

export const undoneSetCount=log=>log.exercises.reduce((n,e)=>n+e.sets.filter(s=>!s.done).length,0);

export function finishWorkout(log,now){
 const exercises=log.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.done)})).filter(e=>e.sets.length);
 if(!exercises.length)return {error:NO_SETS};
 const result=validateWorkoutLog({...log,status:'finished',finishedAt:toLocalIso(now),exercises});
 return result.error?{error:result.error}:{log:result.log};
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
 if(!before.exercises.some(e=>e.sets.some(s=>s.done)))return {error:NO_SETS};
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
