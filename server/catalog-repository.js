import {validateCatalogEntry,snapshotExercise,normalizeSearch} from '../src/catalog.js';
import {domainError} from './repository.js';
import {createReferenceRepository,readReference,referenceName} from './reference-repository.js';
export const catalogRow=row=>({id:row.id,familyId:row.family_id,familyName:row.family_name,name:row.name,equipment:row.equipment,primaryMuscles:JSON.parse(row.primary_json),secondaryMuscles:JSON.parse(row.secondary_json),revision:Number(row.revision),archived:Boolean(row.archived||row.reference_archived),individuallyArchived:Boolean(row.archived),referenceArchived:Boolean(row.reference_archived),createdAt:row.created_at,updatedAt:row.updated_at});
export const catalogSelect='SELECT e.*,f.name AS family_name,f.archived AS reference_archived FROM catalog_entries e JOIN catalog_families f ON f.id=e.family_id';
export async function readCatalogEntry(tx,id) {
 const r=await tx.execute({sql:catalogSelect+' WHERE e.id=?',args:[id]});
 if(!r.rows.length)throw domainError('NOT_FOUND','Exercise not found.');
 return catalogRow(r.rows[0]);
}
export const documentExercises=document=>(document.workouts?document.workouts.flatMap(w=>w.exercises):document.exercises);
export function createCatalogRepository(db,{now=()=>new Date().toISOString()}={}) {
 const validate=value=>{const r=validateCatalogEntry(value);if(r.error)throw domainError('INVALID',r.error);return r.entry;};
 const validId=id=>{if(typeof id!=='string'||!id||id.length>100)throw domainError('INVALID','Invalid catalog ID.');};
 const title=referenceName,references=createReferenceRepository(db);
 const checkRevision=(entry,revision)=>{if(!Number.isInteger(revision)||entry.revision!==revision)throw domainError('CONFLICT','This exercise changed. Reload the saved version or save your edits as a variant.');};
 async function write(fn){const tx=await db.transaction('write');try{const v=await fn(tx);await tx.commit();return v;}finally{tx.close();}}
 async function documents(tx){return (await tx.execute('SELECT id,revision,document_json FROM documents ORDER BY id')).rows.map(r=>({id:r.id,revision:Number(r.revision),document:JSON.parse(r.document_json)}));}
 async function usage(tx,id){return (await documents(tx)).map(r=>({id:r.id,revision:r.revision,count:documentExercises(r.document).filter(ex=>ex.catalogId===id).length})).filter(r=>r.count);}
 async function unique(tx,familyId,name,except=''){
  const rows=await tx.execute({sql:'SELECT id,name FROM catalog_entries WHERE family_id=? AND id<>?',args:[familyId,except]});
  if(rows.rows.some(e=>normalizeSearch(e.name)===normalizeSearch(name)))throw domainError('CONFLICT','An entry with this name already exists in this family, possibly archived.');
 }
 return {
  createReference:references.create,getReference:references.get,updateReference:references.update,archiveReference:references.archive,renameFamily:references.update,
  async list(){const [entries,families]=await Promise.all([db.execute(catalogSelect+' ORDER BY e.name,e.id'),db.execute('SELECT id,name,revision,archived FROM catalog_families ORDER BY name,id')]);return {entries:entries.rows.map(catalogRow),families:families.rows.map(f=>({...f,revision:Number(f.revision),archived:Boolean(f.archived)}))};},
  async create({id,familyId,familyName,entry,referenceRevision}) {
   validId(id);validId(familyId);const clean=validate(entry);
   return write(async tx=>{
    const found=await tx.execute({sql:catalogSelect+' WHERE e.id=?',args:[id]});
    if(found.rows.length){const old=catalogRow(found.rows[0]);if(old.familyId===familyId&&JSON.stringify(validate(old))===JSON.stringify(clean))return old;throw domainError('CONFLICT','This entry ID already exists.');}
    const family=await tx.execute({sql:'SELECT id FROM catalog_families WHERE id=?',args:[familyId]});
    if(!family.rows.length)await tx.execute({sql:'INSERT INTO catalog_families(id,name) VALUES(?,?)',args:[familyId,title(familyName)]});
    const reference=await readReference(tx,familyId);
    if(reference.archived)throw domainError('INVALID','Restore the reference exercise first.');
    if(referenceRevision!==undefined&&reference.revision!==referenceRevision)throw domainError('CONFLICT','This reference exercise changed. Reload the saved version.');
    await unique(tx,familyId,clean.name);const stamp=now();
    await tx.execute({sql:'INSERT INTO catalog_entries(id,family_id,name,equipment,primary_json,secondary_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[id,familyId,clean.name,clean.equipment,JSON.stringify(clean.primaryMuscles),JSON.stringify(clean.secondaryMuscles),stamp,stamp]});
    await tx.execute({sql:'UPDATE catalog_families SET revision=revision+1 WHERE id=?',args:[familyId]});
    return readCatalogEntry(tx,id);
   });
  },
  async impact(id){await readCatalogEntry(db,id);return usage(db,id);},
  async update({id,revision,entry,impact}) {
   const clean=validate(entry);
   return write(async tx=>{
    const old=await readCatalogEntry(tx,id);checkRevision(old,revision);
    if(!Array.isArray(impact)||JSON.stringify(impact)!==JSON.stringify(await usage(tx,id)))throw domainError('CONFLICT','Affected workouts changed. Refresh the usage preview before saving.');
    await unique(tx,old.familyId,clean.name,id);const stamp=now();
    await tx.execute({sql:'UPDATE catalog_entries SET name=?,equipment=?,primary_json=?,secondary_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[clean.name,clean.equipment,JSON.stringify(clean.primaryMuscles),JSON.stringify(clean.secondaryMuscles),stamp,id]});
    const next=await readCatalogEntry(tx,id);
    for(const record of await documents(tx)){
     let changed=false;
     for(const ex of documentExercises(record.document))if(ex.catalogId===id){Object.assign(ex,snapshotExercise(ex,next));changed=true;}
     if(changed)await tx.execute({sql:'UPDATE documents SET document_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[JSON.stringify(record.document),stamp,record.id]});
    }
    return next;
   });
  },
  async archive({id,revision,archived}){
   if(typeof archived!=='boolean')throw domainError('INVALID','Invalid archive state.');
   return write(async tx=>{const old=await readCatalogEntry(tx,id);checkRevision(old,revision);if(!archived&&old.referenceArchived)throw domainError('INVALID','Restore the reference exercise first.');if(old.individuallyArchived===archived)return old;await tx.execute({sql:'UPDATE catalog_entries SET archived=?,revision=revision+1,updated_at=? WHERE id=?',args:[archived?1:0,now(),id]});await tx.execute({sql:'UPDATE catalog_families SET revision=revision+1 WHERE id=?',args:[old.familyId]});return readCatalogEntry(tx,id);});
  }
 };
}
