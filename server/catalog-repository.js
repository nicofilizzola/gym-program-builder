import {syncVariantTags,tagRow,createTagRepository} from './tag-repository.js';
import {validateCatalogEntry,validateReference,normalizeSearch} from '../src/catalog.js';
import {domainError} from './repository.js';
import {createReferenceRepository,readReference,referenceRow,referenceName,referenceType} from './reference-repository.js';
import {catalogImpact,propagateCatalogEntry} from './catalog-propagation.js';
export {documentExercises} from './catalog-propagation.js';
export const catalogRow=row=>{const tags=JSON.parse(row.tags_json||'[]').map(tagRow);return ({id:row.id,familyId:row.family_id,familyName:row.family_name,exerciseType:row.reference_exercise_type,name:row.name,equipment:row.reference_equipment,equipmentConfigured:Boolean(row.reference_equipment),description:row.description,referenceDescription:row.reference_description,brand:tags.find(t=>t.kind==='brand')||null,focusTags:tags.filter(t=>t.kind==='focus').sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),primaryMuscles:JSON.parse(row.primary_json),secondaryMuscles:JSON.parse(row.secondary_json),revision:Number(row.revision),archived:Boolean(row.archived||row.reference_archived),individuallyArchived:Boolean(row.archived),referenceArchived:Boolean(row.reference_archived),createdAt:row.created_at,updatedAt:row.updated_at});};
export const catalogSelect=`SELECT e.*,f.name AS family_name,f.archived AS reference_archived,f.exercise_type AS reference_exercise_type,f.equipment AS reference_equipment,f.description AS reference_description,
 (SELECT json_group_array(json_object('id',t.id,'kind',t.kind,'name',t.name,'archived',t.archived,'revision',t.revision)) FROM catalog_variant_tags vt JOIN catalog_tags t ON t.id=vt.tag_id WHERE vt.variant_id=e.id) AS tags_json
 FROM catalog_entries e JOIN catalog_families f ON f.id=e.family_id`;
