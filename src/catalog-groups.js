import {normalizeSearch,catalogSearchText} from './catalog.js';
const nameOrder=(a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
export const flattenVariantOptions=groups=>groups.flatMap(group=>group.variants);
export function groupCatalog({entries,families},query='',{equipment='',primaryMuscle='',secondaryMuscle='',exerciseType='',showArchived=false,mode='catalog',limit=8}={}){
 const q=normalizeSearch(query),words=q.split(/\s+/).filter(Boolean),picker=mode==='picker';
 const rank=e=>!q?0:normalizeSearch(e.name)===q?0:normalizeSearch(e.name).startsWith(q)?1:2;
 const variantOrder=(a,b)=>rank(a)-rank(b)||nameOrder(a,b);
 const groups=families.map(reference=>{
  const children=entries.filter(e=>e.familyId===reference.id).map(e=>({...e,familyName:reference.name,archived:Boolean(reference.archived||(e.individuallyArchived??e.archived))}));
  const variants=children.filter(e=>(!e.archived||(!picker&&showArchived))&&(!picker||e.equipmentConfigured!==false)&&(!equipment||e.equipment===equipment)&&(!primaryMuscle||e.primaryMuscles?.includes(primaryMuscle))&&(!secondaryMuscle||e.secondaryMuscles?.includes(secondaryMuscle))&&(!exerciseType||reference.exerciseType===exerciseType)&&words.every(w=>catalogSearchText(e,reference).includes(w))).sort(picker?variantOrder:nameOrder);
  return {reference,variants,activeCount:children.filter(e=>!e.archived).length,archivedCount:children.filter(e=>e.archived).length,childCount:children.length};
 }).filter(g=>(!g.reference.archived||(!picker&&showArchived))&&(g.variants.length||(!picker&&!equipment&&!primaryMuscle&&!secondaryMuscle&&(!exerciseType||g.reference.exerciseType===exerciseType)&&(!g.childCount||g.activeCount===0)&&words.every(w=>normalizeSearch(g.reference.name).includes(w)))));
 if(picker){
  const selected=new Set(groups.flatMap(g=>g.variants).sort(q?variantOrder:(a,b)=>nameOrder(families.find(r=>r.id===a.familyId),families.find(r=>r.id===b.familyId))||nameOrder(a,b)).slice(0,limit).map(e=>e.id));
  for(const g of groups)g.variants=g.variants.filter(e=>selected.has(e.id));
  return groups.filter(g=>g.variants.length).sort((a,b)=>(q?rank(a.variants[0])-rank(b.variants[0]):0)||nameOrder(a.reference,b.reference));
 }
 return groups.sort((a,b)=>nameOrder(a.reference,b.reference));
}
