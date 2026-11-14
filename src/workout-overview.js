import {supersetBlocks} from './superset.js';
import {supersetSummary} from './superset-frame.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {mountReorderMenu} from './reorder-menu.js';
import {projectWorkout,setKey} from './workout-focus-model.js';
import {WORKOUT_LIMITS} from './workout-log.js';
import {setChip} from './workout-sets.js';
import {mountDialogMotion} from './dialog-motion.js';
import {mountSortable} from './sortable.js';

const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(label,run,text=label)=>{const n=el('button','secondary-btn',text);n.type='button';n.setAttribute('aria-label',label);n.onclick=run;return n;};

/** A single grouped jump/management surface. The logger remains the only writer. */
export function mountWorkoutOverview({port,onJump,onActivity=()=>{},onClose=()=>{}}){
 let dialog=null,motion=null,menu=null,tooltips=null,menuTrigger=null,sortable=null,opener=null,snapshot=port.read(),viewed=null,destroyed=false,selected=null;
 const blocks=new Map(),closing=new Set();
 let list,picker,add,unsubscribe;
 function makeBlock(key){
  const li=el('li','overview-block'),head=el('div','overview-pair-head'),title=el('p','superset-title'),summary=el('span',''),unlink=el('button','action-button'),content=el('div','overview-members');
  const reorder=el('button','action-button reorder-action');reorder.type='button';reorder.setAttribute('aria-expanded','false');reorder.innerHTML=actionIcon('reorder');reorder.onclick=()=>port.command({type:'reorder',exerciseId:key,opener:reorder});
  unlink.type='button';unlink.innerHTML=actionIcon('unlink');unlink.setAttribute('aria-label','Unlink superset');unlink.dataset.actionTooltip='Unlink superset';unlink.onclick=()=>port.command({type:'unlink',exerciseId:key});
  li.dataset.blockId=key;title.append(el('strong','superset-label','Superset'),' ',summary);head.append(title,unlink);li.append(head,content);
  reorder.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const all=supersetBlocks(snapshot.log.exercises),at=all.findIndex(b=>snapshot.log.exercises[b.start].id===key),to=at+(e.key==='ArrowUp'?-1:1);if(to>=0&&to<all.length)port.command({type:'move-block',exerciseId:key,toBlockIndex:to});};
  return {li,head,summary,reorder,unlink,content,members:new Map()};
 }
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 const CHECK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
 function makeMember(ex){
  const member=el('section','overview-exercise'),line=el('div','overview-line'),letter=el('span','overview-member'),nameEl=el('p','overview-name'),nameText=el('span','',ex.name),more=el('button','action-button overview-more'),editor=el('div','overview-editor'),host=el('div','overview-picker'),chipsEl=el('div','overview-chips'),empty=el('p','focus-muted','No sets');
  more.type='button';more.innerHTML=actionIcon('more');more.setAttribute('aria-haspopup','true');nameEl.append(nameText);line.append(letter,nameEl,more);
  chipsEl.setAttribute('role','group');chipsEl.setAttribute('aria-label',`Sets, ${ex.name}`);
  const m={member,line,letter,nameText,nameEl,more,editor,host,chipsEl,empty,name:null,tags:'',chips:new Map(),rendered:false};
  more.onclick=()=>{const cur=snapshot.log.exercises.find(e=>e.id===ex.id);if(cur)menu.toggle(more,menuItems(cur,m).map(i=>({...i,run:()=>{menuTrigger=more;Promise.resolve(i.run()).finally(()=>{menuTrigger=null;});}})));};
  member.append(line,empty,chipsEl,editor,host);return m;
 }
 function menuItems(ex,m){
  const last=kind=>[...ex.sets].reverse().find(s=>s.kind===kind),full=ex.sets.length>=WORKOUT_LIMITS.sets,run=(type,extra)=>()=>port.command({type,exerciseId:ex.id,...extra}),drop=(label,s)=>s&&{label,run:run('remove-set',{ref:{exerciseId:ex.id,setId:s.id}})};
  return [{label:'Add set',disabled:full,run:run('add-set')},{label:'Add warm-up',disabled:full,run:run('add-warmup')},{label:'Exercise note',run:run('exercise-note',{host:m.editor})},{label:'Swap exercise',run:run('swap',{host:m.host})},drop('Remove last set',last('working')),drop('Remove last warm-up',last('warmup')),{label:'Remove exercise',run:run('remove-exercise')}].filter(Boolean);
 }
 function reconcileChips(m,ex,items,current){
  const byId=new Map(items.map(i=>[i.ref.setId,i])),live=[];
  for(const s of ex.sets){const item=byId.get(s.id);if(!item)continue;
   let chip=m.chips.get(item.key);
   if(!chip){chip=el('button','overview-chip');chip.type='button';chip.dataset.setId=s.id;chip.append(chip.label=el('span','overview-chip-text'));m.chips.set(item.key,chip);
    if(m.rendered){chip.classList.add('is-entering');requestAnimationFrame(()=>requestAnimationFrame(()=>chip.classList.remove('is-entering')));}}
   const {text,label}=setChip(s,{kindIndex:item.kindIndex,exercise:ex.name}),next=current&&item.key===setKey(current),partnerless=item.preview.label.includes('No partner');
   chip.label.textContent=text;chip.setAttribute('aria-label',label+(next?', up next':'')+(partnerless?', no partner set this round':''));
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
  for(const ex of exercises){
   let m=block.members.get(ex.id);if(!m){m=makeMember(ex);block.members.set(ex.id,m);}
   const at=exercises.indexOf(ex);
   if(m.name!==ex.name){m.name=ex.name;m.nameText.textContent=ex.name;m.chipsEl.setAttribute('aria-label',`Sets, ${ex.name}`);const label=`Actions, ${ex.name}`;m.more.setAttribute('aria-label',label);m.more.dataset.actionTooltip=label;}
   const tags=[ex.brand,...(ex.focusTags??[])].filter(Boolean).join(' · ');
   if(m.tags!==tags){m.tags=tags;m.nameEl.querySelector('.overview-tags')?.remove();if(tags){const t=el('span','overview-tags');t.append(el('span','visually-hidden','Tags: '),tags);m.nameEl.append(t);}}
   m.letter.hidden=!pair;m.letter.textContent=`A${at+1}`;
   if(block.content.children[at]!==m.member)block.content.insertBefore(m.member,block.content.children[at]||null);
   reconcileChips(m,ex,items.filter(i=>i.ref.exerciseId===ex.id),current);m.rendered=true;
  }
 }
 function update(next,ref=viewed){snapshot=next;viewed=ref;if(!dialog||dialog.classList.contains('is-closing'))return;const projection=projectWorkout(snapshot.log),seen=new Set(),mores=[...list.querySelectorAll('.overview-more')].filter(n=>!n.closest('.is-removing')),fa=document.activeElement===document.body?menuTrigger:document.activeElement,own=fa?.closest?.('.overview-exercise')?.querySelector('.overview-more')??(fa?.classList?.contains('overview-more')?fa:null);
  supersetBlocks(snapshot.log.exercises).forEach((b,index)=>{const exercises=snapshot.log.exercises.slice(b.start,b.start+b.length),key=exercises[0].id,pair=b.length===2;seen.add(key);let block=blocks.get(key);if(!block){block=makeBlock(key);blocks.set(key,block);}
   block.li.classList.toggle('is-pair',pair);block.head.hidden=!pair;if(pair)block.summary.textContent=supersetSummary(exercises[0].superset);
   const label=pair?`Reorder superset ${exercises.map(e=>e.name).join(' + ')}`:`Reorder ${exercises[0].name}`;block.reorder.setAttribute('aria-label',label);block.reorder.dataset.actionTooltip=label;
   fillBlock(block,exercises,projection.items.filter(i=>exercises.some(e=>e.id===i.ref.exerciseId)),pair,projection.current);
   const home=pair?block.head:block.members.get(key).line;if(block.reorder.parentNode!==home)home.prepend(block.reorder);
   if(list.children[index]!==block.li)list.insertBefore(block.li,list.children[index]||null);});
  for(const [key,b] of blocks)if(!seen.has(key)){blocks.delete(key);b.li.inert=true;b.li.classList.add('is-removing');closing.add(b.li);
   if(reduced()){b.li.remove();closing.delete(b.li);}else setTimeout(()=>{b.li.remove();closing.delete(b.li);},200);}
  // A removed exercise takes focus with it: move to the next actions button, else the previous, else Add exercise.
  const live=n=>n.isConnected&&!n.closest('.is-removing'),at=mores.indexOf(own),now=[...list.querySelectorAll('.overview-more')].filter(live);
  if(own&&at>=0&&!live(own))(now[at]??now[at-1]?.closest(".overview-block").querySelector(".overview-more")??add).focus({preventScroll:true});
  add.disabled=snapshot.log.exercises.length>=WORKOUT_LIMITS.exercises;
 }
 function close(after){if(!dialog)return;menu?.close();port.command({type:'close-transient'});dialog.querySelector('form').inert=true;dialog._after=typeof after==='function'?after:null;motion.close();}
 function open(from){if(destroyed)return;opener=from;if(dialog){motion.open();return;}
  selected=null;dialog=el('dialog','catalog-dialog workout-overview');dialog.setAttribute('aria-label','Workout overview');const form=el('form','overview-body');form.onsubmit=e=>e.preventDefault();const header=el('header','overview-header');header.append(el('h2','','Workout overview'),button('Close overview',()=>close(),'Close'));list=el('ol','overview-blocks');picker=el('div','overview-picker');add=button('Add exercise',()=>port.command({type:'add-exercise',host:picker}));form.append(header,list,add,picker);dialog.append(form);document.body.append(dialog);menu=mountReorderMenu({label:'Exercise actions'});tooltips=mountActionTooltips(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  motion=mountDialogMotion(dialog,{duration:200,onClosed(){const after=dialog?._after,closed=dialog;dialog=null;menu.destroy();tooltips.destroy();menu=tooltips=null;sortable?.destroy();sortable=null;blocks.clear();port.restoreExerciseNotes(closed);onActivity(false);if(selected)onJump(selected);else opener?.isConnected&&opener.focus({preventScroll:true});after?.();onClose();}});
  sortable=mountSortable(list,{itemSelector:'.overview-block:not(.is-removing)',reorderSelector:'.reorder-action',getGroups:()=>[{element:list,key:'overview'}],getKey:n=>n.dataset.blockId,onCommit:({key,beforeKey})=>{const ids=supersetBlocks(snapshot.log.exercises).map(b=>snapshot.log.exercises[b.start].id).filter(id=>id!==key),to=beforeKey?ids.indexOf(beforeKey):ids.length;port.command({type:'move-block',exerciseId:key,toBlockIndex:to});}});
  update(port.read());onActivity(true);motion.open();const cur=dialog.querySelector('[aria-current=step]');cur?.scrollIntoView({block:'nearest'});(cur||form.querySelector('button')).focus({preventScroll:true});
 }
 unsubscribe=port.subscribe(()=>update(port.read()));
 return {open,update,close,destroy(){if(destroyed)return;destroyed=true;unsubscribe();port.command({type:'close-transient'});sortable?.destroy();menu?.destroy();tooltips?.destroy();motion?.destroy();if(dialog)port.restoreExerciseNotes(dialog);for(const n of closing)n.remove();closing.clear();dialog=null;blocks.clear();onActivity(false);}};
}
