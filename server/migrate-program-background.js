import {hasProgramContext} from '../src/program-context.js';

const KEY='trainingBackgroundAndApproach';

/** Migration 007: back up and remove per-program training background; runs inside the migration transaction. */
export async function migrateProgramBackground(tx,{now=()=>new Date().toISOString()}={}){
 const stamp=now();let cleared=0;
 for(const row of (await tx.execute("SELECT id,document_json FROM documents WHERE kind='program' ORDER BY id")).rows){
  const document=JSON.parse(row.document_json),context=document.context,text=context&&typeof context==='object'&&!Array.isArray(context)?context[KEY]:undefined;
  if(typeof text!=='string'||!text.trim())continue;
  await tx.execute({sql:'INSERT INTO program_context_background_backup(program_id,text,backed_up_at) VALUES(?,?,?)',args:[row.id,text,stamp]});
  delete context[KEY];
  let keep;try{keep=hasProgramContext(document);}catch{keep=true;}// never discard unexpected saved values
  if(!keep)delete document.context;
  await tx.execute({sql:'UPDATE documents SET document_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[JSON.stringify(document),stamp,row.id]});
  cleared++;
 }
 return {cleared};
}
