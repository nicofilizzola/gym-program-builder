import {MUSCLE_GROUPS} from './muscles.js';
export const EQUIPMENT=['Barbell','Dumbbell','Cable','Machine','Bodyweight','Kettlebell','Resistance band','Other'];
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
export function validateCatalogEntry(value) {
  const fail=error=>({error});
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>200)return fail('Enter an exercise name (up to 200 characters).');
  if(!EQUIPMENT.includes(value.equipment))return fail('Choose equipment.');
  for(const key of ['primaryMuscles','secondaryMuscles']) {
    if(!Array.isArray(value[key])||value[key].some(m=>!MUSCLE_GROUPS.includes(m))||new Set(value[key]).size!==value[key].length)return fail('Choose valid, distinct muscles.');
  }
  if(!value.primaryMuscles.length)return fail('Choose at least one primary muscle.');
  if(value.primaryMuscles.some(m=>value.secondaryMuscles.includes(m)))return fail('A muscle cannot be both primary and secondary.');
  return {entry:{name:value.name.trim(),equipment:value.equipment,primaryMuscles:MUSCLE_GROUPS.filter(m=>value.primaryMuscles.includes(m)),secondaryMuscles:MUSCLE_GROUPS.filter(m=>value.secondaryMuscles.includes(m))}};
}
export function searchCatalog(entries,query='',{equipment='',limit=8}={}) {
  const q=normalizeSearch(query),words=q.split(/\s+/).filter(Boolean);
  const rank=e=>normalizeSearch(e.name)===q?0:normalizeSearch(e.name).startsWith(q)?1:2;
  return entries.filter(e=>!e.archived&&(!equipment||e.equipment===equipment)&&words.every(word=>normalizeSearch([e.name,e.familyName,e.equipment].join(' ')).includes(word)))
    .sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,limit);
}
export function snapshotExercise(exercise,entry) {
  return {...exercise,name:entry.name,primaryMuscles:[...entry.primaryMuscles],secondaryMuscles:[...entry.secondaryMuscles],catalogId:entry.id,catalogRevision:entry.revision,familyId:entry.familyId,equipment:entry.equipment};
}
export function unlinkExercise({catalogId,catalogRevision,familyId,equipment,...exercise}) {return exercise;}
