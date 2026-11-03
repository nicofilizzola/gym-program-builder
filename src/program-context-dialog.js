import {PROGRAM_CONTEXT_FIELDS,PROGRAM_CONTEXT_MAX_LENGTH,normalizeProgramContext} from './program-context.js';

let sequence=0;
const labels=['Goals and priorities'];
const examples=['Build muscle, prioritize side delts and upper chest, maintain legs.'];

/** Keeps prose controls alive across acknowledgements and shared-template refreshes. */
export function mountProgramContextDialog({anchor,getContext,onChange,onBeforeOpen=()=>{}}){
 const id='program-context-'+(++sequence),events=new AbortController(),options={signal:events.signal},reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const dialog=document.createElement('dialog'),exit=document.createElement('div'),content=document.createElement('div');
 dialog.className='catalog-dialog program-context-surface';exit.className='catalog-dialog program-context-surface program-context-exit';exit.popover='manual';
 content.className='program-context-content';content.innerHTML=`<h2 id="${id}">Program context</h2><p class="program-context-intro">Optional context for your hypertrophy review. Saved with this program and included when you analyze it.</p>`;
 const inputs=new Map(),composing=new Set();
 PROGRAM_CONTEXT_FIELDS.forEach((key,i)=>{
  const field=document.createElement('div');field.className='field';
  const label=document.createElement('label'),input=document.createElement('textarea'),help=document.createElement('p');
  input.id=id+'-'+key;input.name=key;input.rows=3;input.maxLength=PROGRAM_CONTEXT_MAX_LENGTH;label.htmlFor=input.id;label.textContent=labels[i];
  help.id=input.id+'-help';help.className='program-context-help';help.textContent='Example: '+examples[i];input.setAttribute('aria-describedby',help.id);
  input.addEventListener('compositionstart',()=>composing.add(key),options);input.addEventListener('compositionend',()=>{composing.delete(key);refresh();},options);
  input.addEventListener('input',()=>{
   try{const value=normalizeProgramContext(Object.fromEntries([...inputs].map(([name,el])=>[name,el.value])));last={...value};error.textContent='';onChange(value);}catch(e){error.textContent=e.message;}
  },options);
  field.append(label,input,help);content.append(field);inputs.set(key,input);
 });
 const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');
 const footer=document.createElement('div');footer.className='program-context-actions';
 const note=document.createElement('p');note.className='program-context-help';note.textContent='These notes are included in program exports.';
 const done=document.createElement('button');done.type='button';done.className='add-btn';done.textContent='Done';footer.append(note,done);content.append(error,footer);dialog.append(content);
 dialog.setAttribute('aria-labelledby',id);document.body.append(dialog,exit);anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-expanded','false');
 let opened=false,closing=false,destroyed=false,timer=null,last=normalizeProgramContext();
 function refresh(){
  if(destroyed)return;
  let next;try{next=normalizeProgramContext(getContext());error.textContent='';}catch(e){error.textContent=e.message;return;}
  for(const [key,input]of inputs){
   if(composing.has(key))continue;
   if(next[key]!==last[key]||!opened&&!closing){const start=input.selectionStart,end=input.selectionEnd,active=document.activeElement===input;input.value=next[key];if(active)input.setSelectionRange(Math.min(start,input.value.length),Math.min(end,input.value.length));}
   last[key]=next[key];
  }
 }
 function finishClose(){clearTimeout(timer);timer=null;if(opened||destroyed)return;if(exit.matches(':popover-open'))exit.hidePopover();exit.classList.remove('is-open');closing=false;}
 function close({restoreFocus=true}={}){
  if(!opened||destroyed)return;opened=false;closing=true;anchor.setAttribute('aria-expanded','false');
  const rect=dialog.getBoundingClientRect(),scrollTop=dialog.scrollTop;dialog.close();exit.append(content);Object.assign(exit.style,{inset:'auto',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',maxHeight:rect.height+'px',margin:'0'});
  exit.inert=true;exit.setAttribute('aria-hidden','true');exit.classList.add('is-open');exit.showPopover();exit.scrollTop=scrollTop;exit.getBoundingClientRect();
  if(restoreFocus&&anchor.isConnected)anchor.focus({preventScroll:true});exit.classList.remove('is-open');
  clearTimeout(timer);if(reduced.matches)finishClose();else timer=setTimeout(finishClose,180);
 }
 function open(){
  if(destroyed||opened)return;onBeforeOpen();clearTimeout(timer);timer=null;
  if(exit.matches(':popover-open'))exit.hidePopover();exit.classList.remove('is-open');dialog.append(content);closing=false;
  refresh();opened=true;anchor.setAttribute('aria-expanded','true');dialog.classList.remove('is-open');dialog.showModal();dialog.scrollTop=0;dialog.getBoundingClientRect();dialog.classList.add('is-open');inputs.get(PROGRAM_CONTEXT_FIELDS[0]).focus({preventScroll:true});
 }
 anchor.addEventListener('click',open,options);done.addEventListener('click',()=>close(),options);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();},options);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();},options);
 const motionChanged=()=>{if(reduced.matches&&closing)finishClose();};reduced.addEventListener('change',motionChanged);
 refresh();
 return {open,close,refresh,destroy(){destroyed=true;clearTimeout(timer);events.abort();reduced.removeEventListener('change',motionChanged);if(dialog.open)dialog.close();if(exit.matches(':popover-open'))exit.hidePopover();dialog.remove();exit.remove();}};
}