export async function readCatalogEntry(tx,id) {
 const r=await tx.execute({sql:catalogSelect+' WHERE e.id=?',args:[id]});
 if(!r.rows.length)throw domainError('NOT_FOUND','Exercise not found.');
 return catalogRow(r.rows[0]);
}
export function createCatalogRepository(db,{now=()=>new Date().toISOString()}={}) {
 const validate=value=>{const r=validateCatalogEntry(value);if(r.error)throw domainError('INVALID',r.error);const {equipment,...owned}=r.entry;return owned;};
 const validId=id=>{if(typeof id!=='string'||!id||id.length>100)throw domainError('INVALID','Invalid catalog ID.');};
 const title=referenceName,references=createReferenceRepository(db),tags=createTagRepository(db);
 const checkRevision=(entry,revision)=>{if(!Number.isInteger(revision)||entry.revision!==revision)throw domainError('CONFLICT','This exercise changed. Reload the saved version or save your edits as a variant.');};
 async function write(fn){const tx=await db.transaction('write');try{const v=await fn(tx);await tx.commit();return v;}finally{tx.close();}}
 async function unique(tx,familyId,name,except=''){
  const rows=await tx.execute({sql:'SELECT id,name FROM catalog_entries WHERE family_id=? AND id<>?',args:[familyId,except]});
  if(rows.rows.some(e=>normalizeSearch(e.name)===normalizeSearch(name)))throw domainError('CONFLICT','A variant with this name already exists in this reference exercise, possibly archived. Choose a distinct variant name.');
 }
 return {
  listTags:tags.list,createTag:tags.create,updateTag:tags.update,archiveTag:tags.archive,referenceImpact:references.impact,createReference:references.create,getReference:references.get,updateReference:references.update,archiveReference:references.archive,renameFamily:references.update,
  async list(){
   const tx=await db.transaction('read');
   try{
    const entries=await tx.execute(catalogSelect+' ORDER BY e.name,e.id');
    const families=await tx.execute('SELECT * FROM catalog_families ORDER BY name,id');
    const tagRows=await tx.execute('SELECT * FROM catalog_tags ORDER BY kind,normalized_name,id');
    await tx.commit();
    return {tags:tagRows.rows.map(tagRow),entries:entries.rows.map(catalogRow),families:families.rows.map(referenceRow)};
   }finally{tx.close();}
  },
  async create({id,familyId,familyName,entry,referenceRevision,referenceExerciseType,reference:referenceDefinition,sourceVariantId}) {
   validId(id);validId(familyId);const clean=validate(entry);
   return write(async tx=>{
    const found=await tx.execute({sql:catalogSelect+' WHERE e.id=?',args:[id]});
    if(found.rows.length){
      const old=catalogRow(found.rows[0]);
      if(referenceDefinition!==undefined){
        const intent=validateReference({name:familyName,exerciseType:referenceExerciseType,equipment:entry.equipment,...referenceDefinition});
        if(intent.error)throw domainError('INVALID',intent.error);
        const saved=validateReference(await readReference(tx,old.familyId));
        if(JSON.stringify(intent.reference)!==JSON.stringify(saved.reference))throw domainError('CONFLICT','This variant was already created with different reference exercise metadata. Refresh the reference exercise before retrying.');
      }
      if(entry.equipment!==undefined&&entry.equipment!==old.equipment)throw domainError('INVALID','Equipment is inherited from the reference exercise.');
      const referenceIntent=referenceExerciseType!==undefined&&referenceExerciseType!=='';
      if(referenceIntent&&(old.exerciseType!==referenceType(referenceExerciseType)||old.familyName!==title(familyName)))throw domainError('CONFLICT','This variant was already created with a different reference exercise name or type. Refresh the reference exercise or restore the original values before retrying.');
      if(old.familyId===familyId&&JSON.stringify(validate(old))===JSON.stringify(clean))return old;
      throw domainError('CONFLICT','This entry ID already exists.');
    }
    const family=await tx.execute({sql:'SELECT id FROM catalog_families WHERE id=?',args:[familyId]});
    if(!family.rows.length){
     const result=validateReference({name:familyName,exerciseType:referenceExerciseType,equipment:entry.equipment,...referenceDefinition});if(result.error)throw domainError('INVALID',result.error);
     const ref=result.reference;
     await tx.execute({sql:'INSERT INTO catalog_families(id,name,exercise_type,equipment,description,default_primary_json,default_secondary_json) VALUES(?,?,?,?,?,?,?)',args:[familyId,ref.name,ref.exerciseType,ref.equipment,ref.description,JSON.stringify(ref.defaultPrimaryMuscles),JSON.stringify(ref.defaultSecondaryMuscles)]});
    }
    const reference=await readReference(tx,familyId);
    if(!reference.equipment)throw domainError('INVALID','Set equipment on the reference exercise first.');
    if(entry.equipment!==undefined&&entry.equipment!==reference.equipment)throw domainError('INVALID','Equipment is inherited from the reference exercise.');
    if(reference.archived)throw domainError('INVALID','Restore the reference exercise first.');
    if(referenceRevision!==undefined&&reference.revision!==referenceRevision)throw domainError('CONFLICT','This reference exercise changed. Reload the saved version.');
    await unique(tx,familyId,clean.name);const stamp=now();
    await tx.execute({sql:'INSERT INTO catalog_entries(id,family_id,name,equipment,primary_json,secondary_json,created_at,updated_at,description) VALUES(?,?,?,?,?,?,?,?,?)',args:[id,familyId,clean.name,reference.equipment,JSON.stringify(clean.primaryMuscles),JSON.stringify(clean.secondaryMuscles),stamp,stamp,clean.description]});
    const source=sourceVariantId?await readCatalogEntry(tx,sourceVariantId):undefined;if(source&&source.familyId!==familyId)throw domainError('INVALID','Variant source belongs to another reference exercise.');
    await syncVariantTags(tx,id,clean,{source});
    await tx.execute({sql:'UPDATE catalog_families SET revision=revision+1 WHERE id=?',args:[familyId]});
    return readCatalogEntry(tx,id);
   });
  },
  async impact(id){await readCatalogEntry(db,id);return catalogImpact(db,id);},
  async update({id,revision,entry,impact}) {
   const clean=validate(entry);
   return write(async tx=>{
    const old=await readCatalogEntry(tx,id);checkRevision(old,revision);
    if(entry.equipment!==undefined&&entry.equipment!==old.equipment)throw domainError('INVALID','Equipment is inherited from the reference exercise.');
    if(!Array.isArray(impact)||JSON.stringify(impact)!==JSON.stringify(await catalogImpact(tx,id)))throw domainError('CONFLICT','Affected workouts changed. Refresh the usage preview before saving.');
    await unique(tx,old.familyId,clean.name,id);const stamp=now();
    await tx.execute({sql:'UPDATE catalog_entries SET name=?,description=?,primary_json=?,secondary_json=?,revision=revision+1,updated_at=? WHERE id=?',args:[clean.name,clean.description,JSON.stringify(clean.primaryMuscles),JSON.stringify(clean.secondaryMuscles),stamp,id]});
    await syncVariantTags(tx,id,clean,{previous:old});
    const next=await readCatalogEntry(tx,id);
    await propagateCatalogEntry(tx,next,stamp);
    return next;
   });
  },
  async move({id,revision,destinationReferenceId,sourceReferenceRevision,destinationReferenceRevision,impact}){
   validId(destinationReferenceId);
   return write(async tx=>{
    const old=await readCatalogEntry(tx,id);
    if(Number.isInteger(revision)&&old.revision===revision+1&&old.familyId===destinationReferenceId)return old;
    checkRevision(old,revision);
    if(old.familyId===destinationReferenceId)throw domainError('INVALID','Choose another reference exercise.');
    const source=await readReference(tx,old.familyId),destination=await readReference(tx,destinationReferenceId);
    if(!destination.equipment)throw domainError('INVALID','Set equipment on the destination reference exercise first.');
    if(destination.archived)throw domainError('INVALID','Choose an active destination reference exercise.');
    if(source.revision!==sourceReferenceRevision||destination.revision!==destinationReferenceRevision)throw domainError('CONFLICT','A reference exercise changed. Reload the move preview.');
    if(!Array.isArray(impact)||JSON.stringify(impact)!==JSON.stringify(await catalogImpact(tx,id)))throw domainError('CONFLICT','Affected workouts changed. Refresh the usage preview before moving.');
    await unique(tx,destinationReferenceId,old.name);
    const stamp=now();
    await tx.execute({sql:'UPDATE catalog_entries SET family_id=?,archived=?,revision=revision+1,updated_at=? WHERE id=?',args:[destinationReferenceId,old.archived?1:0,stamp,id]});
    for(const ref of [source,destination])await tx.execute({sql:'UPDATE catalog_families SET revision=revision+1 WHERE id=?',args:[ref.id]});
    const next=await readCatalogEntry(tx,id);await propagateCatalogEntry(tx,next,stamp);return next;
   });
  },
  async archive({id,revision,archived}){
   if(typeof archived!=='boolean')throw domainError('INVALID','Invalid archive state.');
   return write(async tx=>{const old=await readCatalogEntry(tx,id);checkRevision(old,revision);if(!archived&&old.referenceArchived)throw domainError('INVALID','Restore the reference exercise first.');if(old.individuallyArchived===archived)return old;await tx.execute({sql:'UPDATE catalog_entries SET archived=?,revision=revision+1,updated_at=? WHERE id=?',args:[archived?1:0,now(),id]});await tx.execute({sql:'UPDATE catalog_families SET revision=revision+1 WHERE id=?',args:[old.familyId]});return readCatalogEntry(tx,id);});
  }
 };
}
