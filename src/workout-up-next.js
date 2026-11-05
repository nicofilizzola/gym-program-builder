import {getSequence} from './program-sequence.js';

const SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const LONG=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const weekday=date=>(date.getDay()+6)%7;
const isWeek=program=>program.mode!=='simple';
const sequenceIds=program=>getSequence(program).filter(e=>e.type==='workout').map(e=>e.workoutId);
const programLogs=(logs,programId)=>logs.filter(l=>l.source?.kind==='program'&&(programId===null||l.source.programId===programId));

/** Local Monday 00:00 of the week containing `now`. */
export function weekStart(now){
 return new Date(now.getFullYear(),now.getMonth(),now.getDate()-weekday(now));
}

/** Week: Monday→Sunday in program order, then Unscheduled; Sequence: workout entries in order. */
export function sessionOrder(program){
 if(!isWeek(program))return sequenceIds(program);
 const scheduled=program.workouts.filter(w=>w.day!==null).sort((a,b)=>a.day-b.day);
 return [...scheduled,...program.workouts.filter(w=>w.day===null)].map(w=>w.id);
}

export function occurrenceLabels(program){
 if(!isWeek(program))return new Map(sequenceIds(program).map((id,i)=>[id,{short:`Day ${i+1}`,long:`Day ${i+1}`}]));
 return new Map(program.workouts.map(w=>[w.id,w.day===null?{short:'Unscheduled',long:'Unscheduled'}:{short:SHORT[w.day],long:LONG[w.day]}]));
}

/** The program of the newest program log that still exists, else the first (most recently edited) program. */
export function upNextProgram(programs,logs){
 const ids=new Set(programs.map(p=>p.id));
 return programLogs(logs,null).find(l=>ids.has(l.source.programId))?.source.programId??programs[0]?.id??null;
}

/** `program.id` identifies the program in log sources (set it on a resolved document); logs are newest first. */
export function upNextOccurrence(program,logs,now){
 const own=programLogs(logs,program.id),labels=occurrenceLabels(program);
 const pick=id=>id===undefined?null:{occurrenceId:id,label:labels.get(id).short};
 if(!isWeek(program)){
  const ids=sequenceIds(program);if(!ids.length)return null;
  const last=own.find(l=>ids.includes(l.source.occurrenceId));
  return pick(last?ids[(ids.indexOf(last.source.occurrenceId)+1)%ids.length]:ids[0]);
 }
 const scheduled=program.workouts.filter(w=>w.day!==null).sort((a,b)=>a.day-b.day);
 if(!scheduled.length)return null;
 const start=weekStart(now).getTime(),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()-weekday(now)+7).getTime();
 const logged=new Set(own.filter(l=>{const t=new Date(l.startedAt).getTime();return t>=start&&t<end;}).map(l=>l.source.occurrenceId));
 const today=weekday(now);
 return pick(scheduled.find(w=>w.day>=today&&!logged.has(w.id))?.id??scheduled[0].id);
}
