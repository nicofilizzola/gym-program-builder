import {supersetBlocks} from './superset.js';
import {projectWorkout,setKey} from './workout-focus-model.js';
import {WORKOUT_LIMITS} from './workout-log.js';
import {setChip} from './workout-sets.js';
import {mountDialogMotion} from './dialog-motion.js';
import {mountSortable} from './sortable.js';

const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(label,run,text=label)=>{const n=el('button','secondary-btn',text);n.type='button';n.setAttribute('aria-label',label);n.onclick=run;return n;};

/** A single grouped jump/management surface. The logger remains the only writer. */
export function mountWorkoutOverview({port,onJump,onActivity=()=>{},onClose=()=>{}}){
 let dialog=null,motion=null,sortable=null,opener=null,snapshot=port.read(),viewed=null,destroyed=false,selected=null;
 const blocks=new Map(),closing=new Set();
 let list,picker,add,unsubscribe;
 function commands(ex,host){
  const actions=el('div','overview-actions');
  const run=type=>port.command({type,exerciseId:ex.id,host});
  const addSet=button(`Add set, ${ex.name}`,()=>run('add-set'),'Add set'),warm=button(`Add warm-up, ${ex.name}`,()=>run('add-warmup'),'Add warm-up');
  addSet.disabled=warm.disabled=ex.sets.length>=WORKOUT_LIMITS.sets;
  actions.append(addSet,warm,button(`Exercise note, ${ex.name}`,()=>run('exercise-note'),'Exercise note'),button(`Swap exercise ${ex.name}`,()=>run('swap'),'Swap'),button(`Remove exercise ${ex.name}`,()=>run('remove-exercise'),'Remove'));
  return actions;
 }
 function makeBlock(key){
  const li=el('li','overview-block'),head=el('header','overview-block-head'),title=el('h3',''),reorder=button('Reorder',()=>port.command({type:'reorder',exerciseId:key,opener:reorder})),unlink=button('Unlink superset',()=>port.command({type:'unlink',exerciseId:key})),content=el('div','overview-members');
  li.dataset.blockId=key;reorder.classList.add('reorder-action');reorder.setAttribute('aria-expanded','false');head.append(title,reorder,unlink);li.append(head,content);
  reorder.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const all=supersetBlocks(snapshot.log.exercises),at=all.findIndex(b=>snapshot.log.exercises[b.start].id===key),to=at+(e.key==='ArrowUp'?-1:1);if(to>=0&&to<all.length)port.command({type:'move-block',exerciseId:key,toBlockIndex:to});};
  return {li,title,reorder,unlink,content,members:new Map()};
 }
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 const CHECK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
 function makeMember(ex,pair){
  const member=el('section','overview-exercise'),h=el('h4','',ex.name),editor=el('div','overview-editor'),host=el('div','overview-picker'),chipsEl=el('div','overview-chips'),empty=el('p','focus-muted','No sets');
  chipsEl.setAttribute('role','group');chipsEl.setAttribute('aria-label',`Sets, ${ex.name}`);
  const m={member,h,editor,chipsEl,empty,name:ex.name,actions:null,chips:new Map(),rendered:false};
  m.actions=memberActions(ex,editor,host);member.append(h,m.actions,empty,chipsEl,editor,host);return m;
 }
 function memberActions(ex,editor,host){const actions=commands(ex,editor);actions.querySelectorAll('button').forEach(b=>{if(b.getAttribute('aria-label')?.startsWith('Swap exercise'))b.onclick=()=>port.command({type:'swap',exerciseId:ex.id,host});});return actions;}
 function reconcileChips(m,ex,items,current){
  const byId=new Map(items.map(i=>[i.ref.setId,i])),live=[];
  for(const s of ex.sets){const item=byId.get(s.id);if(!item)continue;
   let chip=m.chips.get(item.key);
   if(!chip){chip=el('button','overview-chip');chip.type='button';chip.dataset.setId=s.id;chip.append(el('span','overview-chip-text'));m.chips.set(item.key,chip);
    if(m.rendered){chip.classList.add('is-entering');requestAnimationFrame(()=>requestAnimationFrame(()=>chip.classList.remove('is-entering')));}}
   const {text,label}=setChip(s,{kindIndex:item.kindIndex,exercise:ex.name}),next=current&&item.key===setKey(current),partnerless=item.preview.label.includes('No partner');
   chip.firstChild.textContent=text;chip.setAttribute('aria-label',label+(next?', up next':'')+(partnerless?', no partner set this round':''));
   chip.classList.toggle('is-warmup',s.kind==='warmup');chip.classList.toggle('is-next',Boolean(next));chip.classList.toggle('is-done',Boolean(s.done));
   if(s.done&&!chip.querySelector('svg'))chip.insertAdjacentHTML('afterbegin',CHECK);else if(!s.done)chip.querySelector('svg')?.remove();
   if(viewed&&setKey(viewed)===item.key)chip.setAttribute('aria-current','step');else chip.removeAttribute('aria-current');
   chip.onclick=()=>{if(!viewed||setKey(viewed)!==item.key)selected=item.ref;close();};
   live.push([item.key,chip]);
  }
  const keep=new Set(live.map(([k])=>k));
  for(const [k,chip] of m.chips)if(!keep.has(k)){m.chips.delete(k);chip.inert=true;chip.classList.add('is-removing');closing.add(chip);if(reduced()){chip.remove();closing.delete(chip);}else setTimeout(()=>{chip.remove();closing.delete(chip);},200);}
  let pos=m.chipsEl.firstChild;
  for(const [,chip] of live){while(pos&&pos!==chip&&pos.classList.contains('is-removing'))pos=pos.nextSibling;if(pos===chip)pos=pos.nextSibling;else m.chipsEl.insertBefore(chip,pos);}
  m.empty.hidden=ex.sets.length>0;
 }
 function fillBlock(block,exercises,items,pair,current){
  for(const [id,m] of block.members)if(!exercises.some(e=>e.id===id)){m.member.remove();block.members.delete(id);}
  let at=null;
  for(const ex of exercises){
   let m=block.members.get(ex.id);if(!m){m=makeMember(ex,pair);block.members.set(ex.id,m);}
   if(m.name!==ex.name){m.name=ex.name;m.h.textContent=ex.name;m.chipsEl.setAttribute('aria-label',`Sets, ${ex.name}`);const next=memberActions(ex,m.editor,m.member.querySelector('.overview-picker'));m.actions.replaceWith(next);m.actions=next;}
   m.h.hidden=!pair;
   const adds=m.actions.querySelectorAll('button');adds[0].disabled=adds[1].disabled=ex.sets.length>=WORKOUT_LIMITS.sets;
   if(block.content.children[exercises.indexOf(ex)]!==m.member)block.content.insertBefore(m.member,block.content.children[exercises.indexOf(ex)]||null);
   reconcileChips(m,ex,items.filter(i=>i.ref.exerciseId===ex.id),current);m.rendered=true;
  }
 }
 function update(next,ref=viewed){snapshot=next;viewed=ref;if(!dialog||dialog.classList.contains('is-closing'))return;const projection=projectWorkout(snapshot.log),seen=new Set();
  supersetBlocks(snapshot.log.exercises).forEach((b,index)=>{const exercises=snapshot.log.exercises.slice(b.start,b.start+b.length),key=exercises[0].id;seen.add(key);let block=blocks.get(key);if(!block){block=makeBlock(key);blocks.set(key,block);}block.title.textContent=b.length===2?'Superset':exercises[0].name;block.reorder.textContent=b.length===2?`Reorder superset ${exercises.map(e=>e.name).join(' + ')}`:`Reorder ${exercises[0].name}`;block.unlink.hidden=b.length!==2;fillBlock(block,exercises,projection.items.filter(i=>exercises.some(e=>e.id===i.ref.exerciseId)),b.length===2,projection.current);if(list.children[index]!==block.li)list.insertBefore(block.li,list.children[index]||null);});
  for(const [key,b] of blocks)if(!seen.has(key)){blocks.delete(key);b.li.inert=true;b.li.classList.add('is-removing');closing.add(b.li);if(matchMedia('(prefers-reduced-motion:reduce)').matches){b.li.remove();closing.delete(b.li);}else setTimeout(()=>{b.li.remove();closing.delete(b.li);},200);}
  for(const b of blocks.values()){b.reorder.setAttribute('aria-label',b.reorder.textContent);b.reorder.textContent='Reorder';}
  add.disabled=snapshot.log.exercises.length>=WORKOUT_LIMITS.exercises;
 }
 function close(after){if(!dialog)return;port.command({type:'close-transient'});dialog.querySelector('form').inert=true;dialog._after=typeof after==='function'?after:null;motion.close();}
 function open(from){if(destroyed)return;opener=from;if(dialog){motion.open();return;}
  selected=null;dialog=el('dialog','catalog-dialog workout-overview');dialog.setAttribute('aria-label','Workout overview');const form=el('form','overview-body');form.onsubmit=e=>e.preventDefault();const header=el('header','overview-header');header.append(el('h2','','Workout overview'),button('Close overview',()=>close()));list=el('ol','overview-blocks');picker=el('div','overview-picker');add=button('Add exercise',()=>port.command({type:'add-exercise',host:picker}));form.append(header,list,add,picker);dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  motion=mountDialogMotion(dialog,{duration:200,onClosed(){const after=dialog?._after,closed=dialog;dialog=null;sortable?.destroy();sortable=null;blocks.clear();port.restoreExerciseNotes(closed);onActivity(false);if(selected)onJump(selected);else opener?.isConnected&&opener.focus({preventScroll:true});after?.();onClose();}});
  sortable=mountSortable(list,{itemSelector:'.overview-block:not(.is-removing)',reorderSelector:'.reorder-action',getGroups:()=>[{element:list,key:'overview'}],getKey:n=>n.dataset.blockId,onCommit:({key,beforeKey})=>{const ids=supersetBlocks(snapshot.log.exercises).map(b=>snapshot.log.exercises[b.start].id).filter(id=>id!==key),to=beforeKey?ids.indexOf(beforeKey):ids.length;port.command({type:'move-block',exerciseId:key,toBlockIndex:to});}});
  update(port.read());onActivity(true);motion.open();const cur=dialog.querySelector('[aria-current=step]');cur?.scrollIntoView({block:'nearest'});(cur||form.querySelector('button')).focus({preventScroll:true});
 }
 unsubscribe=port.subscribe(()=>update(port.read()));
 return {open,update,close,destroy(){if(destroyed)return;destroyed=true;unsubscribe();port.command({type:'close-transient'});sortable?.destroy();motion?.destroy();if(dialog)port.restoreExerciseNotes(dialog);for(const n of closing)n.remove();closing.clear();dialog=null;blocks.clear();onActivity(false);}};
}
