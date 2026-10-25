import {EQUIPMENT} from './catalog.js';
import {groupCatalog,flattenVariantOptions} from './catalog-groups.js';
import {openCatalogForm} from './catalog-form.js';
import {openReferenceForm,openReferenceArchive,openVariantMove} from './reference-form.js';
import {invalidateCatalog} from './catalog-store.js';
export function mountCatalog(root,{api}){
 root.innerHTML='<section class="catalog-page"><header class="catalog-header"><div><h1>Exercise catalog</h1><p class="catalog-intro">Reference exercises and their variants.</p></div><button class="add-btn" data-new>New reference exercise</button></header><div class="catalog-toolbar"><label class="field">Search catalog<input type="search" autocomplete="off" data-search></label><label class="field">Equipment<select data-equipment aria-label="Equipment"><option value="">All equipment</option></select></label><label class="catalog-archived"><input type="checkbox" data-archived>Show archived</label></div><p class="error" role="alert" data-error></p><button class="secondary-btn" data-retry hidden>Retry</button><p data-count role="status"></p><div class="catalog-list"></div></section>';
 let data={entries:[],families:[]},disposed=false,form,retryAction,generation=0,filterKey='',searchExpanded=new Set(),menuAnchor=null;
 const expanded=new Set(),list=root.querySelector('.catalog-list'),error=root.querySelector('[data-error]'),retry=root.querySelector('[data-retry]'),search=root.querySelector('[data-search]'),equipment=root.querySelector('[data-equipment]'),archived=root.querySelector('[data-archived]');
 const menu=document.createElement('div');menu.className='exercise-options exercise-menu';menu.setAttribute('popover','manual');document.body.append(menu);
 for(const e of EQUIPMENT)equipment.add(new Option(e,e));
 const action=(label,fn)=>{const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent=label;button.onclick=fn;return button;};
 function closeMenu(focus=false){if(menu.matches(':popover-open'))menu.hidePopover();const anchor=menuAnchor;menuAnchor=null;anchor?.setAttribute('aria-expanded','false');if(focus&&anchor?.isConnected)anchor.focus();}
 function openMenu(anchor,items){
  if(menuAnchor===anchor){closeMenu(true);return;}closeMenu();menu.replaceChildren();menuAnchor=anchor;anchor.setAttribute('aria-expanded','true');
  for(const [label,fn,disabled=false] of items){const b=action(label,()=>{closeMenu();fn();});b.disabled=disabled;menu.append(b);}
  menu.showPopover();const r=anchor.getBoundingClientRect(),width=Math.min(300,innerWidth-16);menu.style.width=width+'px';menu.style.maxHeight=(innerHeight-16)+'px';menu.style.left=Math.max(8,Math.min(r.right-width,innerWidth-width-8))+'px';menu.style.top=(r.bottom+4+menu.offsetHeight<=innerHeight-8?r.bottom+4:Math.max(8,r.top-menu.offsetHeight-4))+'px';menu.querySelector('button:not(:disabled)')?.focus();
 }
 const outside=e=>{if(menuAnchor&&!menu.contains(e.target)&&!menuAnchor.contains(e.target))closeMenu();};
 const key=e=>{if(e.key==='Escape'&&menuAnchor){e.preventDefault();closeMenu(true);}};
 const resize=()=>closeMenu();
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',resize);
 function report(e,fn){if(disposed)return;error.textContent=e.message;retryAction=fn;retry.hidden=false;}
 retry.onclick=()=>{error.textContent='';retry.hidden=true;retryAction?.();};
 async function load(){const reading=++generation;invalidateCatalog(api);try{const next=await api.catalog();if(disposed||reading!==generation)return;data=next;error.textContent='';retry.hidden=true;render();}catch(e){report(e,load);}}
 function findReference(id){return [...list.querySelectorAll('.reference-group')].find(row=>row.dataset.reference===id);}
 function focusReference(id,kind='actions'){if(disposed)return;const group=findReference(id);const button=group?.querySelector(kind==='toggle'?'.reference-toggle':'.reference-actions');if(button)button.focus({preventScroll:true});else search.focus({preventScroll:true});}
 function focusVariant(id){if(disposed)return;const row=[...list.querySelectorAll('.catalog-row')].find(row=>row.dataset.variant===id&&!row.closest('[hidden]'));if(row)row.querySelector('button').focus({preventScroll:true});else search.focus({preventScroll:true});}
 function expand(id){expanded.add(id);searchExpanded.add(id);}
 function referenceForm(reference){
  let savedId=reference?.id;
  form?.destroy();form=openReferenceForm({api,reference,onSaved:async saved=>{savedId=saved.id;await load();},onClosed:()=>{if(disposed)return;if(savedId)focusReference(savedId,'toggle');else root.querySelector('[data-new]').focus();}});
 }
 function referenceArchive(reference){
  form?.destroy();form=openReferenceArchive({api,reference,entries:data.entries,onSaved:load,onClosed:()=>focusReference(reference.id)});
 }
 function variantForm(entry,mode,reference){
  let savedId=entry?.id;
  form?.destroy();form=openCatalogForm({api,entry,mode,families:data.families,referenceId:reference?.id,referenceRevision:reference?.revision,onSaved:async saved=>{savedId=saved.id;expand(saved.familyId);await load();},onClosed:()=>{if(savedId)focusVariant(savedId);else if(reference)focusReference(reference.id);}});
 }
 function move(entry){
  form?.destroy();form=openVariantMove({api,entry,references:data.families,entries:data.entries,onSaved:async saved=>{expand(saved.familyId);await load();},onClosed:()=>focusVariant(entry.id)});
 }
 async function archive(entry){try{await api.archiveCatalog({id:entry.id,revision:entry.revision,archived:!entry.individuallyArchived});await load();focusVariant(entry.id);}catch(e){report(e,e.status===409?load:()=>archive(entry));}}
 function render(){
  closeMenu();list.replaceChildren();const filtering=Boolean(search.value.trim()||equipment.value),nextKey=search.value+'\0'+equipment.value;
  const groups=groupCatalog(data,search.value,{equipment:equipment.value,showArchived:archived.checked});
  if(filtering&&filterKey!==nextKey)searchExpanded=new Set(groups.map(g=>g.reference.id));
  filterKey=filtering?nextKey:'';
  root.querySelector('[data-count]').textContent=groups.length+' reference exercise(s) ? '+flattenVariantOptions(groups).length+' variant(s)';
  if(!groups.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching reference exercises or variants.';list.append(empty);}
  groups.forEach((group,index)=>{
   const ref=group.reference,opened=(filtering?searchExpanded:expanded).has(ref.id),section=document.createElement('section');section.className='reference-group';section.dataset.reference=ref.id;
   const header=document.createElement('div');header.className='reference-header';
   const heading=document.createElement('h2');heading.id='reference-heading-'+index;
   const toggle=action('',()=>{const state=filtering?searchExpanded:expanded;if(state.has(ref.id))state.delete(ref.id);else state.add(ref.id);render();focusReference(ref.id,'toggle');});toggle.className='reference-toggle';toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg><span class="reference-name"></span>';
   toggle.querySelector('span').textContent=ref.name;toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',(opened?'Collapse':'Expand')+' reference exercise '+ref.name);
   const body=document.createElement('div');body.className='reference-variants';body.id='reference-variants-'+index;body.hidden=!opened;toggle.setAttribute('aria-controls',body.id);
   heading.append(toggle);section.setAttribute('aria-labelledby',heading.id);
   const counts=document.createElement('span');counts.className='reference-count';counts.textContent=group.activeCount+' active variant'+(group.activeCount===1?'':'s')+(archived.checked?' ? '+group.archivedCount+' archived':'')+(ref.archived?' ? Archived':'');
   const controls=document.createElement('div');controls.className='reference-header-actions';const add=action('Add variant',()=>variantForm(undefined,'create',ref));add.disabled=ref.archived;
   const actions=action('Reference actions',()=>openMenu(actions,[['Edit reference exercise',()=>referenceForm(ref)],[ref.archived?'Restore reference exercise':'Archive reference exercise',()=>referenceArchive(ref)]]));actions.classList.add('reference-actions');actions.setAttribute('aria-label','Reference actions for '+ref.name);actions.setAttribute('aria-expanded','false');
   controls.append(add,actions);header.append(heading,counts,controls);section.append(header,body);list.append(section);
   if(ref.archived){const hint=document.createElement('p');hint.className='catalog-meta reference-hint';hint.textContent='Restore this reference exercise to add or restore variants.';body.append(hint);}
   if(!group.variants.length){const empty=document.createElement('p');empty.className='reference-empty';empty.textContent=group.childCount?'No active variants.':'No variants yet.';body.append(empty);}
   for(const entry of group.variants){
    const row=document.createElement('article');row.className='catalog-row';row.dataset.variant=entry.id;
    const definition=document.createElement('div');definition.className='catalog-definition';const name=document.createElement('h3');name.textContent=entry.name;
    const meta=document.createElement('p');meta.className='catalog-meta';meta.textContent=entry.equipment;
    const state=document.createElement('span');state.className='variant-status';state.textContent=entry.individuallyArchived?' ? Archived individually':entry.referenceArchived?' ? Archived with reference':'';
    meta.append(state);const muscles=document.createElement('p');muscles.className='catalog-mapping';muscles.textContent='Primary: '+entry.primaryMuscles.join(', ')+' ? Secondary: '+(entry.secondaryMuscles.join(', ')||'None');definition.append(name,meta,muscles);
    const actions=action('Variant actions',()=>openMenu(actions,[['Edit variant',()=>variantForm(entry,'edit')],['Create variant',()=>variantForm(entry,'variant'),entry.referenceArchived],['Move to reference exercise',()=>move(entry)],[entry.individuallyArchived?'Restore variant':'Archive variant',()=>archive(entry),entry.referenceArchived]]));actions.setAttribute('aria-label','Variant actions for '+entry.name);actions.setAttribute('aria-expanded','false');row.append(definition,actions);body.append(row);
   }
  });
 }
 root.querySelector('[data-new]').onclick=()=>referenceForm();
 search.oninput=equipment.onchange=archived.onchange=render;root.querySelector('[data-count]').textContent='Loading reference exercises?';load();
 return {destroy(){disposed=true;generation++;form?.destroy();closeMenu();menu.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',resize);root.replaceChildren();}};
}
