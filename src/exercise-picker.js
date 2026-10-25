import {EQUIPMENT,searchCatalog} from './catalog.js';
import {openCatalogForm} from './catalog-form.js';
import {getCatalogStore} from './catalog-store.js';
export function mountExercisePicker(host,{api,exercise,onSelect,onView,legacy=false}){
 const store=getCatalogStore(api),id='exercise-options-'+crypto.randomUUID();
 let disposed=false,open=false,active=-1,matches=[],form,editing=!exercise.catalogId&&!legacy,menuOpen=false,announcementTimer;
 const popup=document.createElement('div');popup.className='exercise-options';popup.setAttribute('popover','manual');
 popup.innerHTML='<label class="field">Filter equipment<select aria-label="Filter equipment"><option value="">All equipment</option></select></label><p class="error" role="alert"></p><button type="button" class="secondary-btn" data-retry hidden>Retry catalog</button><div role="listbox" aria-label="Exercise suggestions"></div><button type="button" class="secondary-btn" data-create>New exercise</button>';
 const list=popup.querySelector('[role=listbox]');list.id=id;
 const filter=popup.querySelector('select'),error=popup.querySelector('.error'),retry=popup.querySelector('[data-retry]');
 for(const value of EQUIPMENT)filter.add(new Option(value,value));
 const menu=document.createElement('div');menu.className='exercise-options exercise-menu';menu.setAttribute('popover','manual');
 document.body.append(popup,menu);
 host.innerHTML='<div data-definition><div class="exercise-definition-head"><strong class="linked-exercise-name"></strong><button type="button" class="secondary-btn" aria-label="Exercise actions" aria-expanded="false">Actions</button></div><p class="catalog-meta" data-meta></p></div><div data-custom><span class="catalog-meta">Custom exercise</span><button type="button" class="secondary-btn" data-link>Link to catalog</button></div><label class="field" data-search>Exercise<input type="text" role="combobox" aria-label="Exercise" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="Search exercises"></label><p class="visually-hidden" role="status" data-announcement></p>';
 const input=host.querySelector('input'),actions=host.querySelector('[aria-label="Exercise actions"]');
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
  const current=store.value?.entries.find(e=>e.id===exercise.catalogId);
  host.querySelector('[data-meta]').textContent=[current?.familyName,exercise.equipment,current?.archived?'Archived':null].filter(Boolean).join(' · ');
 }
 function position(el,anchor){
  if(!el.matches(':popover-open'))return;
  const view=window.visualViewport,r=anchor.getBoundingClientRect(),viewportTop=view?.offsetTop||0,bottom=viewportTop+(view?.height||innerHeight),width=Math.min(520,innerWidth-16);
  const navigationBottom=Math.max(0,...[...document.querySelectorAll('.app-header,.program-context')].map(el=>el.getBoundingClientRect().bottom));
  const top=Math.max(viewportTop,Math.min(navigationBottom,bottom-100));
  el.style.width=width+'px';el.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
  const below=bottom-r.bottom-12,above=r.top-top-12,useBelow=below>=Math.min(360,above),space=useBelow?below:above;
  el.style.maxHeight=Math.max(80,space)+'px';el.style.top=(useBelow?r.bottom+4:Math.max(top+8,r.top-el.getBoundingClientRect().height-4))+'px';
 }
 function close(){
  open=false;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
  if(popup.matches(':popover-open'))popup.hidePopover();
 }
 function closeMenu(){menuOpen=false;actions.setAttribute('aria-expanded','false');if(menu.matches(':popover-open'))menu.hidePopover();}
 function hide(){close();closeMenu();}
 function announce(){clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>{if(!disposed)host.querySelector('[data-announcement]').textContent=matches.length+' suggestions. Use arrow keys to choose an exercise.';},150);}
 function render(){
  if(disposed)return;matches=searchCatalog(store.value?.entries||[],input.value,{equipment:filter.value});active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
  if(!store.value){const p=document.createElement('p');p.textContent=error.textContent?'Catalog unavailable. Retry or create an exercise.':'Loading exercises…';list.append(p);}
  else if(!matches.length){const p=document.createElement('p');p.textContent='No matching exercises.';list.append(p);}
  matches.forEach((entry,index)=>{
   const option=document.createElement('div');option.className='exercise-option';option.id=id+'-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
   const name=document.createElement('strong');name.textContent=entry.name;
   const meta=document.createElement('span');meta.className='catalog-meta';meta.textContent=entry.equipment+' · '+entry.familyName;
   const mapping=document.createElement('span');mapping.className='catalog-mapping';mapping.textContent='Primary: '+entry.primaryMuscles.join(', ')+' · Secondary: '+(entry.secondaryMuscles.join(', ')||'None');
   option.append(name,meta,mapping);option.onpointerdown=event=>event.preventDefault();option.onclick=()=>select(entry);list.append(option);
  });announce();if(open)position(popup,host);
 }
 async function load(force=false){
  retry.hidden=true;error.textContent='';
  try{await store.load(force);if(disposed)return;display();render();}
  catch(e){if(disposed)return;error.textContent=(store.value?'Using the last loaded catalog. ':'')+e.message;retry.hidden=false;render();}
 }
 function show(){
  if(disposed||!editing)return;closeMenu();if(!open){popup.showPopover();open=true;input.setAttribute('aria-expanded','true');}render();load();
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
  form?.destroy();form=openCatalogForm({api,mode,entry:mode==='variant'?current:legacy?exercise:undefined,families:store.value?.families||[],initialName:input.value,onSaved:async entry=>{await load(true);if(!disposed)select(entry,{created:true});}});
 }
 function item(label,fn){const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent=label;b.onclick=fn;menu.append(b);}
 actions.onclick=()=>{
  if(menuOpen){closeMenu();return;}close();menu.replaceChildren();
  item('Replace exercise',()=>{closeMenu();editing=true;display();input.value='';input.focus();show();});
  item('Create variant',()=>create('variant'));
  item('View in catalog',()=>{hide();onView?.();});
  menu.showPopover();menuOpen=true;actions.setAttribute('aria-expanded','true');position(menu,actions);menu.querySelector('button').focus();
 };
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
   active=(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
   [...list.children].forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));const option=list.children[active];input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
  }
  if(event.key==='Enter'&&open){event.preventDefault();if(active>=0)select(matches[active]);}
  if(event.key==='Tab')close();
 };
 const outside=event=>{if(!host.contains(event.target)&&!popup.contains(event.target)&&!menu.contains(event.target))hide();};
 const key=event=>{if(event.key==='Escape'){if(menuOpen){closeMenu();actions.focus();}else close();}};
 const scrolling=event=>{if(!popup.contains(event.target)&&!menu.contains(event.target)){if(open)position(popup,host);if(menuOpen)position(menu,actions);}};
 const focus=()=>load(true),resize=()=>hide();
 document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',key);document.addEventListener('scroll',scrolling,true);window.addEventListener('resize',resize);window.addEventListener('focus',focus);
 display();load();
 return {close:hide,update:display,refresh:()=>load(true),destroy(){disposed=true;hide();clearTimeout(announcementTimer);form?.destroy();popup.remove();menu.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',key);document.removeEventListener('scroll',scrolling,true);window.removeEventListener('resize',resize);window.removeEventListener('focus',focus);}};
}
