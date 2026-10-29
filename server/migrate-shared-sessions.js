import {randomUUID} from 'node:crypto';
import {validateDocument} from '../src/document-validation.js';

export async function migrateSharedSessions(tx,{now=()=>new Date().toISOString(),makeId=randomUUID}={}){
 let convertedPrograms=0,createdTemplates=0;
 const records=await tx.execute("SELECT * FROM documents WHERE kind='program' ORDER BY id");
 for(const record of records.rows){
  const program=JSON.parse(record.document_json),workouts=[];
  if(!Array.isArray(program.workouts))throw Error('Invalid legacy program.');
  for(const old of program.workouts){
   let templateId=old.templateId;
   if(!templateId){
    const {id,day,...template}=old;
    const valid=validateDocument('template',template,{draft:true});
    if(valid.error)throw Error(`Cannot migrate ${record.id}: ${valid.error}`);
    templateId=makeId();const stamp=now();
    await tx.execute({sql:'INSERT INTO documents VALUES(?,?,1,?,?,?)',args:[templateId,'template',JSON.stringify(valid.document),stamp,stamp]});
    await tx.execute({sql:'INSERT INTO shared_session_migration_map VALUES(?,?,?)',args:[record.id,id,templateId]});
    createdTemplates++;
   }
   workouts.push({id:old.id,templateId,day:old.day});
   await tx.execute({sql:'INSERT INTO program_template_links VALUES(?,?,?)',args:[record.id,old.id,templateId]});
  }
  const valid=validateDocument('program',{...program,workouts},{draft:true});
  if(valid.error)throw Error(`Cannot migrate ${record.id}: ${valid.error}`);
  await tx.execute({sql:'UPDATE documents SET document_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[JSON.stringify(valid.document),now(),record.id]});
  convertedPrograms++;
 }
 return {convertedPrograms,createdTemplates};
}
