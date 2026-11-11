import {WORKOUT_LIMITS,normalizeNote} from './workout-log.js';

/** Owns note presentation only. The logger owns persistence and canonical text. */
export function mountWorkoutNote(host,{note='',readOnly=false,collapsed=false,onInput=()=>{},onBlur=()=>{}}){
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),parts=new Set();
 let editing=false,current=null,kind=null,destroyed=false,composing=false;
 const grow=field=>{field.style.height='auto';field.style.height=field.scrollHeight+'px';};
 function remove(part){clearTimeout(part.timer);part.remove();parts.delete(part);if(kind==='none'&&!parts.size)host.hidden=true;}
 function close(part,animate){
  part.inert=true;part.setAttribute('aria-hidden','true');part.classList.add('is-closed');
  if(!animate||motion.matches){remove(part);return;}
  part.timer=setTimeout(()=>remove(part),320);
  part.addEventListener('transitionend',event=>{if(event.target===part&&event.propertyName==='grid-template-rows')remove(part);},{once:true});
 }
 function render(animate=false){
  if(destroyed)return;
  // Collapsed hosts (phone Focus) show the note only while it is being edited.
  const next=readOnly?(note&&!collapsed?'static':'none'):editing?'edit':collapsed?'none':note?'text':'add';
  host.classList.toggle('is-editing',editing);
  if(next!==kind){
   if(current)close(current,animate);
   kind=next;current=null;
   if(next!=='none'){
    const part=document.createElement('div'),inner=document.createElement('div');part.className='log-note-part collapsible';part.append(inner);parts.add(part);current=part;
    let field;
    if(next==='edit'){
     field=document.createElement('textarea');field.className='log-note-input';field.rows=2;field.maxLength=WORKOUT_LIMITS.workoutNoteMax;field.setAttribute('aria-label','Workout note');
     field.addEventListener('compositionstart',()=>{composing=true;});field.addEventListener('compositionend',()=>{composing=false;note=field.value;onInput(note);});
     field.addEventListener('input',()=>{note=field.value;grow(field);onInput(note);});
     field.addEventListener('blur',()=>{
      if(destroyed||current!==part)return;
      composing=false;note=normalizeNote(field.value);onBlur(note);editing=false;render(true);
      // After the focus move settles: only rescue focus that landed nowhere, never steal a tapped target.
      setTimeout(()=>{if(!destroyed&&document.activeElement===document.body)current?.querySelector('button')?.focus({preventScroll:true});});
     });
    }else if(next==='static'){field=document.createElement('p');field.className='log-note-static';}
    else{
     field=document.createElement('button');field.type='button';field.className=next==='add'?'log-note-add':'log-note-text';field.setAttribute('aria-label',next==='add'?'Add workout note':'Edit workout note');
     field.addEventListener('click',open);
    }
    inner.append(field);
    if(animate&&!motion.matches)part.classList.add('is-closed');host.append(part);
    if(animate){getComputedStyle(part).gridTemplateRows;part.classList.remove('is-closed');}
   }
  }
  host.hidden=next==='none'&&!parts.size;
  const field=current?.querySelector('button,textarea,p');if(!field)return;
  if(next==='edit'){if(document.activeElement!==field&&!composing)field.value=note;grow(field);}
  else field.textContent=next==='add'?'Add note':note;
 }
 function open(){
  if(destroyed||readOnly)return;
  editing=true;render(true);const input=current.querySelector('textarea');input.focus();input.setSelectionRange(input.value.length,input.value.length);
 }
 const settle=()=>{if(motion.matches)for(const part of parts)if(part!==current)remove(part);};motion.addEventListener('change',settle);
 render();
 return {
  update(value){note=value.note??'';readOnly=value.readOnly;collapsed=Boolean(value.collapsed);render();},
  open,
  isEditing:()=>editing,
  destroy(){destroyed=true;motion.removeEventListener('change',settle);for(const part of parts)remove(part);}
 };
}
