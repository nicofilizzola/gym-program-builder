import {mountWorkoutNote} from './workout-note.js';
import {formatElapsed} from './workout-sets.js';
import {actionIcon} from './action-controls.js';

const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
const working=ex=>ex.sets.filter(s=>s.kind!=='warmup');

/** Sync wording from the controller's actual state: a local finish is never described as saved. */
function syncLine(state){
 if(state.record)return 'Saved to your history.';
 if(state.blocked)return 'Finished on this device. It needs your attention before it can sync.';
 return 'Finished on this device. It will sync automatically.';
}

/**
 * Transient recap after an explicit Focus finish. Renders the actual post-pruning snapshot; `planned` maps each
 * exercise id to its working-set count before Finish, for honest partial-work context. The workout note is editable
 * only once the acknowledged record has been handed to the finished-log autosave.
 */
export function mountWorkoutRecap(host,{state,planned=new Map(),onDone=()=>{},onView=()=>{},onNote=()=>{}}){
 let current=state,note=null,editable=null;
 const root=el('section','workout-recap');root.setAttribute('aria-labelledby','workout-recap-title');
 const mark=el('div','recap-mark');mark.setAttribute('aria-hidden','true');mark.innerHTML=actionIcon('check');
 const eyebrow=el('p','focus-eyebrow'),heading=el('h2','recap-title','Good work.');heading.id='workout-recap-title';heading.tabIndex=-1;
 const summary=el('p','recap-summary'),sync=el('p','recap-sync'),statusSlot=el('div','recap-status'),saveSlot=el('div','recap-save-slot');
 const list=el('ul','recap-exercises'),skipped=el('p','recap-skipped'),noteHost=el('div','recap-note logger-note');
 const actions=el('div','recap-actions'),done=el('button','add-btn recap-done','Done'),view=el('button','secondary-btn recap-view','View workout');
 done.type=view.type='button';done.onclick=()=>onDone();view.onclick=()=>onView();actions.append(done,view);
 root.append(mark,eyebrow,heading,summary,sync,statusSlot,saveSlot,list,skipped,noteHost,actions);host.append(root);

 function mountNote(){
  const next=Boolean(current.record&&!current.pending&&!current.blocked);
  if(next===editable)return;
  editable=next;note?.destroy();noteHost.replaceChildren();
  note=mountWorkoutNote(noteHost,{note:current.log.note??'',readOnly:!editable,onInput:text=>onNote(text,{blur:false}),onBlur:text=>onNote(text,{blur:true})});
 }
 function render(){
  const log=current.log,minutes=log.finishedAt?formatElapsed(Date.parse(log.finishedAt)-Date.parse(log.startedAt)):'';
  eyebrow.textContent=current.record?'Workout complete':'Workout finished';
  summary.textContent=[log.name,minutes].filter(Boolean).join(' · ');
  sync.textContent=syncLine(current);statusSlot.hidden=Boolean(current.record);
  list.replaceChildren(...log.exercises.map(ex=>{
   const logged=working(ex).length,total=Math.max(planned.get(ex.id)??logged,logged),row=el('li','recap-exercise'),icon=el('span','recap-icon');
   icon.setAttribute('aria-hidden','true');icon.innerHTML=logged===total?actionIcon('check'):'';
   const text=el('div','recap-exercise-text'),name=el('span','recap-exercise-name',ex.name);
   text.append(name,el('small','',logged===total?`Completed · ${logged} working ${logged===1?'set':'sets'}`:`${logged} of ${total} working sets logged`));
   row.append(icon,text);return row;
  }));
  const kept=new Set(log.exercises.map(ex=>ex.id)),missing=[...planned.keys()].filter(id=>!kept.has(id)).length;
  skipped.hidden=!missing;skipped.textContent=missing?`${missing} planned ${missing===1?'exercise was':'exercises were'} not logged.`:'';
  mountNote();
 }
 render();
 return {
  root,
  update(next){current=next;render();},
  focus(){heading.focus({preventScroll:true});},
  statusSlot:()=>statusSlot,
  saveStatusSlot:()=>saveSlot,
  destroy(){note?.destroy();root.remove();}
 };
}
