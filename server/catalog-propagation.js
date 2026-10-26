import {snapshotExercise} from '../src/catalog.js';
export const documentExercises=document=>document.workouts?document.workouts.flatMap(w=>w.exercises):document.exercises;
async function documents(tx){return (await tx.execute('SELECT id,revision,document_json FROM documents ORDER BY id')).rows.map(r=>({id:r.id,revision:Number(r.revision),document:JSON.parse(r.document_json)}));}
export async function catalogImpact(tx,id){
 return (await documents(tx)).map(r=>({id:r.id,revision:r.revision,count:documentExercises(r.document).filter(ex=>ex.catalogId===id).length})).filter(r=>r.count);
}
export async function propagateCatalogEntry(tx,entry,stamp){
 const updated=[];
 for(const record of await documents(tx)){
  let changed=false;
  for(const ex of documentExercises(record.document))if(ex.catalogId===entry.id){Object.assign(ex,snapshotExercise(ex,entry));changed=true;}
  if(changed){await tx.execute({sql:'UPDATE documents SET document_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[JSON.stringify(record.document),stamp,record.id]});updated.push(record.id);}
 }
 return updated;
}
