import {supersetBlocks} from './superset.js';
import {projectWorkout,setKey} from './workout-focus-model.js';
import {WORKOUT_LIMITS} from './workout-log.js';
import {formatRir} from './workout-sets.js';
import {mountDialogMotion} from './dialog-motion.js';
import {mountSortable} from './sortable.js';
import {actionIcon} from './action-controls.js';

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
  return {li,title,reorder,unlink,content,signature:null,rows:new Map(),members:new Map()};
 }
 function fillBlock(block,exercises,items,pair){
  const signature=JSON.stringify(exercises.map(e=>[e.id,e.name,e.sets.map(s=>[s.id,s.kind]),Boolean(e.superset)]));
  if(block.signature!==signature){
   // Preserve a borrowed editor even when the set structure changes.
   const editors=[...block.members].map(([id,m])=>[id,m.editor]);
   block.content.replaceChildren();block.rows.clear();block.members.clear();block.signature=signature;
   for(const ex of exercises){const member=el('section','overview-exercise'),h=el('h4','',ex.name),editor=editors.find(([id])=>id===ex.id)?.[1]??el('div','overview-editor'),host=el('div','overview-picker');h.hidden=!pair;member.append(h,commands(ex,editor),editor,host);member.querySelectorAll('button').forEach(b=>{if(b.getAttribute('aria-label')?.startsWith('Swap exercise'))b.onclick=()=>port.command({type:'swap',exerciseId:ex.id,host});});block.content.append(member);block.members.set(ex.id,{member,editor});}
   const rounds=el('div','overview-rounds');block.content.append(rounds);let group=null,last=null;
   for(const item of items){const groupKey=item.kind==='warmup'?'Warm-ups':pair?`Round ${item.round}`:'Working sets';if(last!==groupKey){group=el('section','overview-set-group');group.append(el('h4','',groupKey));rounds.append(group);last=groupKey;}
    const ex=exercises.find(e=>e.id===item.ref.exerciseId),line=el('div','overview-set-line'),label=`${item.kind==='warmup'?'Warm-up':'Working set'} ${item.kindIndex}, ${ex.name}`,jump=button(label,()=>{selected=item.ref;close();}),summary=el('span','overview-set-summary'),note=button(`Set note, ${label}`,()=>{selected=item.ref;close(()=>port.command({type:'set-note',ref:item.ref}));}),remove=button(`Remove ${label}`,()=>port.command({type:'remove-set',ref:item.ref}));
    jump.textContent=`${item.kind==='warmup'?'Warm-up':'Set'} ${item.kindIndex}${pair?' · '+ex.name:''}`;note.innerHTML=actionIcon('note');remove.innerHTML=actionIcon('delete');note.classList.add('action-button');remove.classList.add('action-button');
    line.append(jump,summary,note,remove);if(pair&&item.kind==='working'&&item.preview.label.includes('No partner'))line.append(el('p','focus-muted','No partner set this round'));group.append(line);block.rows.set(item.key,{jump,summary,ref:item.ref});
   }
  }
  for(const ex of exercises){const member=block.members.get(ex.id);const adds=member.member.querySelectorAll('.overview-actions button');adds[0].disabled=adds[1].disabled=ex.sets.length>=WORKOUT_LIMITS.sets;}
  for(const item of items){const row=block.rows.get(item.key),ex=exercises.find(e=>e.id===item.ref.exerciseId),s=ex.sets.find(s=>s.id===item.ref.setId);row.jump.setAttribute('aria-current',viewed&&setKey(viewed)===item.key?'step':'false');row.summary.textContent=`${s.done?'Complete · ':''}${s.weightKg??'BW'}${s.weightKg===null?'':' kg'} · ${s.reps??'—'} reps${s.rir===null||item.kind==='warmup'?'':` · ${formatRir(s.rir)} RIR`}`;}
 }
 function update(next,ref=viewed){snapshot=next;viewed=ref;if(!dialog||dialog.classList.contains('is-closing'))return;const projection=projectWorkout(snapshot.log),seen=new Set();
  supersetBlocks(snapshot.log.exercises).forEach((b,index)=>{const exercises=snapshot.log.exercises.slice(b.start,b.start+b.length),key=exercises[0].id;seen.add(key);let block=blocks.get(key);if(!block){block=makeBlock(key);blocks.set(key,block);}block.title.textContent=b.length===2?'Superset':exercises[0].name;block.reorder.textContent=b.length===2?`Reorder superset ${exercises.map(e=>e.name).join(' + ')}`:`Reorder ${exercises[0].name}`;block.unlink.hidden=b.length!==2;fillBlock(block,exercises,projection.items.filter(i=>exercises.some(e=>e.id===i.ref.exerciseId)),b.length===2);if(list.children[index]!==block.li)list.insertBefore(block.li,list.children[index]||null);});
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
  update(port.read());onActivity(true);motion.open();form.querySelector('button').focus({preventScroll:true});
 }
 unsubscribe=port.subscribe(()=>update(port.read()));
 return {open,update,close,destroy(){if(destroyed)return;destroyed=true;unsubscribe();port.command({type:'close-transient'});sortable?.destroy();motion?.destroy();if(dialog)port.restoreExerciseNotes(dialog);for(const n of closing)n.remove();closing.clear();dialog=null;blocks.clear();onActivity(false);}};
}
