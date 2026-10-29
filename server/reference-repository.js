import {domainError} from './repository.js';
import {validateReference} from '../src/catalog.js';
import {catalogImpact,propagateCatalogEntries} from './catalog-propagation.js';
import {readCatalogEntry} from './catalog-repository.js';
import {templateUsage} from './program-links.js';

export function referenceName(name){
 if(typeof name!=='string'||!name.trim()||name.trim().length>200)throw domainError('INVALID','Enter a reference exercise name (up to 200 characters).');return name.trim();
}
export function referenceType(type){if(!['compound','isolation'].includes(type))throw domainError('INVALID','Choose Compound or Isolation for the reference exercise.');return type;}
export const referenceRow=row=>({id:row.id,name:row.name,revision:Number(row.revision),archived:Boolean(row.archived),exerciseType:row.exercise_type,equipment:row.equipment,equipmentConfigured:Boolean(row.equipment),description:row.description,defaultPrimaryMuscles:JSON.parse(row.default_primary_json),defaultSecondaryMuscles:JSON.parse(row.default_secondary_json)});
export async function readReference(tx,id){
 const row=(await tx.execute({sql:'SELECT * FROM catalog_families WHERE id=?',args:[id]})).rows[0];if(!row)throw domainError('NOT_FOUND','Reference exercise not found.');return referenceRow(row);
}
export async function referenceImpact(tx,id){
 const reference=await readReference(tx,id),variants=(await tx.execute({sql:'SELECT id,revision FROM catalog_entries WHERE family_id=? ORDER BY id',args:[id]})).rows.map(r=>({id:r.id,revision:Number(r.revision)}));
 const templates=new Map(),programs=new Map();
 for(const variant of variants)for(const impact of await catalogImpact(tx,variant.id)){
  const old=templates.get(impact.id);templates.set(impact.id,{...impact,count:impact.count+(old?.count||0)});
 }
 for(const template of templates.values())for(const program of await templateUsage(tx,template.id)){
  const old=programs.get(program.id);programs.set(program.id,{...program,count:program.count+(old?.count||0)});
 }
 return {referenceRevision:reference.revision,variants,templates:[...templates.values()].sort((a,b)=>a.id.localeCompare(b.id)),programs:[...programs.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
function clean(value){const result=validateReference(value);if(result.error)throw domainError('INVALID',result.error);return result.reference;}
const definition=reference=>({name:reference.name,exerciseType:reference.exerciseType,equipment:reference.equipment,description:reference.description,defaultPrimaryMuscles:reference.defaultPrimaryMuscles,defaultSecondaryMuscles:reference.defaultSecondaryMuscles});
export function createReferenceRepository(db){
 async function write(fn){const tx=await db.transaction('write');try{const value=await fn(tx);await tx.commit();return value;}finally{tx.close();}}
 const conflict=()=>domainError('CONFLICT','This reference exercise or its variants changed. Reload the saved version.');
 return {
  get:id=>readReference(db,id),
  async impact(id){const tx=await db.transaction('read');try{const result=await referenceImpact(tx,id);await tx.commit();return result;}finally{tx.close();}},
  async create(request){
   const value=clean(request),{id}=request;if(typeof id!=='string'||!id||id.length>100)throw domainError('INVALID','Invalid reference exercise ID.');
   return write(async tx=>{
    const found=(await tx.execute({sql:'SELECT id FROM catalog_families WHERE id=?',args:[id]})).rows[0];
    if(found){const old=await readReference(tx,id);if(JSON.stringify(definition(old))===JSON.stringify(value))return old;throw conflict();}
    await tx.execute({sql:'INSERT INTO catalog_families(id,name,exercise_type,equipment,description,default_primary_json,default_secondary_json) VALUES(?,?,?,?,?,?,?)',args:[id,value.name,value.exerciseType,value.equipment,value.description,JSON.stringify(value.defaultPrimaryMuscles),JSON.stringify(value.defaultSecondaryMuscles)]});return readReference(tx,id);
   });
  },
  async update(request){return write(async tx=>{
   const old=await readReference(tx,request.id),value=clean({...definition(old),...request});
   const same=JSON.stringify(definition(old))===JSON.stringify(value);
   if(!Number.isInteger(request.revision)||old.revision!==request.revision){if(old.revision===request.revision+1&&same)return old;throw conflict();}
   if(same)return old;
   const propagate=old.equipment!==value.equipment||old.description!==value.description;
   if(propagate){const impact=await referenceImpact(tx,old.id);if(JSON.stringify(request.impact)!==JSON.stringify(impact))throw domainError('CONFLICT','Affected variants or workouts changed. Refresh the reference usage preview.');}
   await tx.execute({sql:'UPDATE catalog_families SET name=?,exercise_type=?,equipment=?,description=?,default_primary_json=?,default_secondary_json=?,revision=revision+1 WHERE id=?',args:[value.name,value.exerciseType,value.equipment,value.description,JSON.stringify(value.defaultPrimaryMuscles),JSON.stringify(value.defaultSecondaryMuscles),old.id]});
   if(propagate){
    const stamp=new Date().toISOString(),entries=(await tx.execute({sql:'SELECT id FROM catalog_entries WHERE family_id=? ORDER BY id',args:[old.id]})).rows;
    const definitions=[];for(const entry of entries){await tx.execute({sql:'UPDATE catalog_entries SET revision=revision+1,updated_at=? WHERE id=?',args:[stamp,entry.id]});definitions.push(await readCatalogEntry(tx,entry.id));}await propagateCatalogEntries(tx,definitions,stamp);
   }
   return readReference(tx,old.id);
  });},
  async archive({id,revision,archived}){
   if(typeof archived!=='boolean')throw domainError('INVALID','Invalid reference archive state.');
   return write(async tx=>{const old=await readReference(tx,id);if(!Number.isInteger(revision))throw conflict();if(old.revision!==revision){if(old.revision===revision+1&&old.archived===archived)return old;throw conflict();}if(old.archived===archived)return old;await tx.execute({sql:'UPDATE catalog_families SET archived=?,revision=revision+1 WHERE id=?',args:[archived?1:0,id]});return readReference(tx,id);});
  },
 };
}
