import {domainError} from './repository.js';

export async function syncProgramLinks(tx,programId,document){
 for(const templateId of new Set(document.workouts.map(w=>w.templateId))){
  const row=(await tx.execute({sql:'SELECT kind FROM documents WHERE id=?',args:[templateId]})).rows[0];
  if(!row)throw domainError('NOT_FOUND','Session template not found.');
  if(row.kind!=='template')throw domainError('INVALID','Program occurrences must link to session templates.');
 }
 await tx.execute({sql:'DELETE FROM program_template_links WHERE program_id=?',args:[programId]});
 for(const w of document.workouts)await tx.execute({sql:'INSERT INTO program_template_links VALUES(?,?,?)',args:[programId,w.id,w.templateId]});
}

export async function templateUsage(tx,id){
 const result=await tx.execute({sql:'SELECT d.id,d.document_json,count(*) AS count FROM program_template_links l JOIN documents d ON d.id=l.program_id WHERE l.template_id=? GROUP BY d.id ORDER BY d.id',args:[id]});
 return result.rows.map(row=>({id:row.id,name:JSON.parse(row.document_json).name,count:Number(row.count)}));
}

export async function readProgramBundle(tx,id,read){
 const record=await read(tx,id);
 if(!record)throw domainError('NOT_FOUND','Program not found.');
 if(record.kind!=='program')throw domainError('INVALID','Expected a program.');
 const templates=[];
 for(const templateId of new Set(record.document.workouts.map(w=>w.templateId))){
  const template=await read(tx,templateId);
  if(!template||template.kind!=='template')throw domainError('NOT_FOUND','Session template not found.');
  templates.push(template);
 }
 return {record,templates};
}
