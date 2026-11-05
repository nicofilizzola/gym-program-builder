import {mountDialogMotion} from './dialog-motion.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {durationLabel} from './duration.js';
import {upNextProgram,upNextOccurrence,occurrenceLabels,sessionOrder} from './workout-up-next.js';

const svg=path=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
const CLOSE=svg('<path d="M6 6l12 12M18 6 6 18"/>'),CHEVRON=svg('<path d="m6 9 6 6 6-6"/>');
const narrow=()=>matchMedia('(max-width:760px)').matches;
const SWIPE_DISTANCE=80,SWIPE_VELOCITY=0.5;
let sheets=0;

const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const programName=record=>record.name.trim()||'Untitled program';
const sessionName=workout=>workout.name?.trim()||'Untitled template';
const exerciseCount=n=>`${n} ${n===1?'exercise':'exercises'}`;

/**
 * Opens the Start workout sheet: a bottom sheet at ≤760px, a dialog above. Lists come from the caller
 * (null = failed to load); program sessions load on demand once per sheet. `onStart` runs after the sheet closed.
 */
export function openWorkoutStartSheet({programs,templates,logs=[],loadProgram,loadTemplate,onStart,onNavigate,onRetryList,now=new Date()}){
 const invoker=document.activeElement,uid=`start-sheet-${++sheets}`;
 const dialog=document.createElement('dialog');
 dialog.className='catalog-dialog start-sheet';dialog.setAttribute('aria-labelledby',`${uid}-title`);
 dialog.innerHTML=`<form method="dialog" class="start-sheet-form">
<div class="start-sheet-grab"><div class="start-sheet-handle" aria-hidden="true"></div>
<header class="start-sheet-header"><h2 id="${uid}-title">Start workout</h2><button type="button" class="action-button" data-close aria-label="Close" data-action-tooltip="Close">${CLOSE}</button></header></div>
<div class="start-sheet-tabs"><div class="start-sheet-tablist" role="tablist" aria-label="Start from">
<button type="button" role="tab" id="${uid}-tab-program" aria-controls="${uid}-panel-program" data-tab="program">Program</button>
<button type="button" role="tab" id="${uid}-tab-template" aria-controls="${uid}-panel-template" data-tab="template">Template</button></div>
<button type="button" class="secondary-btn start-sheet-blank" data-blank>Blank workout</button></div>
<div class="start-sheet-body">
<div role="tabpanel" id="${uid}-panel-program" aria-labelledby="${uid}-tab-program" data-panel="program"></div>
<div role="tabpanel" id="${uid}-panel-template" aria-labelledby="${uid}-tab-template" data-panel="template" hidden></div>
</div></form>`;
 const $=selector=>dialog.querySelector(selector);
 const tabs=[...dialog.querySelectorAll('[role=tab]')],panels={program:$('[data-panel=program]'),template:$('[data-panel=template]')};
 let resolveClosed,starting=false;
 const closed=new Promise(resolve=>{resolveClosed=resolve;});
 const tips=mountActionTooltips(dialog);
 const motion=mountDialogMotion(dialog,{duration:()=>narrow()?200:150,onClosed:()=>{tips?.destroy?.();if(invoker?.isConnected)invoker.focus({preventScroll:true});resolveClosed();}});
 const close=()=>{dialog.style.transform='';dialog.style.transition='';motion.close();};

 // Programs load once per sheet; a failed load is forgotten so Retry asks again.
 const cache=new Map();
 const getProgram=id=>{
  if(!cache.has(id)){
   const promise=Promise.resolve().then(()=>loadProgram(id)).then(program=>({...program,id}));
   promise.catch(()=>{if(cache.get(id)===promise)cache.delete(id);});
   cache.set(id,promise);
  }
  return cache.get(id);
 };

 function setBusy(on){
  starting=on;
  for(const button of dialog.querySelectorAll('.start-sheet-tabs button,.start-sheet-body button'))button.disabled=on;
 }
 async function start(options){
  if(starting)return;setBusy(true);close();await closed;onStart(options);
 }
 async function navigateTo(hash){close();await closed;onNavigate(hash);}

 function select(name,{focus=false}={}){
  for(const tab of tabs){const on=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on&&focus)tab.focus();}
  for(const [key,panel] of Object.entries(panels))panel.hidden=key!==name;
 }
 const selectedTab=()=>tabs.find(tab=>tab.getAttribute('aria-selected')==='true');

 function listError(panel,kind,message){
  panel.replaceChildren();
  const text=el('p','start-sheet-error',message);text.setAttribute('role','alert');
  const retry=el('button','secondary-btn','Retry');retry.type='button';
  retry.addEventListener('click',async()=>{
   retry.disabled=true;
   try{const list=await onRetryList(kind);if(kind==='program'){programs=list;renderPrograms();}else{templates=list;renderTemplates();}}
   catch{retry.disabled=false;}
  });
  panel.append(text,retry);
 }
 function empty(panel,message,label,hash){
  const text=el('p','start-sheet-empty',message+' '),link=el('a','',label);link.href=hash;
  link.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey)return;event.preventDefault();navigateTo(hash);});
  text.append(link);panel.replaceChildren(text);
 }

 function sessionButton(workout,label,record,className){
  const button=el('button',className);button.type='button';
  const meta=[...(label.short==='Unscheduled'?[]:[label.short]),exerciseCount(workout.exercises.length),durationLabel(workout)].join(' · ');
  button.addEventListener('click',()=>start({template:{id:workout.templateId,document:workout},program:{id:record.id,name:programName(record)},occurrenceId:workout.id}));
  return {button,meta};
 }

 function renderNext(slot,record){
  const status=el('p','start-sheet-hint','Finding your next session…');status.setAttribute('role','status');slot.replaceChildren(status);
  getProgram(record.id).then(program=>{
   if(!slot.isConnected)return;
   const next=upNextOccurrence(program,logs,now),workout=next&&program.workouts.find(w=>w.id===next.occurrenceId);
   if(!workout){slot.replaceChildren();return;}
   const {button,meta}=sessionButton(workout,occurrenceLabels(program).get(workout.id),record,'start-sheet-next');
   button.setAttribute('aria-label',`Up next: ${sessionName(workout)}, ${programName(record)}`);
   button.append(el('span','start-sheet-next-label',`Up next · ${programName(record)}`),el('span','start-sheet-next-name',sessionName(workout)),el('span','start-sheet-meta',meta));
   const play=el('span','start-sheet-play');play.innerHTML=actionIcon('start');play.append('Start');button.append(play);
   button.disabled=starting;
   const focusCard=document.activeElement===selectedTab()||!dialog.contains(document.activeElement);
   slot.replaceChildren(button);
   if(focusCard&&!panels.program.hidden)button.focus();
  },()=>{if(slot.isConnected)slot.replaceChildren();});
 }

 function fillProgram(region,record){
  const inner=region.firstElementChild;
  const status=el('p','start-sheet-hint','Loading…');status.setAttribute('role','status');inner.replaceChildren(status);
  getProgram(record.id).then(program=>{
   const labels=occurrenceLabels(program),order=sessionOrder(program);
   if(!order.length){inner.replaceChildren(el('p','start-sheet-empty','No sessions in this program.'));return;}
   const list=el('ul','start-sheet-sessions');let grouped=false;
   for(const id of order){
    const workout=program.workouts.find(w=>w.id===id),label=labels.get(id);
    if(label.short==='Unscheduled'&&!grouped){grouped=true;list.append(el('li','start-sheet-group','Unscheduled'));}
    const {button,meta}=sessionButton(workout,label,record,'start-sheet-session');
    button.setAttribute('aria-label',`Start ${sessionName(workout)}, ${programName(record)}, ${label.long}`);
    button.append(el('span','start-sheet-session-name',sessionName(workout)),el('span','start-sheet-meta',meta));
    button.disabled=starting;
    const item=el('li');item.append(button);list.append(item);
   }
   inner.replaceChildren(list);region.dataset.ready='';
  },()=>{
   const text=el('p','start-sheet-error',"Couldn't load this program.");text.setAttribute('role','alert');
   const retry=el('button','secondary-btn','Retry');retry.type='button';retry.addEventListener('click',()=>fillProgram(region,record));
   inner.replaceChildren(text,retry);
  });
 }

 function renderPrograms(){
  const panel=panels.program;
  if(programs===null){listError(panel,'program',"Couldn't load programs.");return;}
  if(!programs.length){empty(panel,'No programs yet.','Go to Programs','#/programs');return;}
  const nextId=upNextProgram(programs,logs),slot=el('div','start-sheet-next-slot'),list=el('ul','start-sheet-programs');
  programs.forEach((record,index)=>{
   const item=el('li','start-sheet-program'),toggle=el('button','start-sheet-program-toggle'),region=el('div','collapsible start-sheet-program-region');
   const open=record.id===nextId;
   toggle.type='button';toggle.id=`${uid}-program-${index}`;region.id=`${uid}-program-${index}-sessions`;
   toggle.setAttribute('aria-controls',region.id);toggle.setAttribute('aria-expanded',String(open));
   toggle.append(el('span','start-sheet-program-name',programName(record)));toggle.insertAdjacentHTML('beforeend',CHEVRON);
   region.setAttribute('role','region');region.setAttribute('aria-labelledby',toggle.id);
   region.append(el('div','start-sheet-program-inner'));
   if(!open){region.classList.add('is-closed');region.inert=true;}
   toggle.addEventListener('click',()=>{
    const expand=toggle.getAttribute('aria-expanded')!=='true';
    toggle.setAttribute('aria-expanded',String(expand));region.classList.toggle('is-closed',!expand);region.inert=!expand;
    if(expand&&!('ready' in region.dataset)&&!region.querySelector('.start-sheet-hint'))fillProgram(region,record);
   });
   item.append(toggle,region);list.append(item);
   if(open)fillProgram(region,record);
  });
  panel.replaceChildren(slot,list);
  if(nextId)renderNext(slot,programs.find(p=>p.id===nextId));
 }

 function renderTemplates(){
  const panel=panels.template;
  if(templates===null){listError(panel,'template',"Couldn't load session templates.");return;}
  if(!templates.length){empty(panel,'No session templates yet.','Go to Session templates','#/templates');return;}
  const list=el('ul','start-sheet-sessions');
  for(const record of templates){
   const name=record.name.trim()||'Untitled template',button=el('button','start-sheet-session'),item=el('li');
   button.type='button';button.setAttribute('aria-label',`Start ${name}`);button.append(el('span','start-sheet-session-name',name));
   button.addEventListener('click',async()=>{
    if(starting)return;
    panel.querySelector('.start-sheet-error')?.remove();setBusy(true);
    let template;
    try{template=await loadTemplate(record.id);}
    catch{setBusy(false);const error=el('p','start-sheet-error',"Couldn't load this template. Try again.");error.setAttribute('role','alert');item.append(error);return;}
    setBusy(false);start({template:{id:template.id,document:template.document}});
   });
   item.append(button);list.append(item);
  }
  panel.replaceChildren(list);
 }

 // Swipe down on the handle or header closes the bottom sheet; a short drag springs back.
 const grab=$('.start-sheet-grab');let drag=null;
 grab.addEventListener('pointerdown',event=>{
  if(!narrow()||event.button!==0||event.target.closest('button'))return;
  event.preventDefault(); // no text selection or native drag, which would cancel the pointer
  drag={id:event.pointerId,y:event.clientY,dy:0,t:event.timeStamp,v:0};grab.setPointerCapture(event.pointerId);dialog.style.transition='none';
 });
 grab.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dy=Math.max(0,event.clientY-drag.y),dt=event.timeStamp-drag.t;
  if(dt>0)drag.v=(dy-drag.dy)/dt;drag.dy=dy;drag.t=event.timeStamp;dialog.style.transform=`translateY(${dy}px)`;
 });
 const release=event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const {dy,v}=drag;drag=null;dialog.style.transition='';
  if(event.type==='pointerup'&&(dy>SWIPE_DISTANCE||v>SWIPE_VELOCITY))close();else dialog.style.transform='';
 };
 grab.addEventListener('pointerup',release);grab.addEventListener('pointercancel',release);

 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 $('[data-close]').addEventListener('click',close);
 $('[data-blank]').addEventListener('click',()=>start({}));
 tabs.forEach(tab=>tab.addEventListener('click',()=>select(tab.dataset.tab)));
 $('[role=tablist]').addEventListener('keydown',event=>{
  const index=tabs.indexOf(document.activeElement);if(index<0)return;
  const target={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
  if(target===undefined)return;event.preventDefault();select(tabs[target].dataset.tab,{focus:true});
 });

 renderPrograms();renderTemplates();
 select(programs===null||programs.length?'program':'template');
 document.body.append(dialog);motion.open();
 const card=$('.start-sheet-next');(card&&!panels.program.hidden?card:selectedTab()).focus();
 return {close,closed};
}
