import {actionIcon} from './action-controls.js';
import {formatRir,parseWeight,parseReps,stepWeight,stepReps} from './workout-sets.js';
import {WORKOUT_LIMITS} from './workout-log.js';

const WEIGHT_STEP=2.5;
const text=value=>value===null||value===undefined?'':String(value);
const rows=new WeakMap();
const bindings=new WeakMap();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

const stepper=kind=>`<div class="log-stepper" data-kind="${kind}"><button type="button" class="log-step" data-step="-1">${actionIcon('minus')}</button><input type="text" inputmode="${kind==='weight'?'decimal':'numeric'}" autocomplete="off" spellcheck="false" data-field="${kind}"><button type="button" class="log-step" data-step="1">${actionIcon('plus')}</button></div>`;

/** One set: kg and reps with steppers, RIR 0–5, done toggle and a set menu (the logger owns its items). Invalid typed text stays visible and is never stored. */
export function createSetRow({exerciseName,set,kind=set.kind||'working',kindIndex=1,placeholder,mode='active',readOnly=mode!=='active',noteOpen=false,onPatch,onToggle,onMenu,onNote,onNoteBlur,onNoteOpen}){
 const li=document.createElement('li');li.className='log-set collapsible';li.dataset.setId=set.id;
 const errorId='log-set-error-'+crypto.randomUUID();
 li.innerHTML=`<div class="log-set-clip"><div class="log-set-row"><span class="log-set-number" aria-hidden="true"></span>${stepper('weight')}${stepper('reps')}<button type="button" class="log-done" aria-pressed="false">${actionIcon('check')}</button><span class="log-rir-label" aria-hidden="true">RIR</span><div class="log-rir" role="group"></div><button type="button" class="action-button log-set-menu" data-action-tooltip="Set actions" aria-haspopup="true" aria-expanded="false">${actionIcon('more')}</button><div class="log-set-note-slot"></div><p class="log-set-error" id="${errorId}" role="alert"></p></div></div>`;
 const $=selector=>li.querySelector(selector);
 const inputs={weight:$('[data-field="weight"]'),reps:$('[data-field="reps"]')},rir=$('.log-rir'),done=$('.log-done'),menu=$('.log-set-menu'),error=$('.log-set-error');
 const keys={weight:'weightKg',reps:'reps'},parse={weight:parseWeight,reps:parseReps};
 let state={exerciseName,set,kind,kindIndex,placeholder,noteOpen};const errors={weight:null,reps:null};let needsReps=mode==='finished'&&set.done&&set.reps===null;
 const noteSlot=$('.log-set-note-slot');let notePart=null,noteKind='none',renderedNoteOpen=noteOpen;
 for(let value=0;value<=WORKOUT_LIMITS.rirMax;value++){
  const button=document.createElement('button');button.type='button';button.className='log-rir-option';button.textContent=formatRir(value);if(value===WORKOUT_LIMITS.rirMax)button.setAttribute('aria-label','5 or more');button.dataset.rir=String(value);button.disabled=readOnly;rir.append(button);
 }
 menu.hidden=readOnly;
 for(const input of Object.values(inputs)){input.setAttribute('aria-describedby',errorId);input.readOnly=readOnly;}

 function showErrors(){
  error.textContent=errors.weight||errors.reps||(needsReps?'Enter reps':'');
  inputs.weight.setAttribute('aria-invalid',String(Boolean(errors.weight)));
  inputs.reps.setAttribute('aria-invalid',String(Boolean(errors.reps||needsReps)));
 }
 /** Keep the active field through input/acknowledgements; only opening or finishing an edit animates. */
 function renderNote(){
  const {set:current,noteOpen:open,kind:setKind,kindIndex:n,exerciseName:name}=state;
  const kind=readOnly?(current.note?'static':'none'):open?'edit':current.note?'text':'none';
  const animate=open!==renderedNoteOpen&&!reducedMotion.matches;renderedNoteOpen=open;
  if(kind!==noteKind){
   const previous=notePart;
   if(previous){
    previous.inert=true;previous.setAttribute('aria-hidden','true');previous.classList.add('is-closed','is-removing');
    if(!animate)previous.remove();
    else{
     const remove=()=>{clearTimeout(timer);previous.removeEventListener('transitionend',end);previous.remove();};
     const end=event=>{if(event.target===previous&&event.propertyName==='grid-template-rows')remove();};
     const timer=setTimeout(remove,320);previous.addEventListener('transitionend',end);
    }
   }
   noteKind=kind;notePart=null;
   if(kind!=='none'){
    const part=document.createElement('div');part.className='log-set-note-part collapsible';
    const inner=document.createElement('div');part.append(inner);
    let field;
    if(kind==='edit'){
     field=document.createElement('input');field.type='text';field.className='log-set-note-input';field.maxLength=WORKOUT_LIMITS.setNoteMax;field.autocomplete='off';
     field.addEventListener('input',()=>onNote(field.value));
     field.addEventListener('blur',()=>{if(notePart===part)onNoteBlur();});
     field.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing)return;
      event.preventDefault();field.blur();
      (notePart?.querySelector('button')||menu).focus({preventScroll:true});
     });
    }else if(kind==='text'){
     field=document.createElement('button');field.type='button';field.className='log-set-note-text';field.addEventListener('click',()=>onNoteOpen?.());
    }else{field=document.createElement('p');field.className='log-set-note-static';}
    inner.append(field);notePart=part;
    if(animate)part.classList.add('is-closed');noteSlot.append(part);
    if(animate){getComputedStyle(part).gridTemplateRows;part.classList.remove('is-closed');}
   }
  }
  const field=notePart?.querySelector('input,button,p');if(!field)return;
  const label=`${setKind==='warmup'?'warm-up set':'set'} ${n}, ${name}`;
  if(kind==='edit'){
   field.setAttribute('aria-label',`Note, ${label}`);
   if(document.activeElement!==field)field.value=current.note??'';
  }else{
   field.textContent=`✎ ${current.note}`;
   if(kind==='text')field.setAttribute('aria-label',`Edit note, ${label}: ${current.note}`);
  }
 }
 function render(){
  const {exerciseName:name,set:current,kind:setKind,kindIndex:n,placeholder:ph}=state,warm=setKind==='warmup',label=warm?`Warm-up set ${n}`:`Set ${n}`;
  li.classList.toggle('is-warmup',warm);li.dataset.kind=setKind;
  li.querySelector('.log-set-number').textContent=warm?`W${n}`:String(n);
  for(const [kind,input] of Object.entries(inputs)){
   input.setAttribute('aria-label',`${label} ${kind}, ${name}`);
   input.placeholder=text(ph?.[keys[kind]]);
   if(document.activeElement!==input&&!errors[kind]&&!(kind==='reps'&&needsReps))input.value=text(current[keys[kind]]);
   const [down,up]=li.querySelectorAll(`[data-kind="${kind}"] .log-step`);
   down.setAttribute('aria-label',`Decrease ${label.toLowerCase()} ${kind}, ${name}`);up.setAttribute('aria-label',`Increase ${label.toLowerCase()} ${kind}, ${name}`);
  }
  rir.hidden=li.querySelector('.log-rir-label').hidden=warm;
  rir.setAttribute('aria-label',`${label} RIR, ${name}`);
  for(const button of rir.children){
   const value=Number(button.dataset.rir);
   button.setAttribute('aria-pressed',String(current.rir===value));
   button.classList.toggle('is-placeholder',current.rir===null&&ph?.rir===value);
  }
  done.setAttribute('aria-pressed',String(current.done));done.setAttribute('aria-label',`Mark ${label.toLowerCase()} done, ${name}`);
  menu.setAttribute('aria-label',`${label} actions, ${name}`);
  li.classList.toggle('is-done',current.done);
  renderNote();
  showErrors();
 }
 function typed(kind){
  const result=parse[kind](inputs[kind].value),key=keys[kind];
  if(result.error){errors[kind]=result.error;showErrors();return;}
  errors[kind]=null;
  // A completed set keeps its reps: clearing them asks for reps instead of storing an invalid set.
  if(kind==='reps'){needsReps=result.value===null&&state.set.done;if(needsReps){showErrors();return;}}
  showErrors();
  if(result.value!==state.set[key])onPatch({[key]:result.value});
 }
 function step(kind,direction){
  const key=keys[kind],current=state.set[key],hint=state.placeholder?.[key]??null;
  const next=kind==='weight'?stepWeight(current,hint,direction*WEIGHT_STEP):stepReps(current,hint,direction);
  errors[kind]=null;if(kind==='reps')needsReps=false;
  inputs[kind].value=text(next);showErrors();
  if(next!==current)onPatch({[key]:next});
 }
 for(const kind of Object.keys(inputs)){
  inputs[kind].addEventListener('input',()=>typed(kind));
  inputs[kind].addEventListener('change',()=>{if(!errors[kind]&&!(kind==='reps'&&needsReps))inputs[kind].value=text(state.set[keys[kind]]);});
  li.querySelectorAll(`[data-kind="${kind}"] .log-step`).forEach(button=>button.addEventListener('click',()=>step(kind,Number(button.dataset.step))));
 }
 rir.addEventListener('click',event=>{
  const button=event.target.closest('.log-rir-option');if(!button||readOnly)return;
  const value=Number(button.dataset.rir);onPatch({rir:state.set.rir===value?null:value});
 });
 done.addEventListener('click',()=>{
  const invalid=['weight','reps'].find(kind=>errors[kind]);
  if(invalid){inputs[invalid].focus();return;}
  const failure=onToggle();
  if(failure){needsReps=true;showErrors();inputs.reps.focus();}
 });
 menu.addEventListener('click',()=>onMenu(menu));
 rows.set(li,next=>{state={...state,...next};render();});
 bindings.set(li,{inputs,number:$('.log-set-number'),done,rir,menu,noteHost:noteSlot,errors,
  applyValue(kind,value){inputs[kind].value=text(value);typed(kind);},
  hasInvalidDraft:()=>Boolean(errors.weight||errors.reps||needsReps),
  disposers:new Set()});
 render();
 return li;
}

/** Refresh a row in place; a focused or invalid field keeps the text being typed. */
export function updateSetRow(row,props){rows.get(row)?.(props);}
export function setRowBindings(row){return bindings.get(row);}
export function destroySetRow(row){for(const dispose of bindings.get(row)?.disposers??[])dispose();bindings.delete(row);rows.delete(row);}
