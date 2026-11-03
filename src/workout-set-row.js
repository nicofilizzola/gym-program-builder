import {actionIcon} from './action-controls.js';
import {parseWeight,parseReps,stepWeight,stepReps} from './workout-sets.js';
import {WORKOUT_LIMITS} from './workout-log.js';

const WEIGHT_STEP=2.5;
const text=value=>value===null||value===undefined?'':String(value);
const rows=new WeakMap();

const stepper=kind=>`<div class="log-stepper" data-kind="${kind}"><button type="button" class="log-step" data-step="-1">${actionIcon('minus')}</button><input type="text" inputmode="${kind==='weight'?'decimal':'numeric'}" autocomplete="off" spellcheck="false" data-field="${kind}"><button type="button" class="log-step" data-step="1">${actionIcon('plus')}</button></div>`;

/** One set: kg and reps with steppers, RIR 0–5, done toggle and remove. Invalid typed text stays visible and is never stored. */
export function createSetRow({exerciseName,set,index,placeholder,mode='active',onPatch,onToggle,onRemove}){
 const li=document.createElement('li');li.className='log-set collapsible';li.dataset.setId=set.id;
 const errorId='log-set-error-'+crypto.randomUUID();
 li.innerHTML=`<div class="log-set-clip"><div class="log-set-row"><span class="log-set-number" aria-hidden="true"></span>${stepper('weight')}${stepper('reps')}<div class="log-set-extra"><span class="log-rir-label" aria-hidden="true">RIR</span><div class="log-rir" role="group"></div><div class="log-set-actions"><button type="button" class="log-done" aria-pressed="false">${actionIcon('check')}</button><button type="button" class="action-button action-button--delete log-remove-set" data-action-tooltip="Remove set">${actionIcon('delete')}</button></div></div><p class="log-set-error" id="${errorId}" role="alert"></p></div></div>`;
 const $=selector=>li.querySelector(selector);
 const inputs={weight:$('[data-field="weight"]'),reps:$('[data-field="reps"]')},rir=$('.log-rir'),done=$('.log-done'),remove=$('.log-remove-set'),error=$('.log-set-error');
 const keys={weight:'weightKg',reps:'reps'},parse={weight:parseWeight,reps:parseReps};
 const readOnly=mode!=='active';
 let state={exerciseName,set,index,placeholder};const errors={weight:null,reps:null};let needsReps=false;
 for(let value=0;value<=WORKOUT_LIMITS.rirMax;value++){
  const button=document.createElement('button');button.type='button';button.className='log-rir-option';button.textContent=String(value);button.dataset.rir=String(value);button.disabled=readOnly;rir.append(button);
 }
 for(const input of Object.values(inputs)){input.setAttribute('aria-describedby',errorId);input.readOnly=readOnly;}

 function showErrors(){
  error.textContent=errors.weight||errors.reps||(needsReps?'Enter reps':'');
  inputs.weight.setAttribute('aria-invalid',String(Boolean(errors.weight)));
  inputs.reps.setAttribute('aria-invalid',String(Boolean(errors.reps||needsReps)));
 }
 function render(){
  const {exerciseName:name,set:current,index:i,placeholder:ph}=state,n=i+1;
  li.querySelector('.log-set-number').textContent=String(n);
  for(const [kind,input] of Object.entries(inputs)){
   input.setAttribute('aria-label',`Set ${n} ${kind}, ${name}`);
   input.placeholder=text(ph?.[keys[kind]]);
   if(document.activeElement!==input&&!errors[kind]&&!(kind==='reps'&&needsReps))input.value=text(current[keys[kind]]);
   const [down,up]=li.querySelectorAll(`[data-kind="${kind}"] .log-step`);
   down.setAttribute('aria-label',`Decrease set ${n} ${kind}, ${name}`);up.setAttribute('aria-label',`Increase set ${n} ${kind}, ${name}`);
  }
  rir.setAttribute('aria-label',`Set ${n} RIR, ${name}`);
  for(const button of rir.children){
   const value=Number(button.dataset.rir);
   button.setAttribute('aria-pressed',String(current.rir===value));
   button.classList.toggle('is-placeholder',current.rir===null&&ph?.rir===value);
  }
  done.setAttribute('aria-pressed',String(current.done));done.setAttribute('aria-label',`Mark set ${n} done, ${name}`);
  remove.setAttribute('aria-label',`Remove set ${n}, ${name}`);
  li.classList.toggle('is-done',current.done);
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
 remove.addEventListener('click',()=>onRemove());
 rows.set(li,next=>{state={...state,...next};render();});
 render();
 return li;
}

/** Refresh a row in place; a focused or invalid field keeps the text being typed. */
export function updateSetRow(row,props){rows.get(row)?.(props);}
