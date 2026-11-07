import {parseSession} from './session-file.js';
import {validateLegacyDocument as validateDocument} from './document-validation.js';
import {unlinkExercise} from './catalog.js';
function portableExercises(value) {
  if(value&&typeof value==='object'){
    if(Array.isArray(value.exercises))value.exercises=value.exercises.map(ex=>ex&&typeof ex==='object'?unlinkExercise(ex):ex);
    if(Array.isArray(value.workouts))value.workouts.forEach(portableExercises);
  }
  return value;
}
export const MAX_DOCUMENT_BYTES=1048576;
export function serializeDocument(kind,value) {
  const {document,error}=validateDocument(kind,value);
  if(error) throw new Error(error);
  const portable=portableExercises(structuredClone(document));
  if(kind==='program') {
    if(portable.sequence)portable.sequence=portable.sequence.map(e=>e.type==='rest'?{type:'rest'}:{type:'workout',workoutIndex:portable.workouts.findIndex(w=>w.id===e.workoutId)});
    portable.workouts=portable.workouts.map(({id,...w})=>w);
  }
  return JSON.stringify({version:2,kind,[kind]:portable},null,2);
}
export function parseDocument(text,{makeId=()=>crypto.randomUUID()}={}) {
  if(new TextEncoder().encode(text).length>MAX_DOCUMENT_BYTES) return {error:'File must be at most 1 MiB.'};
  let data;
  try {data=JSON.parse(text);} catch {return {error:'File is not valid JSON.'};}
  if(data?.version===1) {
    const result=parseSession(text);
    if(result.error)return result;
    const validated=validateDocument('template',{name:'Imported session template',...result.session,...(Object.hasOwn(data,'coverId')?{coverId:data.coverId}:{})});
    return validated.error?validated:{kind:'template',document:validated.document};
  }
  if(data?.version!==2) return {error:'Unsupported file version.'};
  if(!['template','program'].includes(data.kind)) return {error:'Unknown document kind.'};
  const value=portableExercises(structuredClone(data[data.kind]));
  if(data.kind==='program'&&Array.isArray(value?.workouts)) value.workouts=value.workouts.map(w=>w&&typeof w==='object'?{...w,id:makeId()}:w);
  if(data.kind==='program'&&value&&Object.hasOwn(value,'sequence')) {
    if(!Array.isArray(value.sequence))return {error:'Invalid program sequence.'};
    const sequence=[];
    for(const entry of value.sequence) {
      if(entry?.type==='rest')sequence.push({type:'rest',id:makeId()});
      else if(entry?.type==='workout'&&Number.isInteger(entry.workoutIndex)&&entry.workoutIndex>=0&&entry.workoutIndex<value.workouts?.length)
        sequence.push({type:'workout',workoutId:value.workouts[entry.workoutIndex]?.id});
      else return {error:'Invalid sequence entry or workout index.'};
    }
    value.sequence=sequence;
  }
  const result=validateDocument(data.kind,value);
  return result.error?result:{kind:data.kind,document:result.document};
}
export function documentFileName(kind,date=new Date()) {
  const pad=n=>String(n).padStart(2,'0');
  return `gym-${kind==='program'?'program':'session-template'}-${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}.json`;
}
