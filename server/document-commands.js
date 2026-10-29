import {createRepository,domainError} from './repository.js';
import {reconcileSequence} from '../src/program-sequence.js';
import {randomUUID} from 'node:crypto';
import {validateDocumentBundle} from '../src/document-bundle.js';

/** Persist command results with their intent so a lost acknowledgement is safe to replay. */
export function createDocumentCommands(db){
 async function execute(request,action){
  if(typeof request.operationId!=='string'||!request.operationId||request.operationId.length>100)throw domainError('INVALID','Invalid operation ID.');
  const intent=JSON.stringify(request),tx=await db.transaction('write');
  try{
   const old=(await tx.execute({sql:'SELECT * FROM document_operations WHERE id=?',args:[request.operationId]})).rows[0];
   if(old){if(old.request_json!==intent)throw domainError('CONFLICT','Operation ID was used for a different request.');await tx.commit();return JSON.parse(old.result_json);}
   const result=await action(createRepository(tx,{inTransaction:true}),tx);
   await tx.execute({sql:'INSERT INTO document_operations VALUES(?,?,?)',args:[request.operationId,intent,JSON.stringify(result)]});
   await tx.commit();return result;
  }finally{tx.close();}
 }
 return {
  async importDocument(request){return execute(request,async repository=>{
   let bundle;try{bundle=validateDocumentBundle(request.bundle);}catch(error){throw domainError('INVALID',error.message);}
   const target=request.targetId?await repository.get(request.targetId):null;
   if(target&&target.kind!==bundle.kind)throw domainError('INVALID','Import this file from the matching library.');
   if(target&&target.revision!==request.revision)throw domainError('CONFLICT','A newer version was saved.');
   const templates=[],identities=new Map();let document;
   if(bundle.kind==='template')document=bundle.template;
   else{
    for(const item of bundle.templates){
     const record=await repository.create({id:randomUUID(),kind:'template',document:item.template});
     identities.set(item.key,record.id);templates.push(record);
    }
    const occurrences=new Map(bundle.program.workouts.map(w=>[w.key,randomUUID()]));
    document={...bundle.program,workouts:bundle.program.workouts.map(w=>({id:occurrences.get(w.key),templateId:identities.get(w.templateKey),day:w.day}))};
    if(document.sequence)document.sequence=document.sequence.map(e=>e.type==='workout'?{type:'workout',workoutId:occurrences.get(e.workoutKey)}:{type:'rest',id:randomUUID()});
   }
   const record=target?await repository.update({id:target.id,revision:request.revision,document}):await repository.create({id:randomUUID(),kind:bundle.kind,document});
   return {record,templates};
  });},
  async createAndAttach(request){return execute(request,async repository=>{
   const {programId,revision,templateId,occurrenceId,template}=request;
   const program=await repository.get(programId);
   if(program.kind!=='program')throw domainError('INVALID','Expected a program.');
   if(program.revision!==revision)throw domainError('CONFLICT','A newer program version was saved.');
   await repository.create({id:templateId,kind:'template',document:template});
   const document=reconcileSequence({...program.document,workouts:[...program.document.workouts,{id:occurrenceId,templateId,day:null}]});
   await repository.update({id:programId,revision,document});
   return repository.programBundle(programId);
  });},
 };
}
