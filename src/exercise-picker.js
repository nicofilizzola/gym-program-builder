import {renderVariantMetadata} from './catalog-metadata.js';
import {EQUIPMENT} from './catalog.js';
import {groupCatalog,flattenVariantOptions} from './catalog-groups.js';
import {openCatalogForm} from './catalog-form.js';
import {getCatalogStore} from './catalog-store.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
export function mountExercisePicker(host,{api,exercise,onSelect,onView,legacy=false,showLinkedName=true}){
 const store=getCatalogStore(api),id='exercise-options-'+crypto.randomUUID();
 let disposed=false,open=false,active=-1,matches=[],form,editing=!exercise.catalogId&&!legacy,announcementTimer;
 let renderedQuery='';
 const popup=document.createElement('div');popup.className='exercise-options';popup.setAttribute('popover','manual');
 popup.innerHTML='<label class="field">Filter equipment<select aria-label="Filter equipment"><option value="">All equipment</option></select></label><p class="error" role="alert"></p><button type="button" class="secondary-btn" data-retry hidden>Retry catalog</button><div role="listbox" aria-label="Exercise suggestions"></div><button type="button" class="secondary-btn" data-create>New variant</button>';
 const list=popup.querySelector('[role=listbox]');list.id=id;
 const filter=popup.querySelector('select'),error=popup.querySelector('.error'),retry=popup.querySelector('[data-retry]');
 for(const value of EQUIPMENT)filter.add(new Option(value,value));
 document.body.append(popup);
 host.innerHTML='<div data-definition><div class="exercise-definition-head"><strong class="linked-exercise-name"></strong><div class="exercise-definition-actions"></div></div><p class="catalog-meta" data-meta></p></div><div data-custom><span class="catalog-meta">Custom exercise</span><button type="button" class="secondary-btn" data-link>Link to catalog</button></div><label class="field" data-search>Exercise<input type="text" role="combobox" aria-label="Exercise" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="Search exercises"></label><p class="visually-hidden" role="status" data-announcement></p>';
 const input=host.querySelector('input'),strip=host.querySelector('.exercise-definition-actions');
 const tooltips=mountActionTooltips(host);
 function action(key,label,icon,activate){
  const button=document.createElement('button');button.type='button';button.className='action-button';button.dataset.exerciseAction=key;button.setAttribute('aria-label',label);button.dataset.actionTooltip=label;button.innerHTML=actionIcon(icon);button.onclick=activate;strip.append(button);return button;
 }
 const actions=action('replace','Replace exercise','move',()=>{hide();editing=true;display();input.value='';input.focus();show();});
 const clone=action('variant','Create variant','duplicate',()=>{if(((e)=>e?.referenceArchived||e?.equipmentConfigured===false)(store.value?.entries.find(e=>e.id===exercise.catalogId)))return;create('variant');});
 action('catalog','View in catalog','catalog',()=>{hide();onView?.();});
 // Keep the filter in document order beside the combobox, even though suggestions use the top layer.
 const equipmentLabel=filter.closest('label');
 host.querySelector('[data-search]').after(equipmentLabel);
 const pickerActions=document.createElement('div');pickerActions.className='picker-creation-actions';equipmentLabel.after(pickerActions);
 const newExercise=popup.querySelector('[data-create]');pickerActions.append(newExercise);
 const cancelSelection=document.createElement('button');cancelSelection.type='button';cancelSelection.className='secondary-btn';cancelSelection.textContent='Cancel selection';pickerActions.append(cancelSelection);
 cancelSelection.onclick=()=>{hide();editing=false;display();(exercise.catalogId?actions:host.querySelector('[data-link]')).focus();};
 filter.onfocus=()=>{show();};
 input.setAttribute('aria-controls',id);
 function display(){
  host.querySelector('[data-definition]').hidden=!exercise.catalogId||editing;host.querySelector('[data-custom]').hidden=!legacy||editing;
  host.querySelector('[data-search]').hidden=!editing;
  equipmentLabel.hidden=!editing;
  pickerActions.hidden=!editing;
  cancelSelection.hidden=!editing||!(exercise.catalogId||legacy);
  host.querySelector('.linked-exercise-name').textContent=exercise.name;
  host.querySelector('.linked-exercise-name').hidden=!showLinkedName;
  const current=store.value?.entries.find(e=>e.id===exercise.catalogId);
  host.querySelector('[data-meta]').textContent=[current?.familyName,current?.archived?'Archived':null].filter(Boolean).join(' · ');
  const restricted=String(Boolean(current?.referenceArchived||current?.equipmentConfigured===false));
  if(clone.getAttribute('aria-disabled')!==restricted)tooltips.hide();
  clone.setAttribute('aria-disabled',restricted);
  clone.dataset.actionTooltip=current?.referenceArchived?'Restore the reference exercise before creating a variant.':current?.equipmentConfigured===false?'Set equipment on the reference exercise before creating a variant.':'Create variant';
 }
 function position(el,anchor){
  if(!el.matches(':popover-open'))return;
  const view=window.visualViewport,r=anchor.getBoundingClientRect(),viewportTop=view?.offsetTop||0,bottom=viewportTop+(view?.height||innerHeight),width=Math.min(520,innerWidth-16);
  const navigationBottom=Math.max(0,...[...document.querySelectorAll('.app-header,.program-context,.breadcrumbs')].map(el=>el.getBoundingClientRect().bottom));
  const top=Math.max(viewportTop,Math.min(navigationBottom,bottom-100));
  el.style.width=width+'px';el.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
  const below=bottom-r.bottom-12,above=r.top-top-12,useBelow=below>=Math.min(360,above),space=useBelow?below:above;
  el.style.maxHeight=Math.max(80,space)+'px';el.style.top=(useBelow?r.bottom+4:Math.max(top+8,r.top-el.getBoundingClientRect().height-4))+'px';
 }
 function close(){
  open=false;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
  if(popup.matches(':popover-open'))popup.hidePopover();
 }
 function hide(){close();tooltips.hide();}
 function announce(){clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>{if(!disposed)host.querySelector('[data-announcement]').textContent=matches.length+' variants. Use arrow keys to choose a variant.';},150);}
 const optionId=entry=>id+'-variant-'+encodeURIComponent(entry.id);
 function updateActive(){
  const selected=matches[active];
  for(const option of list.querySelectorAll('[role="option"]'))option.setAttribute('aria-selected',String(option.id===(selected?optionId(selected):'')));
  if(selected)input.setAttribute('aria-activedescendant',optionId(selected));else input.removeAttribute('aria-activedescendant');
 }
 function render(){
  if(disposed)return;
  const query=input.value+'\0'+filter.value,previous=query===renderedQuery?matches[active]?.id:null;renderedQuery=query;
  const groups=groupCatalog(store.value||{entries:[],families:[]},input.value,{equipment:filter.value,mode:'picker',limit:8});
  matches=flattenVariantOptions(groups);active=previous?matches.findIndex(e=>e.id===previous):-1;list.replaceChildren();
  if(!store.value){const p=document.createElement('p');p.textContent=error.textContent?'Catalog unavailable. Retry or create a variant.':'Loading variants…';list.append(p);}
  else if(!matches.length){const p=document.createElement('p');p.textContent='No matching variants.';list.append(p);}
  groups.forEach((group,index)=>{
   const section=document.createElement('div');section.className='exercise-option-group';section.setAttribute('role','group');
   const heading=document.createElement('div');heading.className='exercise-option-reference';heading.id=id+'-reference-'+index;heading.textContent=group.reference.name;section.setAttribute('aria-labelledby',heading.id);section.append(heading);
   for(const entry of group.variants){
    const option=document.createElement('div');option.className='exercise-option';option.id=optionId(entry);option.setAttribute('role','option');
    const name=document.createElement('strong');name.textContent=entry.name;
    const meta=document.createElement('span');meta.className='catalog-meta';renderVariantMetadata(meta,entry);
    const mapping=document.createElement('span');mapping.className='catalog-mapping';mapping.textContent='Primary: '+entry.primaryMuscles.join(', ')+' · Secondary: '+(entry.secondaryMuscles.join(', ')||'None');
    option.append(name,meta,mapping);option.onpointerdown=event=>event.preventDefault();option.onclick=()=>select(entry);section.append(option);
   }
   list.append(section);
  });updateActive();announce();if(open)position(popup,host);
 }
 async function load(force=false){
  retry.hidden=true;error.textContent='';
  try{await store.load(force);if(disposed)return;display();render();}
  catch(e){if(disposed)return;error.textContent=(store.value?'Using the last loaded catalog. ':'')+e.message;retry.hidden=false;render();}
 }
 function show(){
  if(disposed||!editing)return;tooltips.hide();if(!open){popup.showPopover();open=true;input.setAttribute('aria-expanded','true');}render();load();
 }
 function select(entry,{created=false}={}){
  const replacing=Boolean(exercise.catalogId||legacy);
  if(replacing&&!created&&!confirm('Use '+entry.name+' instead of '+exercise.name+'?\nPrimary: '+exercise.primaryMuscles.join(', ')+' → '+entry.primaryMuscles.join(', ')+'\nSecondary: '+exercise.secondaryMuscles.join(', ')+' → '+entry.secondaryMuscles.join(', ')+'\nSets and reps stay unchanged.'))return;
  hide();onSelect(entry);editing=false;
 }
 function create(mode){
  hide();
  const current=store.value?.entries.find(e=>e.id===exercise.catalogId);
  if(mode==='variant'&&!current){error.textContent='Refresh the catalog before creating a variant.';editing=true;display();show();return;}
  form?.destroy();form=openCatalogForm({api,mode,entry:mode==='variant'?current:legacy?exercise:undefined,families:store.value?.families||[],tags:store.value?.tags||[],initialName:input.value,onSaved:async entry=>{await load(true);if(!disposed)select(entry,{created:true});}});
 }
 host.querySelector('[data-link]').onclick=()=>{editing=true;display();input.value=exercise.name;input.focus();show();};
 newExercise.onclick=()=>create('create');
 retry.onclick=()=>load(true);filter.onchange=render;
 input.onfocus=show;
 input.oninput=event=>{if(!event.isComposing)show();};
 input.oncompositionend=show;
 input.onkeydown=event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();if(open)close();else if(exercise.catalogId||legacy){editing=false;display();(exercise.catalogId?actions:host.querySelector('[data-link]')).focus();}}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(!open)show();if(!matches.length)return;
   const step=event.key==='ArrowDown'?1:-1;active=active<0?(step>0?0:matches.length-1):(active+step+matches.length)%matches.length;
   updateActive();document.getElementById(optionId(matches[active])).scrollIntoView({block:'nearest'});
  }
  if(event.key==='Enter'&&open){event.preventDefault();if(active>=0)select(matches[active]);}
  if(event.key==='Tab')close();
 };
 const outside=event=>{if(!host.contains(event.target)&&!popup.contains(event.target))hide();};
 const key=event=>{if(event.key==='Escape')close();};
 const scrolling=event=>{if(!popup.contains(event.target)){if(open)position(popup,host);}};
 const focus=()=>load(true),resize=()=>hide();
 document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',key);document.addEventListener('scroll',scrolling,true);window.addEventListener('resize',resize);window.addEventListener('focus',focus);
 display();load();
 return {close:hide,update:display,refresh:()=>load(true),destroy(){disposed=true;hide();clearTimeout(announcementTimer);form?.destroy();popup.remove();tooltips.destroy();document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',key);document.removeEventListener('scroll',scrolling,true);window.removeEventListener('resize',resize);window.removeEventListener('focus',focus);}};
}
