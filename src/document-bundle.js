import {parseDocument,MAX_DOCUMENT_BYTES} from './document-file.js';
import {validateDocument} from './document-validation.js';
import {unlinkExercise} from './catalog.js';

const key=value=>typeof value==='string'&&value.length>0&&value.length<=100;
function portableTemplate(value){
 if(!value||!Array.isArray(value.exercises))throw Error('Invalid session template.');
 const result=validateDocument('template',{...value,exercises:value.exercises.map(ex=>ex&&typeof ex==='object'?unlinkExercise(ex):ex)});
 if(result.error)throw Error(result.error);return result.document;
}
export function validateDocumentBundle(data){
 if(data?.version!==3&&data?.version!==4)throw Error('Unsupported file version.');
 if(data.kind==='template')return {version:4,kind:'template',template:portableTemplate(data.template)};
 if(data.kind!=='program'||!Array.isArray(data.templates)||!data.program||!Array.isArray(data.program.workouts))throw Error('Invalid program bundle.');
 const keys=new Set(),templates=data.templates.map(item=>{
  if(!item||!key(item.key)||keys.has(item.key))throw Error('Missing or duplicate template key.');
  keys.add(item.key);return {key:item.key,template:portableTemplate(item.template)};
 });
 const occurrences=new Set(),workouts=data.program.workouts.map(item=>{
  if(!item||!key(item.key)||occurrences.has(item.key))throw Error('Missing or duplicate occurrence key.');
  if(!keys.has(item.templateKey))throw Error('Unknown template key.');
  occurrences.add(item.key);return {id:item.key,templateId:item.templateKey,day:item.day};
 });
 const candidate={...data.program,workouts};
 if(Object.hasOwn(data.program,'sequence')){
  if(!Array.isArray(data.program.sequence))throw Error('Invalid program sequence.');
  candidate.sequence=data.program.sequence.map(e=>{
   if(e?.type==='workout'&&key(e.workoutKey))return {type:'workout',workoutId:e.workoutKey};
   if(e?.type==='rest'&&key(e.key))return {type:'rest',id:e.key};
   throw Error('Invalid sequence entry.');
  });
 }
 const result=validateDocument('program',candidate);if(result.error)throw Error(result.error);
 const program={...result.document,workouts:workouts.map(w=>({key:w.id,templateKey:w.templateId,day:w.day}))};
 if(candidate.sequence)program.sequence=candidate.sequence.map(e=>e.type==='workout'?{type:'workout',workoutKey:e.workoutId}:{type:'rest',key:e.id});
 return {version:4,kind:'program',templates,program};
}
export function parseDocumentBundle(text){
 try{
  if(new TextEncoder().encode(text).length>MAX_DOCUMENT_BYTES)throw Error('File must be at most 1 MiB.');
  const data=JSON.parse(text);
  if((data?.version===3||data?.version===4))return {bundle:validateDocumentBundle(data)};
  const parsed=parseDocument(text);if(parsed.error)throw Error(parsed.error);
  if(parsed.kind==='template')return {bundle:validateDocumentBundle({version:4,kind:'template',template:parsed.document})};
  const templates=parsed.document.workouts.map((w,i)=>{const {id,day,...template}=w;return {key:'template-'+i,template};});
  const program={...parsed.document,workouts:parsed.document.workouts.map((w,i)=>({key:w.id,templateKey:templates[i].key,day:w.day}))};
  if(program.sequence)program.sequence=program.sequence.map(e=>e.type==='workout'?{type:'workout',workoutKey:e.workoutId}:{type:'rest',key:e.id});
  return {bundle:validateDocumentBundle({version:4,kind:'program',templates,program})};
 }catch(error){return {error:error instanceof SyntaxError?'File is not valid JSON.':error.message};}
}
export function serializeDocumentBundle({record,templates=[]}){
 let data;
 if(record.kind==='template')data={version:4,kind:'template',template:record.document};
 else{
  const used=new Map(),portableTemplates=[];
  for(const w of record.document.workouts)if(!used.has(w.templateId)){
   const t=templates.find(t=>t.id===w.templateId&&t.kind==='template');if(!t)throw Error('Session template not found.');
   const templateKey='template-'+used.size;used.set(w.templateId,templateKey);portableTemplates.push({key:templateKey,template:t.document});
  }
  const occurrences=new Map(record.document.workouts.map((w,i)=>[w.id,'workout-'+i]));
  const program={...record.document,workouts:record.document.workouts.map(w=>({key:occurrences.get(w.id),templateKey:used.get(w.templateId),day:w.day}))};
  if(program.sequence)program.sequence=program.sequence.map((e,i)=>e.type==='workout'?{type:'workout',workoutKey:occurrences.get(e.workoutId)}:{type:'rest',key:'rest-'+i});
  data={version:4,kind:'program',templates:portableTemplates,program};
 }
 const text=JSON.stringify(validateDocumentBundle(data),null,2);
 if(new TextEncoder().encode(text).length>MAX_DOCUMENT_BYTES)throw Error('File must be at most 1 MiB.');return text;
}
