import {EQUIPMENT,normalizeSearch} from './catalog.js';
import {openCatalogForm} from './catalog-form.js';
import {invalidateCatalog} from './catalog-store.js';
export function mountCatalog(root,{api}){
 root.innerHTML='<section class="catalog-page"><header class="catalog-header"><div><h1>Exercise catalog</h1><p class="catalog-intro">Reusable exercises and muscle mappings for your workouts.</p></div><button class="add-btn" data-new>New exercise</button></header><div class="catalog-toolbar"><label class="field">Search catalog<input type="search" autocomplete="off" data-search></label><label class="field">Equipment<select data-equipment><option value="">All equipment</option></select></label><label class="catalog-archived"><input type="checkbox" data-archived>Show archived</label></div><p class="error" role="alert" data-error></p><button class="secondary-btn" data-retry hidden>Retry</button><p data-count role="status"></p><div class="catalog-list"></div></section>';
 let data={entries:[],families:[]},disposed=false,form,retryAction;
 const list=root.querySelector('.catalog-list'),error=root.querySelector('[data-error]'),retry=root.querySelector('[data-retry]');
 const search=root.querySelector('[data-search]'),equipment=root.querySelector('[data-equipment]'),archived=root.querySelector('[data-archived]');
 for(const e of EQUIPMENT)equipment.add(new Option(e,e));
 function report(e,action){if(disposed)return;error.textContent=e.message;retryAction=action;retry.hidden=false;}
 retry.onclick=()=>{error.textContent='';retry.hidden=true;retryAction?.();};
 async function load(){invalidateCatalog(api);try{const next=await api.catalog();if(disposed)return;data=next;render();}catch(e){report(e,load);}}
 const action=(label,fn)=>{const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent=label;button.onclick=fn;return button;};
 function open(entry,mode){form?.destroy();form=openCatalogForm({api,entry,mode,families:data.families,onSaved:load});}
 async function archive(entry){
  try{await api.archiveCatalog({id:entry.id,revision:entry.revision,archived:!entry.archived});await load();}
  catch(e){report(e,e.status===409?load:()=>archive(entry));}
 }
 function rename(family){
  const dialog=document.createElement('dialog');dialog.className='catalog-dialog';dialog.setAttribute('aria-label','Rename family');
  dialog.innerHTML='<form><h2>Rename family</h2><label class="field">Family name<input type="text" maxlength="200" required></label><p class="error" role="alert"></p><div class="catalog-form-actions"><button type="button" class="secondary-btn">Cancel</button><button class="add-btn">Save family name</button></div></form>';
  document.body.append(dialog);const input=dialog.querySelector('input');input.value=family.name;
  const close=()=>{dialog.close();dialog.remove();};form={destroy:close};dialog.querySelector('[type=button]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const submit=dialog.querySelector('.add-btn');submit.disabled=true;try{await api.renameFamily({id:family.id,revision:family.revision,name:input.value});await load();close();}catch(e){dialog.querySelector('.error').textContent=e.message;if(e.status===409){const reload=action('Reload saved version',async()=>{try{await load();const fresh=data.families.find(f=>f.id===family.id);family=fresh;input.value=fresh.name;reload.remove();dialog.querySelector('.error').textContent='';}catch(err){dialog.querySelector('.error').textContent=err.message;}});dialog.querySelector('form').append(reload);}}finally{submit.disabled=false;}};
  dialog.showModal();input.focus();
 }
 function render(){
  list.replaceChildren();const words=normalizeSearch(search.value).split(/\s+/).filter(Boolean);
  const entries=data.entries.filter(e=>(archived.checked||!e.archived)&&(!equipment.value||e.equipment===equipment.value)&&words.every(w=>normalizeSearch([e.name,e.familyName,e.equipment].join(' ')).includes(w))).sort((a,b)=>a.name.localeCompare(b.name));
  root.querySelector('[data-count]').textContent=entries.length+' exercise'+(entries.length===1?'':'s');
  if(!entries.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching exercises. Try another search or create an exercise.';list.append(empty);}
  for(const entry of entries){
   const row=document.createElement('article');row.className='catalog-row';
   const description=document.createElement('div');description.className='catalog-definition';
   const name=document.createElement('h2');name.textContent=entry.name;description.append(name);
   const meta=document.createElement('p');meta.className='catalog-meta';meta.textContent=entry.familyName+' · '+entry.equipment+(entry.archived?' · Archived':'');description.append(meta);
   const muscles=document.createElement('p');muscles.className='catalog-mapping';muscles.textContent='Primary: '+entry.primaryMuscles.join(', ')+' · Secondary: '+(entry.secondaryMuscles.join(', ')||'None');description.append(muscles);
   const actions=document.createElement('div');actions.className='catalog-row-actions';
   actions.append(action('Edit exercise',()=>open(entry,'edit')),action('Create variant',()=>open(entry,'variant')),action('Rename family',()=>rename(data.families.find(f=>f.id===entry.familyId))),action(entry.archived?'Restore':'Archive',()=>archive(entry)));
   row.append(description,actions);list.append(row);
  }
 }
 root.querySelector('[data-new]').onclick=()=>open(undefined,'create');
 search.oninput=equipment.onchange=archived.onchange=render;
 root.querySelector('[data-count]').textContent='Loading catalog…';load();
 return {destroy(){disposed=true;form?.destroy();root.replaceChildren();}};
}
