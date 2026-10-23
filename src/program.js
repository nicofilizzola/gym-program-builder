import { moveExercise } from './exercise.js';

/** @typedef {{name:string, exercises:import('./volume.js').Exercise[], goals:Record<string,number>}} Workout */
/** @typedef {Workout} SessionTemplate */
/** @typedef {Workout & {id:string, day:number|null}} ProgramWorkout */
/** @typedef {{name:string, mode:'simple'|'schedule', workouts:ProgramWorkout[], goals:Record<string,number>}} Program */
/** @typedef {{id:string,kind:'template'|'program',revision:number,createdAt:string,updatedAt:string,document:SessionTemplate|Program}} DocumentRecord */

export const createTemplate = () => ({name:'Untitled template',exercises:[],goals:{}});
export const createProgram = () => ({name:'Untitled program',mode:'simple',workouts:[],goals:{}});
export function copyWorkout(template,id) {
  const {name,exercises,goals}=structuredClone(template);
  return {name,exercises,goals,id,day:null};
}
export function duplicateProgram(program,makeId) {
  const copy=structuredClone(program);
  copy.workouts=copy.workouts.map(w=>({...w,id:makeId()}));
  return copy;
}
export function assignDay(program,workoutId,day) {
  if(day!==null && (!Number.isInteger(day)||day<0||day>6)) throw new Error('Invalid weekday.');
  return {...program,workouts:program.workouts.map(w=>w.id===workoutId?{...w,day}:w)};
}
export function moveWorkout(program,workoutId,toIndex) {
  return {...program,workouts:moveExercise(program.workouts,program.workouts.findIndex(w=>w.id===workoutId),toIndex)};
}
