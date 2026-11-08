import {mountWorkoutNote} from './workout-note.js';
import {mountWorkoutHistory} from './workout-history-summary.js';
import {confirmAction} from './confirm-dialog.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {mountExercisePicker} from './exercise-picker.js';
import {mountSortable} from './sortable.js';
import {mountReorderMenu} from './reorder-menu.js';
import {validateWorkoutLog,WORKOUT_LIMITS,normalizeNote} from './workout-log.js';
import {setLogName,setWorkoutNote,setExerciseNote,setSetNote,setWorkoutTimes,addExercise,swapExercise,removeExercise,moveLogBlock,unlinkSuperset,addSet,addWarmup,removeSet,updateSet,toggleSetDone,nextGuidedSet,confirmFinish} from './workout-edit.js';
import {setPlaceholder,formatElapsed} from './workout-sets.js';
import {createSetRow,updateSetRow,setRowBindings,destroySetRow} from './workout-set-row.js';
import {supersetBlocks} from './superset.js';
import {createLogSupersetFrame,syncLogSupersetFrame} from './workout-superset-frame.js';

const LAST_EXERCISE='A workout needs at least one exercise. Delete the workout instead.';
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
export function mountWorkoutLogger(root,{api,log:initial,lastTime=null,bestPerformance=null,mode='active',readOnly=false,onDelete=async()=>{},onChange=()=>{},onFinish=async()=>{},onDiscard=async()=>{},onLastTimeNeeded=()=>{},onBestPerformanceNeeded=()=>{},onRetry=()=>{},sharedSaveStatus=false,onSaveStatusSlotChange=()=>{}}){
 let log=structuredClone(initial),last=lastTime,best=bestPerformance,bestStatus=new Map(),destroyed=false,busy=false,addPicker=null,sortable=null,relocatingFocus=false;
 const active=mode==='active',editable=!readOnly,unavailable=new Set(),cards=new Map(),frames=new Map(),closing=new Set(),openSetNotes=new Set();
 const listeners=new Set();let rowPlacement=null,revision=0,externalPicker=null;const noteOrigins=new Map();
 const events=new AbortController(),{signal}=events,confirmations=new AbortController();
 const page=document.createElement('section');page.className='workout-logger';page.dataset.mode=mode;if(readOnly)page.dataset.readonly='true';
 page.innerHTML=`<header class="logger-header"><div class="logger-header-row"><h1 class="logger-title" tabindex="-1"><input type="text" class="logger-name" aria-label="Workout name" maxlength="${WORKOUT_LIMITS.nameMax}" autocomplete="off"></h1><button type="button" class="add-btn logger-finish">Finish</button><button type="button" class="action-button logger-more" aria-label="Workout actions" data-action-tooltip="Workout actions" aria-expanded="false">${actionIcon('more')}</button></div><div class="logger-times" hidden><label>Date<input type="date" class="logger-date"></label><label>Start time<input type="time" class="logger-start"></label><label>End time<input type="time" class="logger-end"></label></div><p class="logger-meta"><span class="logger-elapsed"></span><span class="logger-status" role="status" aria-live="polite"></span><button type="button" class="secondary-btn logger-retry" hidden>Retry</button></p><p class="error logger-message" role="alert"></p></header><div class="log-note logger-note"></div><ol class="log-exercises"></ol><p class="empty log-empty">No exercises yet. Add one to start logging.</p><div class="log-picker" hidden><div class="exercise-picker"></div><button type="button" class="secondary-btn">Cancel</button></div><button type="button" class="secondary-btn log-add-exercise">${actionIcon('plus')}Add exercise</button>`;
 const $=selector=>page.querySelector(selector);
 const times=$('.logger-times'),dateInput=$('.logger-date'),startInput=$('.logger-start'),endInput=$('.logger-end'),title=$('.logger-title'),nameInput=$('.logger-name'),finish=$('.logger-finish'),more=$('.logger-more'),elapsed=$('.logger-elapsed'),statusText=$('.logger-status'),retryButton=$('.logger-retry'),message=$('.logger-message');
 const list=$('.log-exercises'),empty=$('.log-empty'),addArea=$('.log-picker'),addHost=addArea.firstElementChild,addCancel=addArea.lastElementChild,addButton=$('.log-add-exercise');
 const workoutNote=mountWorkoutNote($('.logger-note'),{note:log.note??'',readOnly:!editable,onInput:text=>commit(setWorkoutNote(log,text)),onBlur:text=>{if(text!==log.note)commit(setWorkoutNote(log,text));}});
 const tooltips=mountActionTooltips(page),menu=mountReorderMenu({label:'Workout actions'}),moveMenu=mountReorderMenu(),setMenu=mountReorderMenu({label:'Set actions'});
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
 function say(text){message.textContent=text;}

 /** Every edit passes validation before it is shown or reported. */
 function publish(cause,before=log,action=null){for(const listener of listeners)listener({cause,before:structuredClone(before),after:structuredClone(log),action});}
 function relocate(work){
  // Borrowed rows/notes may currently belong to the Focus feed or a dialog.
  const focused=document.activeElement!==document.body?document.activeElement:null;
  const selection=focused&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd,focused.selectionDirection]:null;
  const wasRelocating=relocatingFocus;relocatingFocus=true;
  try{return work();}finally{if(focused?.isConnected&&document.activeElement!==focused){focused.focus({preventScroll:true});if(selection)try{focused.setSelectionRange(...selection);}catch{}}relocatingFocus=wasRelocating;}
 }
 function commit(next,{animate=false,action=null}={}){
  const before=log;
  timeError=false;
  const result=validateWorkoutLog(next);
  if(result.error&&mode==='finished'){
   // Only an incomplete set (done, no reps) is tolerated: it stays on screen while the rest of the edit saves without it.
   const saveable=withoutIncompleteSets(next);
   if(saveable){
    const rest=validateWorkoutLog(saveable);
    if(rest.error&&saveable.exercises.length){say(rest.error);render();return false;}
    log=next;say('');render({animate});revision++;if(!rest.error)onChange(structuredClone(rest.log));publish('edit',before,action);return true;
   }
  }
  if(result.error){say(result.error);render();return false;}
  log=result.log;say('');render({animate});revision++;onChange(structuredClone(log));publish('edit',before,action);return true;
 }

 function createCard(ex){
  const li=document.createElement('li');li.className='log-exercise collapsible';li.dataset.exerciseId=ex.id;li.dataset.blockKey=ex.id;
  const headingId='log-exercise-'+uid();li.setAttribute('aria-labelledby',headingId);
  li.innerHTML=`<div class="log-exercise-clip"><div class="log-exercise-card"><div class="log-exercise-head"><div class="log-exercise-identity"><h2 tabindex="-1" id="${headingId}"></h2><p class="catalog-meta log-equipment"></p></div><div class="log-exercise-actions"><button type="button" class="action-button" data-card-action="swap" data-action-tooltip="Swap exercise">${actionIcon('move')}</button><button type="button" class="action-button reorder-action" data-card-action="reorder" data-action-tooltip="Reorder" aria-expanded="false">${actionIcon('reorder')}</button><button type="button" class="action-button action-button--delete" data-card-action="remove" data-action-tooltip="Remove exercise">${actionIcon('delete')}</button></div></div><div class="log-history"></div><div class="log-note"></div><div class="log-picker" hidden><div class="exercise-picker"></div><button type="button" class="secondary-btn">Cancel swap</button></div><div class="log-set-head" aria-hidden="true"><span>Set</span><span>kg</span><span>Reps</span><span class="log-set-head-rir">RIR</span></div><ol class="log-sets"></ol><div class="log-set-actions"><button type="button" class="secondary-btn log-add-set">${actionIcon('plus')}Add set</button><button type="button" class="secondary-btn log-add-warmup">${actionIcon('plus')}Add warm-up</button></div></div></div>`;
  const q=selector=>li.querySelector(selector);
  const card={li,rows:new Map(),picker:null,heading:q('h2'),equipment:q('.log-equipment'),history:mountWorkoutHistory(q('.log-history'),{exercise:ex,lastTime:last,bestPerformance:best,bestStatus,unavailable}),noteHost:q('.log-note'),notePart:null,noteKind:'none',editingNote:false,
   swap:q('[data-card-action="swap"]'),reorder:q('[data-card-action="reorder"]'),remove:q('[data-card-action="remove"]'),swapArea:q('.log-picker'),sets:q('.log-sets'),addSet:q('.log-add-set'),addWarmup:q('.log-add-warmup'),setActions:q('.log-set-actions')};
  card.swapArea.lastElementChild.addEventListener('click',()=>{closeSwap(card);card.swap.focus();});
  card.swapArea.addEventListener('keydown',event=>{if(event.key==='Escape'&&event.target.getAttribute('aria-expanded')==='false'){closeSwap(card);card.swap.focus();}},true);
  card.addSet.addEventListener('click',()=>{const id=li.dataset.exerciseId;commit(addSet(log,id,uid,mode==='finished'?inheritedValues(id):{}),{animate:true});});
  card.addWarmup.addEventListener('click',()=>{const id=li.dataset.exerciseId;commit(addWarmup(log,id,uid,mode==='finished'?inheritedValues(id,'warmup'):{}),{animate:true});});
  card.setActions.hidden=card.swap.parentElement.hidden=!editable;
  return card;
 }
 const growNote=input=>{input.style.height='auto';input.style.height=input.scrollHeight+'px';};
 /** The note control for the card's current state: add button, textarea, saved text or (read-only) plain text. */
 function noteKind(card,ex){
  if(!editable)return ex.note?'static':'none';
  return card.editingNote?'edit':ex.note?'text':'add';
 }
 function buildNotePart(card,kind,ex){
  const part=document.createElement('div');part.className='log-note-part collapsible';
  const inner=document.createElement('div');part.append(inner);
  if(kind==='add'){
   const button=document.createElement('button');button.type='button';button.className='log-note-add';
   button.textContent='✎ Add note';button.setAttribute('aria-label',`Add note, ${ex.name}`);
   button.addEventListener('click',()=>openNote(card));inner.append(button);
  }else if(kind==='text'){
   const button=document.createElement('button');button.type='button';button.className='log-note-text';
   button.addEventListener('click',()=>openNote(card));inner.append(button);
  }else if(kind==='static'){
   const text=document.createElement('p');text.className='log-note-static';inner.append(text);
  }else{
   const input=document.createElement('textarea');input.className='log-note-input';input.rows=2;input.maxLength=WORKOUT_LIMITS.exerciseNoteMax;
   input.addEventListener('input',()=>{growNote(input);commit(setExerciseNote(log,card.li.dataset.exerciseId,input.value));});
   input.addEventListener('blur',()=>{
    if(relocatingFocus||card.notePart!==part)return;
    const id=card.li.dataset.exerciseId,current=find(id);
    if(current){const value=normalizeNote(input.value);if(value!==current.note)commit(setExerciseNote(log,id,value));}
    card.editingNote=false;syncNote(card,find(id),true);
   });
   inner.append(input);
  }
  return part;
 }
 /** Fill the visible part from the exercise; a focused textarea keeps what is being typed. */
 function fillNote(card,ex){
  const part=card.notePart;if(!part)return;
  const field=part.querySelector('button,textarea,p');
  if(card.noteKind==='add')field.setAttribute('aria-label',`Add note, ${ex.name}`);
  else if(card.noteKind==='text'){
   field.replaceChildren();const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');mark.textContent='✎ ';
   const text=document.createElement('span');text.textContent=ex.note;field.append(mark,text);field.setAttribute('aria-label',`Edit note, ${ex.name}: ${ex.note}`);
  }else if(card.noteKind==='static')field.textContent=ex.note;
  else{field.setAttribute('aria-label',`Note, ${ex.name}`);if(document.activeElement!==field)field.value=ex.note??'';growNote(field);}
 }
 function syncNote(card,ex,animate=false){
  if(!ex)return;
  const kind=noteKind(card,ex);
  if(kind!==card.noteKind){
   if(card.notePart)collapseOut(card.notePart,animate);
   card.noteKind=kind;card.notePart=null;
   if(kind!=='none'){
    const part=buildNotePart(card,kind,ex);card.notePart=part;
    if(animate&&!reducedMotion.matches)part.classList.add('is-closed');
    card.noteHost.append(part);fillNote(card,ex);
    if(animate)reveal(part);
   }
  }else fillNote(card,ex);
  card.noteHost.hidden=kind==='none';
 }
 function openNote(card){
  card.editingNote=true;syncNote(card,find(card.li.dataset.exerciseId),true);
  const input=card.notePart?.querySelector('textarea');
  if(input){input.focus({preventScroll:false});input.setSelectionRange(input.value.length,input.value.length);}
 }
 function updateCard(card,ex,animate,label=''){
  card.heading.textContent=label?`${label} ${ex.name}`:ex.name;card.reorder.hidden=!!label;card.equipment.textContent=ex.equipment||'';card.equipment.hidden=!ex.equipment;
  card.history.update({exercise:ex,lastTime:last,bestPerformance:best,bestStatus,unavailable});
  syncNote(card,ex);
  card.swap.setAttribute('aria-label',`Swap exercise ${ex.name}`);card.reorder.setAttribute('aria-label',`Reorder ${ex.name}`);card.remove.setAttribute('aria-label',`Remove exercise ${ex.name}`);
  card.addSet.setAttribute('aria-label',`Add set, ${ex.name}`);card.addWarmup.setAttribute('aria-label',`Add warm-up, ${ex.name}`);card.addSet.disabled=card.addWarmup.disabled=ex.sets.length>=WORKOUT_LIMITS.sets;
  for(const [id,row] of card.rows)if(!ex.sets.some(s=>s.id===id)){card.rows.delete(id);openSetNotes.delete(id);destroySetRow(row);collapseOut(row,animate);}
  const counts={warmup:0,working:0};
  ex.sets.forEach((set,index)=>{
   const kindIndex=++counts[set.kind];
   const props={exerciseName:ex.name,set,kind:set.kind,kindIndex,placeholder:setPlaceholder(ex,index,lastSets(ex)),mode,readOnly:!editable,noteOpen:openSetNotes.has(set.id)};
   let row=card.rows.get(set.id);const fresh=!row;
   if(fresh){
    row=createSetRow({...props,onPatch:patch=>commit(updateSet(log,ex.id,set.id,patch)),onToggle:()=>toggle(ex.id,set.id),
     onNote:text=>commit(setSetNote(log,ex.id,set.id,text)),
     onNoteBlur:()=>{
      if(relocatingFocus)return;
      const current=find(ex.id)?.sets.find(s=>s.id===set.id);if(!current)return;
      openSetNotes.delete(set.id);const value=normalizeNote(current.note);
      if(value!==current.note)commit(setSetNote(log,ex.id,set.id,value));else render();
     },
     onNoteOpen:()=>openSetNote(ex.id,set.id),
     onMenu:button=>{
      const current=find(ex.id)?.sets.find(s=>s.id===set.id);if(!current)return;
      setMenu.toggle(button,[{label:current.note?'Edit note':'Add note',run:()=>openSetNote(ex.id,set.id)},{label:'Remove set',run:()=>dropSet(ex.id,set.id)}]);
     }});
    if(animate&&!reducedMotion.matches)row.classList.add('is-closed');card.rows.set(set.id,row);
   }else updateSetRow(row,props);
   const live=[...card.sets.children].filter(el=>!el.classList.contains('is-removing'));
   if(rowPlacement)relocate(()=>rowPlacement({ref:{exerciseId:ex.id,setId:set.id},row,compactHost:card.sets,index}));
   else if(live[index]!==row)relocate(()=>card.sets.insertBefore(row,live[index]||null));
   if(fresh&&animate)reveal(row);
  });
 }
 function openSetNote(exerciseId,setId){
  if(!find(exerciseId)?.sets.some(s=>s.id===setId))return;
  openSetNotes.add(setId);render();
  const input=cards.get(exerciseId)?.rows.get(setId)?.querySelector('.log-set-note-part:not(.is-removing) .log-set-note-input');
  if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}
 }
 /** Hoist a frame's remaining members into the list in its place and drop the frame. */
 function finalizeFrame(frame){
  clearTimeout(frame.timer);closing.delete(frame);
  // Moving a node blurs it, so remember the focused control (and its caret) and restore it afterwards.
  const focused=frame.li.contains(document.activeElement)&&!document.activeElement.closest('.is-removing')?document.activeElement:null;
  const range=focused&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd,focused.selectionDirection]:null;
  // Reparenting emits blur synchronously. It is not completion of the user's note edit.
  relocatingFocus=true;
  try{
   for(const child of [...frame.members.children])if(!child.classList.contains('is-removing'))frame.li.before(child);
   frame.li.remove();
   if(focused&&focused.isConnected){focused.focus({preventScroll:true});if(range)try{focused.setSelectionRange(...range);}catch{}}
  }finally{relocatingFocus=false;}
 }
 /** An unpaired frame closes (rail fades, header collapses) and only then releases its cards. */
 function dissolveFrame(frame,animate){
  if(!animate||reducedMotion.matches){finalizeFrame(frame);return;}
  closing.add(frame);frame.li.classList.add('is-closed','is-unlinking');frame.head.classList.add('is-closed');frame.head.inert=true;
  const end=event=>{if(event.target===frame.head&&event.propertyName==='grid-template-rows')finalizeFrame(frame);};
  frame.head.addEventListener('transitionend',end);frame.timer=setTimeout(()=>finalizeFrame(frame),320);
 }
 const firstIdOf=li=>li.dataset.blockKey;
 function render({animate=false}={}){
  workoutNote.update({note:log.note??'',readOnly:!editable});
  // A closing frame stays put through routine edits (typing, done toggles), so a focused field is never moved mid-edit;
  // it is released early only when its members no longer sit together in the log in their current order.
  for(const frame of [...closing]){
   const at=[...frame.members.children].filter(el=>!el.classList.contains('is-removing')).map(el=>log.exercises.findIndex(e=>e.id===el.dataset.exerciseId));
   if(at.some((v,i)=>v<0||(i&&v!==at[i-1]+1)))finalizeFrame(frame);
  }
  const blocks=supersetBlocks(log.exercises),pairs=new Set(blocks.filter(b=>b.length===2).map(b=>log.exercises[b.start].id));
  for(const [id,frame] of frames)if(!pairs.has(id)){frames.delete(id);dissolveFrame(frame,animate);}
  for(const [id,card] of cards)if(!find(id)){cards.delete(id);for(const [setId,row] of card.rows){openSetNotes.delete(setId);destroySetRow(row);}card.history.destroy();card.picker?.destroy();noteOrigins.delete(id);collapseOut(card.li,animate);}
  const fresh=[];
  for(const ex of log.exercises){
   let card=cards.get(ex.id);
   if(!card){card=createCard(ex);cards.set(ex.id,card);if(animate&&!reducedMotion.matches)card.li.classList.add('is-closed');fresh.push(card.li);}
  }
  const slots=[],labels=new Map();let pairNumber=0;
  for(const block of blocks){
   const first=log.exercises[block.start];
   if(block.length===1){
    const card=cards.get(first.id)?.li,ghost=card?.parentElement?.closest('.is-unlinking');
    slots.push({element:ghost||card,exercises:[first]});continue;
   }
   let frame=frames.get(first.id);
   if(!frame){frame=createLogSupersetFrame({editable,canUnlink:mode!=='finished'});frame.li.dataset.blockKey=first.id;frames.set(first.id,frame);}
   syncLogSupersetFrame(frame,first.superset);
   const letter=String.fromCharCode(65+pairNumber++);
   labels.set(first.id,`${letter}1`);labels.set(log.exercises[block.start+1].id,`${letter}2`);
   slots.push({element:frame.li,frame,exercises:[first,log.exercises[block.start+1]]});
  }
  for(const slot of slots){
   if(!slot.frame)continue;
   // Members live in the frame, in pair order; a card still sitting at the top level moves in without animation.
   slot.exercises.forEach((ex,i)=>{const li=cards.get(ex.id).li,members=slot.frame.members;if(members.children[i]!==li)members.insertBefore(li,members.children[i]||null);});
  }
  const elements=[...new Set(slots.map(slot=>slot.element))];
  elements.forEach((element,index)=>{
   const live=[...list.children].filter(el=>!el.classList.contains('is-removing'));
   if(live[index]!==element)list.insertBefore(element,live[index]||null);
  });
  log.exercises.forEach(ex=>{const card=cards.get(ex.id);updateCard(card,ex,animate&&!fresh.includes(card.li),labels.get(ex.id));});
  for(const li of fresh)if(animate)reveal(li);
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
 function inheritedValues(exerciseId,kind='working'){
  const ex=find(exerciseId),index=ex.sets.findLastIndex(s=>s.kind===kind),previous=ex.sets[index];if(!previous)return {done:true};
  const ph=setPlaceholder(ex,index,lastSets(ex))||{};
  // Recorded values only: a blank weight stays bodyweight and a blank RIR stays blank; reps may fall back to the placeholder.
  return {done:true,weightKg:previous.weightKg,reps:previous.reps??ph.reps??null,rir:previous.rir};
 }
 function toggle(exerciseId,setId){
  const ex=find(exerciseId),index=ex.sets.findIndex(s=>s.id===setId);
  const result=toggleSetDone(log,exerciseId,setId,setPlaceholder(ex,index,lastSets(ex)));
  if(result.error)return result.error;
  if(commit(result.log,{action:{type:'toggle',ref:{exerciseId,setId}}})&&active&&!rowPlacement)guideFocus(exerciseId,setId);
 }
 /** After a working set becomes done in a pair, focus the next open set's reps (never while typing in a field). */
 function guideFocus(exerciseId,setId){
  if(!find(exerciseId)?.sets.find(s=>s.id===setId)?.done)return;
  const target=nextGuidedSet(log,exerciseId,setId);
  if(!target)return;
  const typing=document.activeElement;
  if(typing&&page.contains(typing)&&/^(INPUT|TEXTAREA|SELECT)$/.test(typing.tagName))return;
  const row=cards.get(target.exerciseId)?.rows.get(target.setId);
  const input=row?.querySelector('[data-field="reps"]');
  if(!input)return;
  // Keep the row clear of the sticky header, whatever height it currently has.
  row.style.scrollMarginTop=`${$('.logger-header').getBoundingClientRect().height}px`;
  input.focus({preventScroll:true});
  row.scrollIntoView({block:'nearest'});
 }
 async function dropSet(exerciseId,setId){
  // The last set of a finished exercise removes the exercise (after confirming).
  const exercise=find(exerciseId),index=exercise.sets.findIndex(s=>s.id===setId);
  if(mode==='finished'&&exercise.sets[index]?.kind==='working'&&exercise.sets.filter(s=>s.kind==='working').length===1)return dropExercise(exerciseId);
  if(!commit(removeSet(log,exerciseId,setId),{animate:true}))return;
  const card=cards.get(exerciseId),sets=find(exerciseId).sets,target=sets[index]??sets[index-1];
  (target?card.rows.get(target.id).querySelector('.log-set-menu'):card.addSet).focus({preventScroll:true});
 }
 function requestLastTime(ids){
  ids=ids.filter(Boolean);if(!ids.length)return;
  Promise.resolve().then(()=>onBestPerformanceNeeded(ids)).catch(()=>{if(!destroyed){for(const id of ids)bestStatus.set(id,'offline');render();}});
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
 /** Reordering always moves whole blocks (a single exercise or a superset pair). */
 function move(from,to){
  const blocks=supersetBlocks(log.exercises);
  if(!blocks[from]||to<0||to>=blocks.length||from===to)return;
  const key=log.exercises[blocks[from].start].id;
  if(commit(moveLogBlock(log,from,to)))(frames.get(key)?.reorder??cards.get(key).reorder).focus({preventScroll:true});
 }
 const blockIndexOf=element=>{const key=firstIdOf(element.closest('.log-exercises > li'));return supersetBlocks(log.exercises).findIndex(b=>log.exercises[b.start].id===key);};
 const blockCount=()=>supersetBlocks(log.exercises).length;

 function openMoveMenu(button){
  const from=blockIndexOf(button);
  moveMenu.toggle(button,[['Move up',-1],['Move down',1]].map(([label,step])=>({label,disabled:from+step<0||from+step>=blockCount(),run:()=>{const current=blockIndexOf(button);if(current>=0)move(current,current+step);}})));
 }
 list.addEventListener('click',event=>{
  const frameButton=event.target.closest('[data-frame-action]');
  if(frameButton&&editable){
   const key=firstIdOf(frameButton.closest('.log-exercises > li'));
   if(frameButton.dataset.frameAction==='reorder')openMoveMenu(frameButton);
   else if(mode!=='finished'&&commit(unlinkSuperset(log,key),{animate:true}))cards.get(key).reorder.focus({preventScroll:true});
   return;
  }
  const button=event.target.closest('[data-card-action]');if(!button||!editable)return;
  const card=cards.get(button.closest('.log-exercise').dataset.exerciseId);if(!card)return;
  const action=button.dataset.cardAction;
  if(action==='swap')openSwap(card);
  else if(action==='remove')dropExercise(card.li.dataset.exerciseId);
  else openMoveMenu(button);
 },{signal});
 list.addEventListener('keydown',event=>{
  const step={ArrowUp:-1,ArrowDown:1}[event.key];
  if(!step||!event.target.classList.contains('reorder-action'))return;
  event.preventDefault();const from=blockIndexOf(event.target);move(from,from+step);
 },{signal});
 if(editable)sortable=mountSortable(list,{itemSelector:'.log-exercises > li:not(.is-removing):not(.is-unlinking)',reorderSelector:'.reorder-action:not([hidden])',getGroups:()=>[{element:list,key:'log'}],getKey:firstIdOf,
  onCommit:({key,beforeKey})=>{
   const blocks=supersetBlocks(log.exercises),idOf=b=>log.exercises[b.start].id,others=blocks.filter(b=>idOf(b)!==key);
   move(blocks.findIndex(b=>idOf(b)===key),beforeKey===null?others.length:others.findIndex(b=>idOf(b)===beforeKey));
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
  const result=await confirmFinish(()=>destroyed?null:log,{confirm:options=>confirmAction({...options,signal:confirmations.signal}),now:()=>new Date()});
  if(result.cancelled)return;
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
 retryButton.addEventListener('click',()=>{Promise.resolve(onRetry()).catch(()=>{});},{signal});

 const tick=()=>{if(!destroyed&&active)elapsed.textContent=formatElapsed(Date.now()-Date.parse(log.startedAt));};
 const timer=active?setInterval(tick,60000):null;
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick();},{signal});
 render();tick();root.append(page);
 if(sharedSaveStatus){statusText.hidden=true;retryButton.hidden=true;const slot=document.createElement('div');slot.className='page-save-slot';page.querySelector('.logger-header').append(slot);onSaveStatusSlotChange(slot);}

 function restoreRows(){rowPlacement=null;relocate(()=>{for(const ex of log.exercises){const card=cards.get(ex.id);for(const set of ex.sets){const row=card?.rows.get(set.id);if(row)card.sets.append(row);}}});}
 function restoreExerciseNotes(){relocate(()=>{for(const [id,marker] of noteOrigins){const host=cards.get(id)?.noteHost;if(host&&marker.isConnected)marker.after(host);}});}
 function external(host,onSelect){
  externalPicker?.destroy();host.replaceChildren();
  const area=document.createElement('div');area.className='log-picker';area.innerHTML='<div class="exercise-picker"></div><button type="button" class="secondary-btn">Cancel</button>';host.append(area);
  const close=()=>{externalPicker?.destroy();externalPicker=null;area.remove();};
  externalPicker=openPicker(area,entry=>{close();onSelect(entry);});area.lastElementChild.onclick=close;
 }
 const presentationPort={
  read:()=>({log:structuredClone(log),lastTime:structuredClone(last),bestPerformance:structuredClone(best),bestStatus:new Map(bestStatus),unavailable:new Set(unavailable)}),
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  row:ref=>cards.get(ref.exerciseId)?.rows.get(ref.setId)??null,
  setRowPlacement(place){rowPlacement=place;render();},restoreRows,restoreExerciseNotes,relocate,
  async command(action){
   if(destroyed||!editable)return {accepted:false};
   const before=revision,ref=action.ref,id=action.exerciseId??ref?.exerciseId;
   switch(action.type){
    case 'patch':return {accepted:commit(updateSet(log,id,ref.setId,action.patch),{action})};
    case 'toggle':{const row=presentationPort.row(ref);if(row)setRowBindings(row).done.click();break;}
    case 'set-note':openSetNote(id,ref.setId);return {accepted:true};
    case 'exercise-note':{const card=cards.get(id);if(!card)return {accepted:false};if(action.host){if(!noteOrigins.has(id)){const marker=document.createComment('exercise-note');card.noteHost.before(marker);noteOrigins.set(id,marker);}relocate(()=>action.host.append(card.noteHost));}if(!card.editingNote)openNote(card);return {accepted:true};}
    case 'add-set':return {accepted:commit(addSet(log,id,uid),{animate:true,action})};
    case 'add-warmup':return {accepted:commit(addWarmup(log,id,uid),{animate:true,action})};
    case 'remove-set':await dropSet(id,ref.setId);break;
    case 'remove-exercise':await dropExercise(id);break;
    case 'unlink':return {accepted:commit(unlinkSuperset(log,id),{animate:true,action})};
    case 'move-block':{const blocks=supersetBlocks(log.exercises),from=blocks.findIndex(b=>log.exercises.slice(b.start,b.start+b.length).some(e=>e.id===id));return {accepted:commit(moveLogBlock(log,from,action.toBlockIndex),{action})};}
    case 'reorder':{const blocks=supersetBlocks(log.exercises),at=()=>blocks.findIndex(b=>log.exercises.slice(b.start,b.start+b.length).some(e=>e.id===id));moveMenu.toggle(action.opener,[-1,1].map(step=>({label:step<0?'Move up':'Move down',disabled:at()+step<0||at()+step>=blocks.length,run:()=>presentationPort.command({type:'move-block',exerciseId:id,toBlockIndex:at()+step})})));return {accepted:true};}
    case 'swap':external(action.host,entry=>{if(find(id))commit(swapExercise(log,id,entry));requestLastTime([entry.id]);});return {accepted:true};
    case 'add-exercise':external(action.host,entry=>{if(log.exercises.length<WORKOUT_LIMITS.exercises)commit(addExercise(log,entry,uid),{animate:true});requestLastTime([entry.id]);});return {accepted:true};
    case 'finish':finish.click();return {accepted:true};
    case 'discard':more.click();return {accepted:true};
   }
   return {accepted:revision!==before};
  }
 };
 return {
  presentationPort,
  setLog(value){if(destroyed)return;const before=log;log=structuredClone(value);for(const card of cards.values())if(card.picker&&!find(card.li.dataset.exerciseId))closeSwap(card);render();publish('hydrate',before);},
  setBestPerformance(map){if(destroyed)return;best={...(best||{}),...map};render();publish('history');},
  setBestStatus({variantIds,status}){if(destroyed)return;for(const id of variantIds)bestStatus.set(id,status);render();publish('history');},
  setLastTime(map){if(destroyed)return;last=map;if(map)for(const id of Object.keys(map))unavailable.delete(id);render();publish('history');},
  /** A paused non-network failure (`Couldn’t save`) shows Retry; other statuses retry by themselves or have their own flow. */
  setStatus(text){
   if(destroyed)return;
   statusText.textContent=text;publish('status');
   const hide=!(active&&text==='Couldn’t save');
   if(hide&&document.activeElement===retryButton)title.focus({preventScroll:true});
   retryButton.hidden=hide;
  },
  /** True while a finished log has a set still showing `Enter reps`, which is not saved. */
  hasUnsavedDraft(){return mode==='finished'&&editable&&[...page.querySelectorAll('.log-set-error')].some(e=>e.textContent==='Enter reps');},
  focusTitle(){title.focus({preventScroll:true});},
  destroy(){
   if(destroyed)return;
   if(sharedSaveStatus)onSaveStatusSlotChange(null);
   destroyed=true;workoutNote.destroy();clearInterval(timer);for(const frame of closing)clearTimeout(frame.timer);events.abort();confirmations.abort();sortable?.destroy();menu.destroy();moveMenu.destroy();setMenu.destroy();tooltips.destroy();
   listeners.clear();externalPicker?.destroy();for(const card of cards.values()){card.picker?.destroy();card.history.destroy();for(const row of card.rows.values())destroySetRow(row);}addPicker?.destroy();page.remove();
  }
 };
}
