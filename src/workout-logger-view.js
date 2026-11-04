import {confirmAction} from './confirm-dialog.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {mountExercisePicker} from './exercise-picker.js';
import {mountSortable} from './sortable.js';
import {mountReorderMenu} from './reorder-menu.js';
import {validateWorkoutLog,WORKOUT_LIMITS} from './workout-log.js';
import {setLogName,setWorkoutTimes,addExercise,swapExercise,removeExercise,moveLogExercise,addSet,removeSet,updateSet,toggleSetDone,undoneSetCount,finishWorkout} from './workout-edit.js';
import {formatLastTime,setPlaceholder,formatElapsed} from './workout-sets.js';
import {createSetRow,updateSetRow} from './workout-set-row.js';

const LAST_EXERCISE='A workout needs at least one exercise. Delete the workout instead.';
const NO_SETS='Log at least one set, or discard the workout.';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const uid=()=>crypto.randomUUID();

/** Open a freshly inserted collapsible part with the shared 200ms height+fade; instant with reduced motion. */
function reveal(part){
 if(reducedMotion.matches){part.classList.remove('is-closed');return;}
 getComputedStyle(part).gridTemplateRows;part.classList.remove('is-closed');
}
/** Close a part, making it inert at once, and remove it only after the transition ends. */
function collapseOut(part,animate){
 part.classList.add('is-closed','is-removing');part.inert=true;part.setAttribute('aria-hidden','true');
 if(!animate||reducedMotion.matches){part.remove();return;}
 const done=()=>{clearTimeout(timer);part.removeEventListener('transitionend',end);part.remove();};
 const end=event=>{if(event.target===part&&event.propertyName==='grid-template-rows')done();};
 const timer=setTimeout(done,320);part.addEventListener('transitionend',end);
}
const blankExercise={catalogId:null,familyId:null,name:'',primaryMuscles:[],secondaryMuscles:[]};

