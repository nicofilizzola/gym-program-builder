import {actionIcon,mountActionTooltips} from './action-controls.js';
import {invalidateCatalog} from './catalog-store.js';
import {mountDialogMotion} from './dialog-motion.js';
import {createViewTransition} from './view-transition.js';
import {normalizeSearch} from './catalog.js';

export function mountTagView(root,{api,kind='brand',query='',onNavigate=()=>{}}){
 const type=kind==='brand'?'Brand':'Focus';
 root.innerHTML='<section class="catalog-page tag-page"><header class="catalog-header"><h1>Tags</h1><nav class="tag-kinds" aria-label="Tag type"><a class="secondary-btn" data-kind="brand">Brand</a><a class="secondary-btn" data-kind="focus">Focus</a></nav></header><div class="catalog-toolbar"><label class="field">Search tags<input type="search" name="tagSearch" autocomplete="off" data-search></label><label class="catalog-archived"><input type="checkbox" data-archived>Show archived</label></div><form class="tag-create"><label class="field"><span data-create-label></span><input type="text" name="tagName" maxlength="80" required autocomplete="off" data-name></label><button class="add-btn" type="submit"></button></form><p class="error" role="alert" data-error></p><button type="button" class="secondary-btn" data-retry hidden>Retry</button><p class="catalog-meta" role="status" data-count></p><div class="tag-list"></div></section>';
 let data=[],disposed=false,generation=0,retryAction,dialogController,createRequest;
 const list=root.querySelector('.tag-list'),search=root.querySelector('[data-search]'),archived=root.querySelector('[data-archived]'),error=root.querySelector('[data-error]'),retry=root.querySelector('[data-retry]'),name=root.querySelector('[data-name]'),createButton=root.querySelector('.tag-create button');
 search.value=query;root.querySelector('[data-create-label]').textContent='New '+type+' tag';createButton.textContent='Create '+type;
 const tooltips=mountActionTooltips(root),transition=createViewTransition(list);
 for(const link of root.querySelectorAll('[data-kind]')){link.href='#/catalog/tags?'+new URLSearchParams({kind:link.dataset.kind,q:query});if(link.dataset.kind===kind)link.setAttribute('aria-current','page');link.onclick=e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey){e.preventDefault();onNavigate({kind:link.dataset.kind,query:search.value});}};}
 function report(e,action){if(disposed)return;error.textContent=e.message;retryAction=action;retry.hidden=!action;}
 retry.onclick=()=>{error.textContent='';retry.hidden=true;retryAction?.();};
 function focusRow(id,action='rename'){const button=list.querySelector('[data-tag="'+CSS.escape(id)+'"] [data-action="'+action+'"]');(button||name).focus({preventScroll:true});}
 async function load({animate=false,focusId,focusAction}={}){
  const reading=++generation;
  try{const next=await api.listTags();if(disposed||reading!==generation)return;data=next;error.textContent='';retry.hidden=true;if(animate)await transition.swap(render);else render();if(!disposed&&reading===generation&&focusId)focusRow(focusId,focusAction);}catch(e){report(e,()=>load());}
 }
 function render(){
  tooltips.hide();list.replaceChildren();const words=normalizeSearch(search.value).split(/\s+/).filter(Boolean),tags=data.filter(t=>t.kind===kind&&(archived.checked||!t.archived)&&words.every(w=>normalizeSearch(t.name).includes(w)));
  root.querySelector('[data-count]').textContent=tags.length+' '+type+' tag'+(tags.length===1?'':'s');
  if(!tags.length){const p=document.createElement('p');p.className='empty';p.textContent='No matching '+type+' tags.';list.append(p);}
  for(const tag of tags){
   const row=document.createElement('article');row.className='tag-row';row.dataset.tag=tag.id;const label=document.createElement('span');label.className='tag-name';label.textContent=tag.name;row.append(label);
   if(tag.archived){const state=document.createElement('span');state.className='catalog-meta';state.textContent='Archived';row.append(state);}
   const actions=document.createElement('div');actions.className='catalog-row-actions';
   for(const [key,verb,icon,activate]of [['rename','Rename','edit',()=>rename(tag)],['archive',tag.archived?'Restore':'Archive',tag.archived?'restore':'archive',()=>archive(tag)]]){
    const button=document.createElement('button');button.type='button';button.className='action-button';button.dataset.action=key;button.setAttribute('aria-label',verb+' '+type+' '+tag.name);button.dataset.actionTooltip=verb+' '+type;button.innerHTML=actionIcon(icon);button.onclick=activate;actions.append(button);
   }
   row.append(actions);list.append(row);
  }
 }
 async function archive(tag){try{await api.archiveTag({id:tag.id,revision:tag.revision,archived:!tag.archived});invalidateCatalog(api);await load({animate:true,focusId:tag.id,focusAction:'archive'});}catch(e){report(e,()=>load());}}
 function rename(tag){
  tooltips.hide();dialogController?.destroy();const dialog=document.createElement('dialog');dialog.className='catalog-dialog';const titleId='tag-title-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',titleId);
  dialog.innerHTML='<form><h2>Rename '+type+'</h2><label class="field">Tag name<input type="text" name="tagName" maxlength="80" required autocomplete="off"></label><p class="error" role="alert"></p><div data-recovery></div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-cancel>Cancel</button><button class="add-btn" type="submit">Save tag</button></div></form>';
  dialog.querySelector('h2').id=titleId;document.body.append(dialog);const form=dialog.querySelector('form'),input=form.elements.tagName,save=form.querySelector('[type=submit]'),localError=form.querySelector('.error');let current=tag,busy=false,closed=false;input.value=tag.name;
  const motion=mountDialogMotion(dialog,{onClosed:()=>{if(!disposed)focusRow(tag.id);}}),close=()=>{if(busy||closed)return;closed=true;motion.close();};
  form.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}};
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;save.disabled=true;input.disabled=true;form.querySelector('[data-cancel]').disabled=true;localError.textContent='';form.querySelector('[data-recovery]').replaceChildren();try{await api.updateTag({id:current.id,revision:current.revision,name:input.value});invalidateCatalog(api);if(!closed){await load();busy=false;close();}}catch(e){if(!closed){localError.textContent=e.message;if(e.status===409){const reload=document.createElement('button');reload.type='button';reload.className='secondary-btn';reload.textContent='Reload saved version';reload.onclick=async()=>{try{const tags=await api.listTags();if(closed)return;current=tags.find(t=>t.id===tag.id);if(!current)throw Error('Tag no longer exists.');input.value=current.name;localError.textContent='';reload.remove();}catch(e){localError.textContent=e.message;}};form.querySelector('[data-recovery]').append(reload);}}}finally{busy=false;if(!closed){save.disabled=false;input.disabled=false;form.querySelector('[data-cancel]').disabled=false;}}};
  dialogController={destroy(){closed=true;motion.destroy();}};motion.open();input.focus();
 }
 root.querySelector('.tag-create').onsubmit=async e=>{
  e.preventDefault();if(createButton.disabled)return;createRequest??={id:crypto.randomUUID(),kind,name:name.value};createButton.disabled=true;
  try{const tag=await api.createTag(createRequest);if(disposed)return;if(name.value.trim()===createRequest.name.trim())name.value='';createRequest=null;invalidateCatalog(api);await load({animate:true,focusId:tag.id});}catch(e){if(e.status===400||e.status===409)createRequest=null;report(e,()=>root.querySelector('.tag-create').requestSubmit());}finally{if(!disposed)createButton.disabled=false;}
 };
 search.oninput=()=>{transition.cancel();render();onNavigate({kind,query:search.value,replace:true});};archived.onchange=()=>{transition.cancel();render();};
 root.querySelector('[data-count]').textContent='Loading tags…';load();
 return {destroy(){disposed=true;generation++;dialogController?.destroy();transition.destroy();tooltips.destroy();root.replaceChildren();}};
}
