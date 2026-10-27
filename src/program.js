import { moveExercise } from './exercise.js';
import { normalizeWorkoutTiming } from './duration.js';
import {reconcileSequence} from './program-sequence.js';

/** @typedef {{name:string, exercises:import('./volume.js').Exercise[], goals:Record<string,number>, extraMinutes:number, bufferPercent:number}} Workout */
/** @typedef {Workout} SessionTemplate */
/** @typedef {Workout & {id:string, day:number|null}} ProgramWorkout */
/** @typedef {{type:'workout',workoutId:string}|{type:'rest',id:string}} SequenceEntry */
/** @typedef {{name:string, mode:'simple'|'schedule', workouts:ProgramWorkout[], goals:Record<string,number>, sequence?:SequenceEntry[]}} Program */
/** @typedef {{id:string,kind:'template'|'program',revision:number,createdAt:string,updatedAt:string,document:SessionTemplate|Program}} DocumentRecord */

export const createTemplate = () => ({name:'Untitled template',exercises:[],goals:{},extraMinutes:5,bufferPercent:10});
export const createProgram = () => ({name:'Untitled program',mode:'schedule',workouts:[],goals:{}});
export function copyWorkout(template,id,sourceId) {
  const copy=normalizeWorkoutTiming(structuredClone(template));
  if(sourceId)for(const ex of copy.exercises)if(ex.catalogId)ex.catalogCopyOf=sourceId;
  return {...copy,id,day:null};
}
export function duplicateProgram(program,makeId) {
  const copy=structuredClone(program);
  const identities=new Map();
  copy.workouts=copy.workouts.map(w=>{const id=makeId();identities.set(w.id,id);return {...w,id};});
  if(copy.sequence)copy.sequence=copy.sequence.map(e=>e.type==='workout'?{type:'workout',workoutId:identities.get(e.workoutId)}:{type:'rest',id:makeId()});
  return copy;
}
export function assignDay(program,workoutId,day) {
  if(day!==null && (!Number.isInteger(day)||day<0||day>6)) throw new Error('Invalid weekday.');
  return {...program,workouts:program.workouts.map(w=>w.id===workoutId?{...w,day}:w)};
}
export function moveWorkout(program,workoutId,toIndex) {
  return reconcileSequence({...program,workouts:moveExercise(program.workouts,program.workouts.findIndex(w=>w.id===workoutId),toIndex)});
}
/** Place once in canonical order; previews never call this operation. */
export function placeWorkout(program,workoutId,{day,beforeId=null,afterId=null}={}) {
  const workout=program.workouts.find(w=>w.id===workoutId);
  if(!workout)throw Error('Workout not found.');
  if(day!==undefined&&day!==null&&(!Number.isInteger(day)||day<0||day>6))throw Error('Invalid weekday.');
  if(beforeId!==null&&afterId!==null)throw Error('Choose one placement anchor.');
  const workouts=program.workouts.filter(w=>w.id!==workoutId),anchor=beforeId??afterId;
  const index=anchor===null?workouts.length:workouts.findIndex(w=>w.id===anchor);
  if(index<0)throw Error('Placement anchor not found.');
  workouts.splice(index+(afterId!==null?1:0),0,{...workout,...(day===undefined?{}:{day})});
  return reconcileSequence({...program,workouts});
}