/** Active workout logger: sticky header, exercise cards with set rows, add/swap/remove/reorder and Finish. */
export function mountWorkoutLogger(root,{api,log:initial,lastTime=null,mode='active',readOnly=false,onDelete=async()=>{},onChange=()=>{},onFinish=async()=>{},onDiscard=async()=>{},onLastTimeNeeded=()=>{}}){
 let log=structuredClone(initial),last=lastTime,destroyed=false,busy=false,addPicker=null,sortable=null;
 const active=mode==='active',editable=!readOnly,unavailable=new Set(),cards=new Map();
 const events=new AbortController(),{signal}=events,confirmations=new AbortController();
 const page=document.createElement('section');page.className='workout-logger';page.dataset.mode=mode;if(readOnly)page.dataset.readonly='true';
 page.innerHTML=`<header class="logger-header"><div class="logger-header-row"><h1 class="logger-title" tabindex="-1"><input type="text" class="logger-name" aria-label="Workout name" maxlength="${WORKOUT_LIMITS.nameMax}" autocomplete="off"></h1><button type="button" class="add-btn logger-finish">Finish</button><button type="button" class="action-button logger-more" aria-label="Workout actions" data-action-tooltip="Workout actions" aria-expanded="false">${actionIcon('more')}</button></div><div class="logger-times" hidden><label>Date<input type="date" class="logger-date"></label><label>Start time<input type="time" class="logger-start"></label><label>End time<input type="time" class="logger-end"></label></div><p class="logger-meta"><span class="logger-elapsed"></span><span class="logger-status" role="status" aria-live="polite"></span></p><p class="error logger-message" role="alert"></p></header><ol class="log-exercises"></ol><p class="empty log-empty">No exercises yet. Add one to start logging.</p><div class="log-picker" hidden><div class="exercise-picker"></div><button type="button" class="secondary-btn">Cancel</button></div><button type="button" class="secondary-btn log-add-exercise">${actionIcon('plus')}Add exercise</button>`;
 const $=selector=>page.querySelector(selector);
 const times=$('.logger-times'),dateInput=$('.logger-date'),startInput=$('.logger-start'),endInput=$('.logger-end'),title=$('.logger-title'),nameInput=$('.logger-name'),finish=$('.logger-finish'),more=$('.logger-more'),elapsed=$('.logger-elapsed'),statusText=$('.logger-status'),message=$('.logger-message');
 const list=$('.log-exercises'),empty=$('.log-empty'),addArea=$('.log-picker'),addHost=addArea.firstElementChild,addCancel=addArea.lastElementChild,addButton=$('.log-add-exercise');
 const tooltips=mountActionTooltips(page),menu=mountReorderMenu({label:'Workout actions'}),moveMenu=mountReorderMenu();
 nameInput.readOnly=!editable;finish.hidden=!active;more.hidden=addButton.hidden=!editable;times.hidden=mode!=='finished'||readOnly;

 // In a finished log every set is a completed set; an added exercise starts with one that still needs reps.
 const withDoneSets=next=>mode==='finished'?{...next,exercises:next.exercises.map((e,i)=>i===next.exercises.length-1?{...e,sets:e.sets.map(s=>({...s,done:true}))}:e)}:next;
 /** The log without done sets that lack reps (and exercises left empty), or null when every set is complete. */
 function withoutIncompleteSets(value){
  const incomplete=s=>s.done&&s.reps===null;
  if(!value.exercises.some(e=>e.sets.some(incomplete)))return null;
  return {...value,exercises:value.exercises.map(e=>({...e,sets:e.sets.filter(s=>!incomplete(s))})).filter(e=>e.sets.length)};
 }
 const find=id=>log.exercises.find(e=>e.id===id);
 const lastSets=ex=>ex.variantId&&last&&!unavailable.has(ex.variantId)?last[ex.variantId]?.sets:undefined;
 function lastText(ex){
  if(!ex.variantId)return {text:'No history'};
  if(last===null||unavailable.has(ex.variantId))return {text:'Last time unavailable offline'};
  const entry=last[ex.variantId];return entry?{label:'Last time',text:formatLastTime(entry.sets)}:{text:'No history'};
 }
 function say(text){message.textContent=text;}

 /** Every edit passes validation before it is shown or reported. */
 function commit(next,{animate=false}={}){
  timeError=false;
  const result=validateWorkoutLog(next);
  if(result.error&&mode==='finished'){
   // Only an incomplete set (done, no reps) is tolerated: it stays on screen while the rest of the edit saves without it.
   const saveable=withoutIncompleteSets(next);
   if(saveable){
    const rest=validateWorkoutLog(saveable);
    if(rest.error&&saveable.exercises.length){say(rest.error);render();return false;}
    log=next;say('');render({animate});if(!rest.error)onChange(structuredClone(rest.log));return true;
   }
  }
  if(result.error){say(result.error);render();return false;}
  log=result.log;say('');render({animate});onChange(structuredClone(log));return true;
 }

 function createCard(ex){
  const li=document.createElement('li');li.className='log-exercise collapsible';li.dataset.exerciseId=ex.id;
  const headingId='log-exercise-'+uid();li.setAttribute('aria-labelledby',headingId);
  li.innerHTML=`<div class="log-exercise-clip"><div class="log-exercise-card"><div class="log-exercise-head"><div class="log-exercise-identity"><h2 tabindex="-1" id="${headingId}"></h2><p class="catalog-meta log-equipment"></p></div><div class="log-exercise-actions"><button type="button" class="action-button" data-card-action="swap" data-action-tooltip="Swap exercise">${actionIcon('move')}</button><button type="button" class="action-button reorder-action" data-card-action="reorder" data-action-tooltip="Reorder" aria-expanded="false">${actionIcon('reorder')}</button><button type="button" class="action-button action-button--delete" data-card-action="remove" data-action-tooltip="Remove exercise">${actionIcon('delete')}</button></div></div><p class="log-last-time"><span class="log-last-label"></span><span class="log-last-value"></span></p><div class="log-picker" hidden><div class="exercise-picker"></div><button type="button" class="secondary-btn">Cancel swap</button></div><div class="log-set-head" aria-hidden="true"><span>Set</span><span>kg</span><span>Reps</span><span class="log-set-head-rir">RIR</span></div><ol class="log-sets"></ol><button type="button" class="secondary-btn log-add-set">${actionIcon('plus')}Add set</button></div></div>`;
  const q=selector=>li.querySelector(selector);
  const card={li,rows:new Map(),picker:null,heading:q('h2'),equipment:q('.log-equipment'),label:q('.log-last-label'),value:q('.log-last-value'),
   swap:q('[data-card-action="swap"]'),reorder:q('[data-card-action="reorder"]'),remove:q('[data-card-action="remove"]'),swapArea:q('.log-picker'),sets:q('.log-sets'),addSet:q('.log-add-set')};
  card.swapArea.lastElementChild.addEventListener('click',()=>{closeSwap(card);card.swap.focus();});
  card.swapArea.addEventListener('keydown',event=>{if(event.key==='Escape'&&event.target.getAttribute('aria-expanded')==='false'){closeSwap(card);card.swap.focus();}},true);
  card.addSet.addEventListener('click',()=>{const id=li.dataset.exerciseId;commit(addSet(log,id,uid,mode==='finished'?inheritedValues(id):{}),{animate:true});});
  card.addSet.hidden=card.swap.parentElement.hidden=!editable;
  return card;
 }
 function updateCard(card,ex,animate){
  card.heading.textContent=ex.name;card.equipment.textContent=ex.equipment||'';card.equipment.hidden=!ex.equipment;
  const shown=lastText(ex);card.label.textContent=shown.label||'';card.label.hidden=!shown.label;card.value.textContent=shown.text;
  card.swap.setAttribute('aria-label',`Swap exercise ${ex.name}`);card.reorder.setAttribute('aria-label',`Reorder ${ex.name}`);card.remove.setAttribute('aria-label',`Remove exercise ${ex.name}`);
  card.addSet.setAttribute('aria-label',`Add set, ${ex.name}`);card.addSet.disabled=ex.sets.length>=WORKOUT_LIMITS.sets;
  for(const [id,row] of card.rows)if(!ex.sets.some(s=>s.id===id)){card.rows.delete(id);collapseOut(row,animate);}
  ex.sets.forEach((set,index)=>{
   const props={exerciseName:ex.name,set,index,placeholder:setPlaceholder(ex,index,lastSets(ex)),mode,readOnly:!editable};
   let row=card.rows.get(set.id);const fresh=!row;
   if(fresh){
    row=createSetRow({...props,readOnly:!editable,onPatch:patch=>commit(updateSet(log,ex.id,set.id,patch)),onToggle:()=>toggle(ex.id,set.id),onRemove:()=>dropSet(ex.id,set.id)});
    if(animate)row.classList.add('is-closed');card.rows.set(set.id,row);
   }else updateSetRow(row,props);
   const live=[...card.sets.children].filter(el=>!el.classList.contains('is-removing'));
   if(live[index]!==row)card.sets.insertBefore(row,live[index]||null);
   if(fresh&&animate)reveal(row);
  });
 }
 function render({animate=false}={}){
  for(const [id,card] of cards)if(!find(id)){cards.delete(id);card.picker?.destroy();collapseOut(card.li,animate);}
  log.exercises.forEach((ex,index)=>{
   let card=cards.get(ex.id);const fresh=!card;
   if(fresh){card=createCard(ex);cards.set(ex.id,card);if(animate)card.li.classList.add('is-closed');}
   const live=[...list.children].filter(el=>!el.classList.contains('is-removing'));
   if(live[index]!==card.li)list.insertBefore(card.li,live[index]||null);
   updateCard(card,ex,animate&&!fresh);
   if(fresh&&animate)reveal(card.li);
  });
  empty.hidden=log.exercises.length>0;addButton.disabled=log.exercises.length>=WORKOUT_LIMITS.exercises;
  if(document.activeElement!==nameInput)nameInput.value=log.name;
  if(mode==='finished')showTimes();
 }

 const pad=n=>String(n).padStart(2,'0');
 const dateValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,timeValue=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
 /** Header fields mirror the log; a typed value that failed validation stays until the next valid edit. */
 function showTimes(){
  const start=new Date(log.startedAt),end=new Date(log.finishedAt);
  if(!timeError){dateInput.value=dateValue(start);startInput.value=timeValue(start);endInput.value=timeValue(end);}
  elapsed.textContent=formatElapsed(end-start);
 }
 let timeError=false;
 function changeTimes(){
  const result=setWorkoutTimes(log,{date:dateInput.value,startTime:startInput.value,endTime:endInput.value});
  if(result.error){timeError=true;say(result.error);return;}
  timeError=false;
  commit(result.log);
 }
 /** The previous row's effective values (typed, else its placeholder) for a new done set in a finished log. */
 function inheritedValues(exerciseId){
  const ex=find(exerciseId),index=ex.sets.length-1,previous=ex.sets[index];if(!previous)return {done:true};
  const ph=setPlaceholder(ex,index,lastSets(ex))||{};
  // Recorded values only: a blank weight stays bodyweight and a blank RIR stays blank; reps may fall back to the placeholder.
  return {done:true,weightKg:previous.weightKg,reps:previous.reps??ph.reps??null,rir:previous.rir};
 }
 function toggle(exerciseId,setId){
  const ex=find(exerciseId),index=ex.sets.findIndex(s=>s.id===setId);
  const result=toggleSetDone(log,exerciseId,setId,setPlaceholder(ex,index,lastSets(ex)));
  if(result.error)return result.error;
  commit(result.log);
 }
 async function dropSet(exerciseId,setId){
  // The last set of a finished exercise removes the exercise (after confirming).
  if(mode==='finished'&&find(exerciseId).sets.length===1)return dropExercise(exerciseId);
  const index=find(exerciseId).sets.findIndex(s=>s.id===setId);
  if(!commit(removeSet(log,exerciseId,setId),{animate:true}))return;
  const card=cards.get(exerciseId),sets=find(exerciseId).sets,target=sets[index]??sets[index-1];
  (target?card.rows.get(target.id).querySelector('.log-remove-set'):card.addSet).focus({preventScroll:true});
 }
 function requestLastTime(ids){
  ids=ids.filter(Boolean);if(!ids.length)return;
  for(const id of ids)unavailable.delete(id);
  Promise.resolve().then(()=>onLastTimeNeeded(ids)).catch(()=>{if(destroyed)return;for(const id of ids)unavailable.add(id);render();});
 }
 function openPicker(area,onSelect){
  const host=area.firstElementChild;area.hidden=false;
  const picker=mountExercisePicker(host,{api,exercise:{...blankExercise},showLinkedName:false,onSelect});
  host.querySelector('[role="combobox"]').focus();
  return picker;
 }
 function closeSwap(card){card.picker?.destroy();card.picker=null;card.swapArea.hidden=true;card.swapArea.firstElementChild.replaceChildren();}
 function closeAdd(){addPicker?.destroy();addPicker=null;addArea.hidden=true;addHost.replaceChildren();addButton.hidden=!editable;}
 function closePickers(){for(const card of cards.values())closeSwap(card);closeAdd();}
 function openSwap(card){
  const id=card.li.dataset.exerciseId;closePickers();
  card.picker=openPicker(card.swapArea,entry=>{
   closeSwap(card);
   if(find(id)&&commit(swapExercise(log,id,entry)))card.swap.focus({preventScroll:true});
   requestLastTime([entry.id]);
  });
 }
 async function dropExercise(id){
  const ex=find(id);if(!ex)return;
  if(mode==='finished'&&log.exercises.length===1){say(LAST_EXERCISE);return;}
  if(ex.sets.some(s=>s.done)&&!await confirmAction({title:'Remove exercise?',message:`Remove ${ex.name} and its logged sets?`,confirmLabel:'Remove exercise',destructive:true,signal:confirmations.signal}))return;
  if(destroyed||!find(id))return;
  const index=log.exercises.findIndex(e=>e.id===id);
  if(!commit(removeExercise(log,id),{animate:true}))return;
  const target=log.exercises[index]??log.exercises[index-1];
  (target?cards.get(target.id).heading:addButton).focus({preventScroll:true});
 }
 function move(from,to){
  const id=log.exercises[from]?.id;if(!id||to<0||to>=log.exercises.length||from===to)return;
  if(commit(moveLogExercise(log,from,to)))cards.get(id).reorder.focus({preventScroll:true});
 }
 const indexOf=element=>log.exercises.findIndex(e=>e.id===element.closest('.log-exercise').dataset.exerciseId);

 list.addEventListener('click',event=>{
  const button=event.target.closest('[data-card-action]');if(!button||!editable)return;
  const card=cards.get(button.closest('.log-exercise').dataset.exerciseId);if(!card)return;
  const action=button.dataset.cardAction;
  if(action==='swap')openSwap(card);
  else if(action==='remove')dropExercise(card.li.dataset.exerciseId);
  else{const from=indexOf(button);moveMenu.toggle(button,[['Move up',-1],['Move down',1]].map(([label,step])=>({label,disabled:from+step<0||from+step>=log.exercises.length,run:()=>{const current=indexOf(button);if(current>=0)move(current,current+step);}})));}
 },{signal});
 list.addEventListener('keydown',event=>{
  const step={ArrowUp:-1,ArrowDown:1}[event.key];
  if(!step||!event.target.classList.contains('reorder-action'))return;
  event.preventDefault();const from=indexOf(event.target);move(from,from+step);
 },{signal});
 if(editable)sortable=mountSortable(list,{itemSelector:'.log-exercise:not(.is-removing)',reorderSelector:'.reorder-action',getGroups:()=>[{element:list,key:'log'}],getKey:li=>li.dataset.exerciseId,
  onCommit:({key,beforeKey})=>{
   const from=log.exercises.findIndex(e=>e.id===key),others=log.exercises.filter(e=>e.id!==key);
   move(from,beforeKey===null?others.length:others.findIndex(e=>e.id===beforeKey));
  }});
 addButton.addEventListener('click',()=>{
  closePickers();addButton.hidden=true;
  addPicker=openPicker(addArea,entry=>{
   closeAdd();
   if(commit(withDoneSets(addExercise(log,entry,uid)),{animate:true}))cards.get(log.exercises.at(-1).id).heading.focus({preventScroll:true});
   requestLastTime([entry.id]);
  });
 },{signal});
 addCancel.addEventListener('click',()=>{closeAdd();addButton.focus();},{signal});
 addArea.addEventListener('keydown',event=>{if(event.key==='Escape'&&event.target.getAttribute('aria-expanded')==='false'){closeAdd();addButton.focus();}},{signal,capture:true});
 nameInput.addEventListener('change',()=>{const next=setLogName(log,nameInput.value);if(next.name!==log.name)commit(next);nameInput.value=log.name;},{signal});

 async function run(work){
  if(busy)return;busy=true;
  try{await work();}catch(error){if(!destroyed)say(error.message||'Something went wrong. Please retry.');}finally{busy=false;}
 }
 finish.addEventListener('click',()=>run(async()=>{
  say('');
  if(!log.exercises.some(e=>e.sets.some(s=>s.done))){say(NO_SETS);return;}
  const open=undoneSetCount(log);
  if(open&&!await confirmAction({title:'Finish workout?',message:`${open===1?'1 set':`${open} sets`} not completed — finish anyway? Uncompleted sets will be removed.`,confirmLabel:'Finish workout',signal:confirmations.signal}))return;
  if(destroyed)return;
  const result=finishWorkout(log,new Date());
  if(result.error){say(result.error);return;}
  log=result.log;onChange(structuredClone(log));
  await onFinish(structuredClone(log));
 }),{signal});
 more.addEventListener('click',()=>menu.toggle(more,[active
  ?{label:'Discard workout',run:()=>run(async()=>{
   if(!await confirmAction({title:'Discard workout?',message:'This workout and its sets will be deleted. This cannot be undone.',confirmLabel:'Discard workout',destructive:true,signal:confirmations.signal}))return;
   if(!destroyed)await onDiscard();
  })}
  :{label:'Delete workout',run:()=>run(async()=>{
   if(!await confirmAction({title:'Delete workout?',message:'This workout will be deleted. This cannot be undone.',confirmLabel:'Delete workout',destructive:true,signal:confirmations.signal}))return;
   if(!destroyed)await onDelete();
  })}]),{signal});
 for(const input of [dateInput,startInput,endInput])input.addEventListener('change',changeTimes,{signal});

 const tick=()=>{if(!destroyed&&active)elapsed.textContent=formatElapsed(Date.now()-Date.parse(log.startedAt));};
 const timer=active?setInterval(tick,60000):null;
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick();},{signal});
 render();tick();root.append(page);

 return {
  setLog(value){if(destroyed)return;log=structuredClone(value);for(const card of cards.values())if(card.picker&&!find(card.li.dataset.exerciseId))closeSwap(card);render();},
  setLastTime(map){if(destroyed)return;last=map;if(map)for(const id of Object.keys(map))unavailable.delete(id);render();},
  setStatus(text){if(!destroyed)statusText.textContent=text;},
  /** True while a finished log has a set still showing `Enter reps`, which is not saved. */
  hasUnsavedDraft(){return mode==='finished'&&editable&&[...page.querySelectorAll('.log-set-error')].some(e=>e.textContent==='Enter reps');},
  focusTitle(){title.focus({preventScroll:true});},
  destroy(){
   destroyed=true;clearInterval(timer);events.abort();confirmations.abort();sortable?.destroy();menu.destroy();moveMenu.destroy();tooltips.destroy();
   for(const card of cards.values())card.picker?.destroy();addPicker?.destroy();page.remove();
  }
 };
}
