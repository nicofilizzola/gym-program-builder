import {MUSCLE_GROUPS} from './muscles.js';
import {renderVariantMetadata} from './catalog-metadata.js';
import {EQUIPMENT} from './catalog.js';
import {groupCatalog,flattenVariantOptions} from './catalog-groups.js';
import {openCatalogForm} from './catalog-form.js';
import {openReferenceForm,openReferenceArchive,openVariantMove} from './reference-form.js';
import {invalidateCatalog} from './catalog-store.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
export function mountCatalog(root,{api,initialData,target,onNavigate,navigationState=null,onTargetChange=()=>{},loadCatalog=()=>api.catalog()}){
 root.innerHTML='<section class="catalog-page"><header class="catalog-header"><div><h1>Exercise catalog</h1><p class="catalog-intro">Reference exercises and their variants.</p></div><button class="add-btn" data-new>New reference exercise</button></header><div class="catalog-toolbar"><a class="secondary-btn manage-tags" href="#/catalog/tags">Manage tags</a><label class="field">Search catalog<input type="search" autocomplete="off" data-search></label><label class="field">Equipment<select data-equipment aria-label="Equipment"><option value="">All equipment</option></select></label><label class="field">Primary muscle<select data-primary-muscle aria-label="Primary muscle"><option value="">All primary muscles</option></select></label><label class="field">Secondary muscle<select data-secondary-muscle aria-label="Secondary muscle"><option value="">All secondary muscles</option></select></label><label class="field">Exercise type<select data-exercise-type aria-label="Exercise type"><option value="">All types</option><option value="compound">Compound</option><option value="isolation">Isolation</option></select></label><label class="catalog-archived"><input type="checkbox" data-archived>Show archived</label></div><p class="error" role="alert" data-error></p><button class="secondary-btn" data-retry hidden>Retry</button><p data-count role="status"></p><div class="catalog-list"></div></section>';
 let data=initialData||{entries:[],families:[]},targetResolved=false,lastTargetReference=null,disposed=false,form,retryAction,generation=0,filterKey='',searchExpanded=new Set(),searchSeen=new Set();
 const expanded=new Set(),list=root.querySelector('.catalog-list'),error=root.querySelector('[data-error]'),retry=root.querySelector('[data-retry]'),search=root.querySelector('[data-search]'),equipment=root.querySelector('[data-equipment]'),archived=root.querySelector('[data-archived]');
 const primaryMuscle=root.querySelector('[data-primary-muscle]'),secondaryMuscle=root.querySelector('[data-secondary-muscle]'),exerciseType=root.querySelector('[data-exercise-type]');
 for(const muscle of MUSCLE_GROUPS){primaryMuscle.add(new Option(muscle,muscle));secondaryMuscle.add(new Option(muscle,muscle));}
 const tooltips=mountActionTooltips(root);
 for(const e of EQUIPMENT)equipment.add(new Option(e,e));
 if(navigationState){
  search.value=navigationState.query||'';archived.checked=Boolean(navigationState.showArchived);
  for(const [key,control] of Object.entries({equipment,primaryMuscle,secondaryMuscle,exerciseType})){
   const value=navigationState[key];control.value=[...control.options].some(o=>o.value===value)?value:'';
  }
  for(const id of navigationState.expanded||[])expanded.add(id);
  searchExpanded=new Set(navigationState.searchExpanded||[]);searchSeen=new Set(navigationState.searchSeen||[]);filterKey=navigationState.filterKey||'';
 }
 const action=(label,fn)=>{const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent=label;button.onclick=fn;return button;};
 function iconAction({action:key,label,tooltip,icon,onActivate,disabledReason}){
  const b=document.createElement('button');b.type='button';b.className='action-button';b.dataset.catalogAction=key;b.setAttribute('aria-label',label);b.innerHTML=actionIcon(icon);
  b.dataset.actionTooltip=disabledReason||tooltip;
  if(disabledReason)b.setAttribute('aria-disabled','true');
  b.onclick=()=>{if(disabledReason)return;tooltips.hide();onActivate();};return b;
 }
 function report(e,fn){if(disposed)return;error.textContent=e.message;retryAction=fn;retry.hidden=false;}
 retry.onclick=()=>{error.textContent='';retry.hidden=true;retryAction?.();};
 let queuedData=null,composing=false;
 const isEditing=()=>Boolean(document.querySelector('dialog[open]'))||composing;
 function setData(next){if(!next||disposed)return;if(isEditing()){queuedData=next;return;}const focused=document.activeElement,id=focused?.closest('[data-reference]')?.dataset.reference,variant=focused?.closest('[data-variant]')?.dataset.variant,key=focused?.dataset.catalogAction,toggle=focused?.classList.contains('reference-toggle');data=next;render();if(list.contains(focused)||id){const group=findReference(id),row=variant?group?.querySelector('[data-variant="'+CSS.escape(variant)+'"]'):group;const control=toggle?group?.querySelector('.reference-toggle'):row?.querySelector('[data-catalog-action="'+CSS.escape(key||'')+'"]');(control||search).focus({preventScroll:true});}}
 function flushPending(){if(queuedData&&!isEditing()){const next=queuedData;queuedData=null;setData(next);}}
 const updates=new AbortController();document.addEventListener('close',()=>queueMicrotask(flushPending),{capture:true,signal:updates.signal});
 root.addEventListener('compositionstart',()=>composing=true,{signal:updates.signal});root.addEventListener('compositionend',()=>{composing=false;flushPending();},{signal:updates.signal});
 async function load(){const reading=++generation;invalidateCatalog(api);try{const next=await loadCatalog();if(!next||disposed||reading!==generation)return;queuedData=null;data=next;error.textContent='';retry.hidden=true;render();}catch(e){report(e,load);}}
 function findReference(id){return [...list.querySelectorAll('.reference-group')].find(row=>row.dataset.reference===id);}
 function focusVisible(button){
  button.focus({preventScroll:true});
  const r=button.getBoundingClientRect();
  if(r.top<8||r.bottom>innerHeight-8||r.left<8||r.right>innerWidth-8)button.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
 }
 function focusReference(id,key='toggle'){
  if(disposed)return;const group=findReference(id),button=key==='toggle'?group?.querySelector('.reference-toggle'):group?.querySelector('[data-catalog-action="'+key+'"]');
  focusVisible(button||group?.querySelector('.reference-toggle')||search);
 }
 function focusVariant(id,key='edit',referenceId){
  if(disposed)return;const row=[...list.querySelectorAll('.catalog-row')].find(row=>row.dataset.variant===id&&!row.closest('[hidden],[inert]'));
  if(row)focusVisible(row.querySelector('[data-catalog-action="'+key+'"]'));else if(referenceId)focusReference(referenceId);else focusVisible(search);
 }
 function setReferenceExpanded(section,opened,{animate=false}={}){
  const toggle=section.querySelector('.reference-toggle'),body=section.querySelector('.reference-variants');
  tooltips.hide();if(!opened&&body.contains(document.activeElement))focusVisible(toggle);
  section.toggleAttribute('data-motion',animate);toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',(opened?'Collapse':'Expand')+' reference exercise '+toggle.querySelector('.reference-name').textContent);
  body.classList.toggle('is-open',opened);body.inert=!opened;body.setAttribute('aria-hidden',String(!opened));
 }
 function expand(id){expanded.add(id);searchExpanded.add(id);}
 function referenceForm(reference){
  tooltips.hide();let savedId=reference?.id;
  form?.destroy();form=openReferenceForm({api,reference,onSaved:async saved=>{savedId=saved.id;await load();},onClosed:()=>{if(disposed)return;if(savedId)focusReference(savedId,reference?'rename':'toggle');else root.querySelector('[data-new]').focus();}});
 }
 function referenceArchive(reference){
  tooltips.hide();form?.destroy();form=openReferenceArchive({api,reference,entries:data.entries,onSaved:load,onClosed:()=>focusReference(reference.id,'archive')});
 }
 function variantForm(entry,mode,reference){
  tooltips.hide();let savedId,sourceKey=mode==='variant'?'create':'edit';
  form?.destroy();form=openCatalogForm({api,entry,mode,families:data.families,tags:data.tags||[],referenceId:reference?.id,referenceRevision:reference?.revision,onSaved:async saved=>{savedId=saved.id;expand(saved.familyId);await load();},onClosed:()=>{if(savedId)focusVariant(savedId);else if(entry)focusVariant(entry.id,sourceKey,entry.familyId);else if(reference)focusReference(reference.id,'add');}});
 }
 function move(entry){
  tooltips.hide();form?.destroy();form=openVariantMove({api,entry,references:data.families,entries:data.entries,onSaved:async saved=>{expand(saved.familyId);await load();},onClosed:()=>focusVariant(entry.id,'move')});
 }
 async function archive(entry){try{await api.archiveCatalog({id:entry.id,revision:entry.revision,archived:!entry.individuallyArchived});await load();focusVariant(entry.id,'archive',entry.familyId);}catch(e){report(e,e.status===409?load:()=>archive(entry));}}
 function syncTarget(){
  if(!target)return;
  const variant=target.variantId?data.entries.find(e=>e.id===target.variantId):null,reference=data.families.find(r=>r.id===(variant?.familyId||target.referenceId));
  if(!reference)return;
  if(!targetResolved||lastTargetReference!==reference.id){expand(reference.id);if(reference.archived||variant?.archived)archived.checked=true;targetResolved=true;lastTargetReference=reference.id;}
  onTargetChange({reference,variant});
 }
 function focusTarget(){if(!target)return;if(target.variantId)focusVariant(target.variantId,'edit',lastTargetReference);else focusReference(lastTargetReference||target.referenceId);}
 function render(){
  syncTarget();
  tooltips.hide();list.replaceChildren();const filtering=Boolean(search.value.trim()||equipment.value||primaryMuscle.value||secondaryMuscle.value||exerciseType.value),nextKey=JSON.stringify([search.value,equipment.value,primaryMuscle.value,secondaryMuscle.value,exerciseType.value]);
  const groups=groupCatalog(data,search.value,{equipment:equipment.value,primaryMuscle:primaryMuscle.value,secondaryMuscle:secondaryMuscle.value,exerciseType:exerciseType.value,showArchived:archived.checked});
  if(filtering){
   if(filterKey!==nextKey){searchExpanded=new Set();searchSeen=new Set();}
   // A filter can be entered before load finishes. Expand newly arriving matches,
   // while retaining deliberate toggles for groups already shown by this search.
   for(const group of groups)if(!searchSeen.has(group.reference.id)){searchSeen.add(group.reference.id);searchExpanded.add(group.reference.id);}
  }else searchSeen.clear();
  filterKey=filtering?nextKey:'';
  const variantCount=flattenVariantOptions(groups).length;
  root.querySelector('[data-count]').textContent=groups.length+' reference exercise'+(groups.length===1?'':'s')+' \u00b7 '+variantCount+' variant'+(variantCount===1?'':'s');
  if(!groups.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching reference exercises or variants.';list.append(empty);}
  groups.forEach(group=>{
   const ref=group.reference,opened=(filtering?searchExpanded:expanded).has(ref.id),section=document.createElement('section');section.className='reference-group';section.dataset.reference=ref.id;
   const header=document.createElement('div');header.className='reference-header';
   const heading=document.createElement('h2');heading.id='reference-heading-'+encodeURIComponent(ref.id);
   const toggle=action('',()=>{const state=filtering?searchExpanded:expanded;if(state.has(ref.id))state.delete(ref.id);else state.add(ref.id);setReferenceExpanded(section,state.has(ref.id),{animate:true});});toggle.className='reference-toggle';toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg><span class="reference-name"></span>';
   toggle.querySelector('span').textContent=ref.name;toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',(opened?'Collapse':'Expand')+' reference exercise '+ref.name);
   const body=document.createElement('div');body.className='reference-variants';body.id='reference-variants-'+encodeURIComponent(ref.id);toggle.setAttribute('aria-controls',body.id);
   const content=document.createElement('div');content.className='reference-variants-inner';body.append(content);
   heading.append(toggle);section.setAttribute('aria-labelledby',heading.id);
   const counts=document.createElement('span');counts.className='reference-count';counts.textContent=group.activeCount+' active variant'+(group.activeCount===1?'':'s')+' · '+(ref.exerciseType==='compound'?'Compound':ref.exerciseType==='isolation'?'Isolation':'Type not set')+(archived.checked?' \u00b7 '+group.archivedCount+' archived':'')+(ref.archived?' \u00b7 Archived':'')+(!ref.equipment?' \u00b7 Needs equipment':'');
   const controls=document.createElement('div');controls.className='reference-header-actions';
   controls.append(
    iconAction({action:'add',label:'Add variant to '+ref.name,tooltip:'Add variant',icon:'plus',onActivate:()=>variantForm(undefined,'create',ref),disabledReason:ref.archived?'Restore the reference exercise before adding a variant.':!ref.equipment?'Set equipment on the reference exercise before adding a variant.':undefined}),
    iconAction({action:'rename',label:'Edit reference exercise '+ref.name,tooltip:'Edit reference exercise',icon:'edit',onActivate:()=>referenceForm(ref)}),
    iconAction({action:'archive',label:(ref.archived?'Restore':'Archive')+' reference exercise '+ref.name,tooltip:(ref.archived?'Restore':'Archive')+' reference exercise',icon:ref.archived?'restore':'archive',onActivate:()=>referenceArchive(ref)})
   );header.append(heading,counts,controls);section.append(header,body);list.append(section);
   if(ref.archived){const hint=document.createElement('p');hint.className='catalog-meta reference-hint';hint.textContent='Restore this reference exercise to add or restore variants.';content.append(hint);}
   if(!group.variants.length){const empty=document.createElement('p');empty.className='reference-empty';empty.textContent=group.childCount?'No active variants.':'No variants yet.';content.append(empty);}
   for(const entry of group.variants){
    const row=document.createElement('article');row.className='catalog-row';row.dataset.variant=entry.id;
    const definition=document.createElement('div');definition.className='catalog-definition';const name=document.createElement('h3');name.textContent=entry.name;
    const meta=document.createElement('p');meta.className='catalog-meta';renderVariantMetadata(meta,entry);
    const state=document.createElement('span');state.className='variant-status';state.textContent=entry.individuallyArchived?' \u00b7 Archived individually':entry.referenceArchived?' \u00b7 Archived with reference':'';
    meta.append(state);const muscles=document.createElement('p');muscles.className='catalog-mapping';muscles.textContent='Primary: '+entry.primaryMuscles.join(', ')+' \u00b7 Secondary: '+(entry.secondaryMuscles.join(', ')||'None');definition.append(name,meta,muscles);
    const actions=document.createElement('div');actions.className='catalog-row-actions';
    actions.append(
     iconAction({action:'edit',label:'Edit variant '+entry.name,tooltip:'Edit variant',icon:'edit',onActivate:()=>variantForm(entry,'edit')}),
     iconAction({action:'create',label:'Create variant from '+entry.name,tooltip:'Create variant',icon:'duplicate',onActivate:()=>variantForm(entry,'variant'),disabledReason:entry.referenceArchived?'Restore the reference exercise before creating a variant.':entry.equipmentConfigured===false?'Set equipment on the reference exercise before creating a variant.':undefined}),
     iconAction({action:'move',label:'Move variant '+entry.name+' to reference exercise',tooltip:'Move to reference exercise',icon:'move',onActivate:()=>move(entry)}),
     iconAction({action:'archive',label:(entry.individuallyArchived?'Restore':'Archive')+' variant '+entry.name,tooltip:(entry.individuallyArchived?'Restore':'Archive')+' variant',icon:entry.individuallyArchived?'restore':'archive',onActivate:()=>archive(entry),disabledReason:entry.referenceArchived?'Restore the reference exercise before changing variant archive state.':undefined})
    );row.append(definition,actions);content.append(row);
   }
   setReferenceExpanded(section,opened);
  });
 }
 root.querySelector('[data-new]').onclick=()=>referenceForm();
 search.oninput=equipment.onchange=primaryMuscle.onchange=secondaryMuscle.onchange=exerciseType.onchange=archived.onchange=render;root.querySelector('[data-count]').textContent='Loading reference exercises\u2026';if(initialData)render();else load();
 return {focusTarget,setData,isEditing,getNavigationState:()=>({query:search.value,equipment:equipment.value,primaryMuscle:primaryMuscle.value,secondaryMuscle:secondaryMuscle.value,exerciseType:exerciseType.value,showArchived:archived.checked,expanded:[...expanded],searchExpanded:[...searchExpanded],searchSeen:[...searchSeen],filterKey}),destroy(){disposed=true;generation++;updates.abort();form?.destroy();tooltips.destroy();root.replaceChildren();}};
}
