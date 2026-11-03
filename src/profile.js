import {normalizeContextText} from './program-context.js';
import {EQUIPMENT} from './catalog.js';

export const PROFILE_TEXT_FIELDS=Object.freeze(['trainingBackgroundAndApproach','constraintsAndPreferences']);
export const PROFILE_LIMITS=Object.freeze({
 maxTrainingDaysPerWeek:Object.freeze({min:1,max:7,step:1}),
 maxSessionsPerDay:Object.freeze({min:1,max:2,step:1}),
 maxSessionMinutes:Object.freeze({min:20,max:180,step:5}),
 typicalRepsInReserve:Object.freeze({min:0,max:4,step:1})
});
export const EXPERIENCE_LEVELS=Object.freeze(['beginner','intermediate','advanced']);

const NUMBER_MESSAGES={
 maxTrainingDaysPerWeek:'Max training days per week must be 1 to 7.',
 maxSessionsPerDay:'Max sessions per day must be 1 or 2.',
 maxSessionMinutes:'Max session length must be 20 to 180 minutes in steps of 5.',
 typicalRepsInReserve:'Typical reps in reserve must be 0 to 4.'
};

function number(value,key){
 const raw=value&&Object.hasOwn(value,key)?value[key]:null;
 if(raw===null||raw===undefined)return null;
 const {min,max,step}=PROFILE_LIMITS[key];
 if(typeof raw!=='number'||!Number.isInteger(raw)||raw<min||raw>max||(raw-min)%step!==0)throw Error(NUMBER_MESSAGES[key]);
 return raw;
}

function pickSet(raw,allowed,message){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw)||new Set(raw).size!==raw.length||raw.some(item=>!allowed.includes(item)))throw Error(message);
 return allowed.filter(item=>raw.includes(item));
}

/** Single-user profile: two prose fields (program-context text rules) plus structured limits. Unknown keys are dropped; null/[] mean unknown. */
export function normalizeProfile(value=undefined){
 if(value!==undefined&&(value===null||typeof value!=='object'||Array.isArray(value)))throw Error('Invalid profile.');
 const text=Object.fromEntries(PROFILE_TEXT_FIELDS.map(key=>{
  const raw=value&&Object.hasOwn(value,key)?value[key]:'';
  if(typeof raw!=='string')throw Error('Invalid profile.');
  try{return [key,normalizeContextText(raw,key)];}catch{throw Error('Profile fields must be at most 2,000 characters.');}
 }));
 const level=value&&Object.hasOwn(value,'experienceLevel')?value.experienceLevel:null;
 if(level!==null&&level!==undefined&&!EXPERIENCE_LEVELS.includes(level))throw Error('Experience level must be beginner, intermediate or advanced.');
 return {
  trainingBackgroundAndApproach:text.trainingBackgroundAndApproach,
  constraintsAndPreferences:text.constraintsAndPreferences,
  maxTrainingDaysPerWeek:number(value,'maxTrainingDaysPerWeek'),
  availableWeekdays:pickSet(value?.availableWeekdays,[0,1,2,3,4,5,6],'Available weekdays must be unique days from Monday to Sunday.'),
  maxSessionsPerDay:number(value,'maxSessionsPerDay'),
  maxSessionMinutes:number(value,'maxSessionMinutes'),
  experienceLevel:level??null,
  typicalRepsInReserve:number(value,'typicalRepsInReserve'),
  equipment:pickSet(value?.equipment,EQUIPMENT,'Equipment must be unique known equipment types.')
 };
}
