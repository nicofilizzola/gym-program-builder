import {computeDuration} from './duration.js';

/**
 * Pure limit checks of resolved program occurrences against a normalized profile.
 * `workouts` are `{day: 0-6|null, ...workout}` in program order; `mode` 'simple' (Sequence) skips day checks.
 * Occurrence and exercise positions are 1-based. Null/empty profile fields yield no findings.
 */
export function profileChecks({mode,workouts},profile){
 const week=mode==='schedule';
 const byDay=new Map();
 let unscheduledCount=0;
 workouts.forEach((w,i)=>{
  if(!week)return;
  if(w.day===null||w.day===undefined){unscheduledCount++;return;}
  if(!byDay.has(w.day))byDay.set(w.day,[]);
  byDay.get(w.day).push(i+1);
 });
 const days=[...byDay.entries()].sort((a,b)=>a[0]-b[0]);
 const {maxTrainingDaysPerWeek:maxDays,availableWeekdays,maxSessionsPerDay,maxSessionMinutes,equipment}=profile;
 const longSessions=[],equipmentMismatches=[];
 workouts.forEach((w,i)=>{
  if(maxSessionMinutes!==null){
   const displayMinutes=computeDuration(w).displayMinutes;
   if(displayMinutes>maxSessionMinutes)longSessions.push({occurrence:i+1,name:(w.name??'').trim()||'Untitled workout',displayMinutes,max:maxSessionMinutes});
  }
  if(equipment.length)w.exercises.forEach((ex,j)=>{
   if(ex.equipment&&!equipment.includes(ex.equipment))equipmentMismatches.push({occurrence:i+1,exercisePosition:j+1,name:(ex.name??'').trim()||'Untitled exercise',equipment:ex.equipment});
  });
 });
 return {
  unscheduledCount,
  trainingDays:week&&maxDays!==null&&days.length>maxDays?{count:days.length,max:maxDays}:null,
  unavailableDays:week&&availableWeekdays.length?days.filter(([day])=>!availableWeekdays.includes(day)).map(([day,occurrences])=>({day,occurrences})):[],
  crowdedDays:week&&maxSessionsPerDay!==null?days.filter(([,o])=>o.length>maxSessionsPerDay).map(([day,o])=>({day,count:o.length,max:maxSessionsPerDay})):[],
  longSessions,
  equipmentMismatches
 };
}
