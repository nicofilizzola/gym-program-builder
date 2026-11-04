import {MUSCLE_GROUPS} from './muscles.js';
/** Reference exercise and variant names allow up to this many characters (after trimming). */
export const CATALOG_NAME_MAX=200;
export const EQUIPMENT=['Barbell','Dumbbell','Cable','Machine','Bodyweight','Kettlebell','Resistance band','Other'];
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
export function catalogSearchText(entry,reference){return normalizeSearch([entry.name,reference?.name||entry.familyName,entry.equipment,typeof entry.brand==='string'?entry.brand:entry.brand?.name,...(entry.focusTags||[]).map(t=>typeof t==='string'?t:t.name)].filter(Boolean).join(' '));}
export function descriptionText(value=''){
 if(typeof value!=='string'||value.length>2000)throw Error('Description must be at most 2,000 characters.');
 return value.replace(/\r\n?/g,'\n').trim();
}
export function validateReference(value){
 try{
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>CATALOG_NAME_MAX)throw Error(`Enter a reference exercise name (up to ${CATALOG_NAME_MAX} characters).`);
  if(!['compound','isolation'].includes(value.exerciseType))throw Error('Choose Compound or Isolation.');
  if(!EQUIPMENT.includes(value.equipment))throw Error('Choose equipment for the reference exercise.');
  const primary=value.defaultPrimaryMuscles??[],secondary=value.defaultSecondaryMuscles??[];
  for(const list of [primary,secondary])if(!Array.isArray(list)||list.some(m=>!MUSCLE_GROUPS.includes(m))||new Set(list).size!==list.length)throw Error('Choose valid, distinct default muscles.');
  if(primary.some(m=>secondary.includes(m)))throw Error('A default muscle cannot be both primary and secondary.');
  return {reference:{name:value.name.trim(),exerciseType:value.exerciseType,equipment:value.equipment,description:descriptionText(value.description),defaultPrimaryMuscles:MUSCLE_GROUPS.filter(m=>primary.includes(m)),defaultSecondaryMuscles:MUSCLE_GROUPS.filter(m=>secondary.includes(m))}};
 }catch(error){return {error:error.message};}
}
export function validateCatalogEntry(value) {
  const fail=error=>({error});
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>CATALOG_NAME_MAX)return fail(`Enter an exercise name (up to ${CATALOG_NAME_MAX} characters).`);
  if(value.equipment!==undefined&&!EQUIPMENT.includes(value.equipment))return fail('Choose equipment.');
  for(const key of ['primaryMuscles','secondaryMuscles']) {
    if(!Array.isArray(value[key])||value[key].some(m=>!MUSCLE_GROUPS.includes(m))||new Set(value[key]).size!==value[key].length)return fail('Choose valid, distinct muscles.');
  }
  if(!value.primaryMuscles.length)return fail('Choose at least one primary muscle.');
  if(value.primaryMuscles.some(m=>value.secondaryMuscles.includes(m)))return fail('A muscle cannot be both primary and secondary.');
  let description;try{description=descriptionText(value.description);}catch(error){return fail(error.message);}
  const brandId=value.brandId??value.brand?.id??null,focusTagIds=value.focusTagIds??value.focusTags?.map(t=>t.id)??[];
  if(brandId!==null&&(typeof brandId!=='string'||!brandId||brandId.length>100))return fail('Choose a valid Brand.');
  if(!Array.isArray(focusTagIds)||focusTagIds.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(focusTagIds).size!==focusTagIds.length)return fail('Choose distinct Focus tags.');
  return {entry:{name:value.name.trim(),...(value.equipment===undefined?{}:{equipment:value.equipment}),description,brandId,focusTagIds:[...focusTagIds].sort(),primaryMuscles:MUSCLE_GROUPS.filter(m=>value.primaryMuscles.includes(m)),secondaryMuscles:MUSCLE_GROUPS.filter(m=>value.secondaryMuscles.includes(m))}};
}
export function searchCatalog(entries,query='',{equipment='',limit=8}={}) {
  const q=normalizeSearch(query),words=q.split(/\s+/).filter(Boolean);
  const rank=e=>normalizeSearch(e.name)===q?0:normalizeSearch(e.name).startsWith(q)?1:2;
  return entries.filter(e=>!e.archived&&e.equipmentConfigured!==false&&(!equipment||e.equipment===equipment)&&words.every(word=>catalogSearchText(e).includes(word)))
    .sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,limit);
}
export function snapshotExercise(exercise,entry) {
  return {...exercise,name:entry.name,primaryMuscles:[...entry.primaryMuscles],secondaryMuscles:[...entry.secondaryMuscles],catalogId:entry.id,catalogRevision:entry.revision,familyId:entry.familyId,...(entry.equipment?{equipment:entry.equipment}:{}),referenceDescription:entry.referenceDescription||'',variantDescription:entry.description||'',brand:entry.brand?.name||'',focusTags:(entry.focusTags||[]).map(t=>t.name)};
}
export function unlinkExercise({catalogId,catalogRevision,catalogCopyOf,familyId,...exercise}) {return exercise;}
