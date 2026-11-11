import {projectWorkout,focusFallback,setKey,completionMilestone} from './workout-focus-model.js';
import {createWorkoutAdvance} from './workout-focus-advance.js';
import {setRowBindings} from './workout-set-row.js';
import {mountWorkoutRuler} from './workout-ruler.js';
import {mountWorkoutTitle} from './workout-title.js';
import {mountWorkoutHistory} from './workout-history-summary.js';
import {actionIcon} from './action-controls.js';
import {focusCardFit,stackHeight} from './workout-focus-fit.js';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
const same=(a,b)=>a===b||Boolean(a&&b&&setKey(a)===setKey(b));
const noteIcon=()=>actionIcon('edit');

/** Borrows canonical row/control nodes. All edits still go through the logger port. */
export function mountWorkoutFocus(host,{port,ui,onInteraction=()=>{},onViewed=()=>{},onFinish=()=>{}}){
 let enabled=false,destroyed=false,suspended=false,viewed=ui.viewed,snapshot=port.read(),projection=projectWorkout(snapshot.log),scrollFrame=null,fitFrame=null,programmatic=false,measuring=0,feedHeight=null;
 const state={autoNext:ui.autoNext,weightIncrement:ui.weightIncrement},cards=new Map(),events=new AbortController(),{signal}=events;
 const rewarded=new Set(),animationTimers=new Set(),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const advance=createWorkoutAdvance({read:()=>({log:snapshot.log,viewed,autoNext:state.autoNext,suspended:!enabled||suspended||typingField()||Boolean(document.querySelector('dialog[open]'))}),onAdvance:ref=>jump(ref,{animate:true,focus:true}),reduced:()=>reduced.matches});
 const root=node('section','workout-focus'),progress=node('div','focus-progress'),meta=node('div','focus-progress-meta'),position=node('span',''),count=node('span',''),segments=node('div','focus-progress-segments');
 meta.append(position,count);progress.append(meta,segments);
 const feed=node('ol','focus-feed');feed.tabIndex=0;feed.setAttribute('aria-label','Workout sets');
 const review=node('li','focus-review');review.innerHTML='<p class="focus-eyebrow">Your workout</p><h2 tabindex="-1">Make it a good finish.</h2><p class="focus-review-copy"></p><button type="button" class="add-btn">Finish workout</button><p class="focus-muted">Finishing is always your choice.</p>';review.querySelector('button').onclick=()=>onFinish();feed.append(review);
 const empty=node('div','focus-empty');empty.innerHTML='<h2>No sets yet</h2><p>Add an exercise or use the overview to add sets.</p><button type="button" class="secondary-btn">Add exercise</button><div class="focus-picker"></div>';
 empty.querySelector('button').onclick=()=>port.command({type:'add-exercise',host:empty.querySelector('.focus-picker')});
 const toolbar=node('div','focus-toolbar'),overview=node('button','focus-overview','Workout overview'),current=node('button','focus-current','Back to current');overview.type=current.type='button';overview.onclick=()=>{advance.cancel();onInteraction({type:'overview',opener:overview});};current.onclick=()=>{advance.cancel();jump(projection.current,{focus:true});};
 const autoLabel=node('label','focus-auto'),auto=document.createElement('input');auto.type='checkbox';auto.checked=state.autoNext;autoLabel.append(auto,document.createTextNode('Auto-next'));auto.onchange=()=>{advance.cancel();state.autoNext=auto.checked;onInteraction({type:'preference',patch:{autoNext:state.autoNext}});};toolbar.append(overview,current,autoLabel);
 root.append(progress,feed,empty,toolbar);root.hidden=true;host.append(root);
 const logger=host.closest('.workout-logger');
 // Section size changes (notes, wrapping, feedback) refit the peek once per frame.
 const resize=new ResizeObserver(()=>{cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitCards);});
 function interaction(type='input'){advance.cancel();onInteraction({type});syncActive();}
 function createCard(ref,row){
  const b=setRowBindings(row),key=setKey(ref),markers=[],widgets=[],disposers=[];
  function borrow(el,target){if(!markers.some(m=>m.el===el)){const marker=document.createComment('compact-control');el.before(marker);markers.push({el,marker});}if(el.parentElement!==target)target.append(el);}
  const context=node('header','focus-context focus-only'),contextText=node('div','focus-context-text'),eyebrow=node('p','focus-eyebrow'),label=node('p','focus-set-label');contextText.tabIndex=-1;contextText.append(label,eyebrow);
  const marker=node('span','focus-complete-marker');marker.innerHTML=actionIcon('check');context.append(contextText,marker);
  const identity=node('div','focus-identity focus-only'),titleRow=node('div','focus-identity-row'),heading=node('h2','focus-exercise-title'),exerciseAction=node('button','focus-exercise-note');exerciseAction.type='button';exerciseAction.innerHTML=noteIcon();titleRow.append(heading,exerciseAction);
  const noteText=node('button','focus-exercise-note-text');noteText.type='button';
  const exerciseEditor=node('div','focus-exercise-editor');identity.append(titleRow,noteText,exerciseEditor);
  const historyHost=node('div','focus-history focus-only');row.querySelector('.log-set-clip').prepend(context,identity,historyHost);row.classList.add('focus-card');row.dataset.exerciseId=ref.exerciseId;
  const controls=node('div','focus-number-controls focus-only'),help=node('div','focus-input-help focus-only'),rirStrip=node('div','focus-rir-strip focus-only'),notes=node('div','focus-note-area focus-only'),complete=node('div','focus-complete focus-only'),feedback=node('p','focus-feedback visually-hidden');
  const action=node('button','focus-set-note');action.type='button';action.innerHTML=noteIcon()+'<span class="visually-hidden">Add set note</span>';action.onclick=()=>{interaction('note');port.command({type:'set-note',ref,open:true});};
  const grid=row.querySelector('.log-set-row');grid.append(controls,help,rirStrip,notes,feedback);
  // Complete sits on the whole card (not the controls grid) so, when pinned, it can stick anywhere the card is in view.
  row.querySelector('.log-set-clip').append(complete);
  feedback.setAttribute('role','status');
  const caption=row.querySelector('.log-rir-label');caption.innerHTML='RIR<small>Optional</small>';
  const increment=document.createElement('select');increment.className='focus-increment';for(const n of [.25,1,2.5,5]){const option=document.createElement('option');option.value=n;option.textContent=`${n} kg steps`;increment.append(option);}increment.value=state.weightIncrement;
  increment.onchange=()=>{state.weightIncrement=+increment.value;onInteraction({type:'preference',patch:{weightIncrement:state.weightIncrement}});update(snapshot);};help.append(increment);
  function borrowAll(){caption.innerHTML='RIR<small>Optional</small>';borrow(b.number,marker);for(const kind of ['weight','reps'])borrow(b.inputs[kind].closest('.log-stepper'),controls);borrow(caption,rirStrip);borrow(b.rir,rirStrip);rirStrip.append(action);borrow(b.noteHost,notes);borrow(b.done,complete);}
  port.relocate(borrowAll);
  const observed=[context,identity,historyHost,controls,help,rirStrip,notes,complete];for(const el of observed)resize.observe(el);
  for(const kind of ['weight','reps']){
   const input=b.inputs[kind],stepper=input.closest('.log-stepper');if(!input.id)input.id='focus-input-'+crypto.randomUUID();
   const caption=node('label','focus-control-label focus-only',kind==='weight'?'Weight · kg':'Reps');caption.htmlFor=input.id;stepper.prepend(caption);disposers.push(()=>caption.remove());
   if(kind==='weight'){const bw=node('span','focus-bodyweight focus-only','BW');bw.setAttribute('aria-hidden','true');stepper.append(bw);const refresh=()=>{bw.hidden=input.value!==''||input.placeholder!=='';};input.addEventListener('input',refresh,{signal});refresh();disposers.push(()=>bw.remove());}
   const widget=mountWorkoutRuler(stepper,{input,kind,onAdjust:value=>b.applyValue(kind,value),onInteraction:()=>interaction('ruler')});widgets.push({kind,widget});
   if(kind==='reps'){const guide=stepper.querySelector('.workout-rep-guidance');help.prepend(guide);}
  }
  let title=null,history=null;
  exerciseAction.onclick=noteText.onclick=()=>{interaction('note');port.command({type:'exercise-note',exerciseId:ref.exerciseId,host:exerciseEditor});};
  const card={milestone:null,ref,key,row,b,contextText,eyebrow,label,heading,exerciseAction,exerciseEditor,historyHost,widgets,increment,action,feedback,borrowAll,
   update(item,ex,set,index){
    label.textContent=item.preview.label;
    contextText.setAttribute('aria-label',`${item.preview.label}, ${ex.name}`);
    const note=ex.note||'',editing=exerciseEditor.hasChildNodes();exerciseAction.setAttribute('aria-label',`${note?'Edit':'Add'} exercise note, ${ex.name}`);exerciseAction.title=note;exerciseAction.classList.toggle('has-note',Boolean(note));exerciseAction.hidden=editing;
    // The full note stays readable below the title; it opens the same editor.
    noteText.textContent=note;noteText.setAttribute('aria-label',`Edit exercise note, ${ex.name}: ${note}`);noteText.hidden=!note||editing;
    const partner=item.pairId?snapshot.log.exercises.find((e,i,a)=>item.member?.endsWith('1')?a[i-1]?.id===ex.id:a[i+1]?.id===ex.id):null;
    const rest=item.pairId?`Paired with ${partner?.name||'partner'} · ${snapshot.log.exercises.find(e=>e.id===item.pairId)?.superset.restBetweenSeconds??0}s between · ${snapshot.log.exercises.find(e=>e.id===item.pairId)?.superset.restAfterRoundSeconds??0}s after round`:ex.target?`Rest ${ex.target.restSeconds}s`:ex.equipment||'';
    eyebrow.textContent=[item.kind==='warmup'?'Warm-up':item.pairId?`Superset ${item.member}`:item.kindIndex===1?'First working set':'Next set',rest].filter(Boolean).join(' · ');
    if(!title){title=mountWorkoutTitle(heading,{text:ex.name,onInteraction:()=>interaction('title')});}else title.update({text:ex.name});
    const historyState={exercise:ex,lastTime:snapshot.lastTime,bestPerformance:snapshot.bestPerformance,bestStatus:snapshot.bestStatus,unavailable:snapshot.unavailable};if(!history)history=mountWorkoutHistory(historyHost,historyState);else history.update(historyState);
    const setIndex=ex.sets.findIndex(s=>s.id===set.id),kindIndex=ex.sets.slice(0,setIndex+1).filter(s=>s.kind===set.kind).length;
    increment.value=state.weightIncrement;increment.setAttribute('aria-label',`Weight increment, ${item.preview.label}, ${ex.name}`);
    action.setAttribute('aria-label',`Add set note, ${item.kind==='warmup'?'Warm-up set':'Set'} ${kindIndex}, ${ex.name}`);action.hidden=Boolean(b.noteHost.querySelector('.log-set-note-part:not(.is-removing)'));
    b.done.dataset.label=set.done?`${card.milestone??'Set complete'} · Tap to undo`:item.kind==='warmup'?'Complete warm-up':'Complete set';
    const bw=row.querySelector('.focus-bodyweight');if(bw)bw.hidden=b.inputs.weight.value!==''||b.inputs.weight.placeholder!=='';
    // Canonical row inputs already carry authoritative, kind-filtered placeholders.
    for(const {kind,widget} of widgets)widget.update({value:kind==='weight'?set.weightKg:set.reps,placeholder:b.inputs[kind].placeholder===''?null:Number(b.inputs[kind].placeholder),increment:kind==='weight'?state.weightIncrement:1,range:kind==='reps'&&item.kind==='working'?ex.target?.repRange??null:null,enabled:enabled&&Math.abs(index-viewedIndex())<=1});
    card.syncTitle();
   },
   syncTitle(){title?.update({active:enabled&&same(ref,viewed),suspended:suspended||Boolean(document.querySelector('dialog[open]'))||typingField()});},
   restore(){for(const {widget} of widgets)widget.update({enabled:false});port.relocate(()=>{for(const {el,marker} of markers)if(marker.parentNode)marker.after(el);});caption.textContent='RIR';title?.update({active:false});},
   destroy(){title?.destroy();history?.destroy();for(const {widget} of widgets)widget.destroy();card.restore();for(const dispose of disposers)dispose();for(const {marker} of markers)marker.remove();context.remove();identity.remove();action.remove();historyHost.remove();controls.remove();help.remove();rirStrip.remove();notes.remove();complete.remove();feedback.remove();row.classList.remove('focus-card','is-viewed','is-peekless');row.style.removeProperty('--focus-card-min');for(const el of observed)resize.unobserve(el);}
  };
  b.disposers.add(()=>{for(const {widget} of widgets)widget.destroy();title?.destroy();});
  return card;
 }
 // In-flow sections of a card, including the Focus row's own sections (its box is display:contents).
 function sections(clip){return [...clip.children].flatMap(el=>getComputedStyle(el).display==='contents'?[...el.children]:[el]).filter(el=>el.getClientRects().length&&getComputedStyle(el).position!=='absolute');}
 // Reads every card, then writes: each card leaves room for the next set's whole header, or fills the feed.
 function fitCards(){
  if(!enabled||destroyed)return;const feedHeight=feed.clientHeight,rows=[...feed.querySelectorAll(':scope>.focus-card')];
  const anchorRow=(viewed&&cards.get(setKey(viewed))?.row)||review,anchor=anchorRow.offsetTop-feed.scrollTop;
  const fits=rows.map(row=>{const clip=row.querySelector('.log-set-clip'),cs=getComputedStyle(clip),heights=sections(clip).map(el=>{const m=getComputedStyle(el);return el.getBoundingClientRect().height+parseFloat(m.marginTop)+parseFloat(m.marginBottom);});
   const next=row.nextElementSibling?.classList.contains('focus-card')?row.nextElementSibling.querySelector('.focus-context'):null;
   return focusCardFit({feedHeight,contentHeight:stackHeight(heights,parseFloat(cs.rowGap)||0,parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom))+parseFloat(getComputedStyle(row).borderBottomWidth),peekHeight:next?next.getBoundingClientRect().height:0});});
  rows.forEach((row,i)=>{const min=fits[i].minHeight+'px';if(row.style.getPropertyValue('--focus-card-min')!==min)row.style.setProperty('--focus-card-min',min);row.classList.toggle('is-peekless',fits[i].peekless);});
  const moved=anchorRow.offsetTop-feed.scrollTop-anchor;if(Math.abs(moved)>.5){programmatic=true;feed.scrollTop+=moved;programmatic=false;}
 }
 function viewedIndex(){return projection.items.findIndex(i=>same(i.ref,viewed));}
 function ensureCard(ref,row){const key=setKey(ref);let card=cards.get(key);if(!card){card=createCard(ref,row);cards.set(key,card);}else port.relocate(card.borrowAll);return card;}
 function place({ref,row}){if(!enabled)return;ensureCard(ref,row);if(row.parentElement!==feed)feed.insertBefore(row,review);}
 function typingField(){return Boolean(document.activeElement?.matches('input[type="text"],input:not([type]),textarea,select,[contenteditable="true"]'));}
 function syncActive(){for(const card of cards.values())card.syncTitle();feed.classList.toggle('is-unsnapped',suspended||Boolean(measuring)||typingField());}
 function update(next){
  if(destroyed)return;snapshot=next;if(!enabled)return;const previous=projection.items,oldViewed=viewed;projection=projectWorkout(snapshot.log);
  if(viewed&&!projection.items.some(i=>same(i.ref,viewed)))viewed=focusFallback(previous,projection.items,viewed);
  else if(!viewed&&previous.length===0)viewed=projection.current;
  let removedFocus=false;
  for(const [key,card] of cards)if(!projection.items.some(i=>i.key===key)){removedFocus||=card.row.contains(document.activeElement);cards.delete(key);card.destroy();card.row.remove();}
  projection.items.forEach((item,index)=>{
   const row=port.row(item.ref);if(!row)return;const card=ensureCard(item.ref,row);const at=feed.children[index];if(at!==row)port.relocate(()=>feed.insertBefore(row,at||review));
   const ex=snapshot.log.exercises[item.exerciseIndex],set=ex.sets.find(s=>s.id===item.ref.setId);card.update(item,ex,set,index);
  });
  const existing=new Map([...segments.children].map(el=>[el.dataset.key,el]));
  projection.workingKeys.forEach((key,index)=>{let el=existing.get(key);if(!el){el=node('span','focus-progress-segment');el.dataset.key=key;el.append(node('span','focus-progress-fill'));}el.classList.toggle('is-done',projection.doneKeys.has(key));if(segments.children[index]!==el)segments.insertBefore(el,segments.children[index]||null);existing.delete(key);});for(const el of existing.values())el.remove();
  const completed=projection.workingKeys.filter(k=>projection.doneKeys.has(k)).length;count.textContent=`${completed} / ${projection.workingKeys.length} working sets`;
  const item=projection.items.find(i=>same(i.ref,viewed));position.textContent=item?`Exercise ${item.exerciseIndex+1} of ${snapshot.log.exercises.length}`:'Workout review';
  current.hidden=same(viewed,projection.current);empty.hidden=projection.items.length>0;feed.hidden=projection.items.length===0;
  review.querySelector('.focus-review-copy').textContent=completed===projection.workingKeys.length&&completed?'Your working sets are complete. Review your work, then finish.':'Review your completed work or keep training.';
  fitCards();
  const reordered=previous.map(i=>i.key).join('|')!==projection.items.map(i=>i.key).join('|');
  if(!same(oldViewed,viewed)||reordered){jump(viewed,{focus:removedFocus});}syncActive();
 }
 function focusContext(ref){(ref?cards.get(setKey(ref))?.contextText:review.querySelector('h2'))?.focus({preventScroll:true});}
 function jump(ref,{animate=false,focus=false}={}){
  if(!enabled||destroyed)return;viewed=ref;const target=ref?cards.get(setKey(ref))?.row:review;if(!target)return;
  programmatic=true;renderCursor();feed.scrollTo({top:target.offsetTop,behavior:animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches?'smooth':'instant'});programmatic=false;
  if(focus)focusContext(ref);syncActive();
 }
 function renderCursor(){
  const item=projection.items.find(i=>same(i.ref,viewed));position.textContent=item?`Exercise ${item.exerciseIndex+1} of ${snapshot.log.exercises.length}`:'Workout review';current.hidden=same(viewed,projection.current);onViewed(viewed);
  // Geometry is enabled only around the destination; canonical inputs always remain mounted.
  const index=viewedIndex();for(const card of cards.values())card.row.classList.toggle('is-viewed',same(card.ref,viewed));
  for(const [key,card] of cards){const at=projection.items.findIndex(i=>i.key===key);if(Math.abs(at-index)<=1){const ex=snapshot.log.exercises[projection.items[at].exerciseIndex];card.update(projection.items[at],ex,ex.sets.find(s=>s.id===card.ref.setId),at);}else{for(const {widget} of card.widgets)widget.update({enabled:false});card.syncTitle();}}
  syncActive();
 }
 feed.addEventListener('scroll',()=>{if(!enabled||programmatic||suspended||measuring)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{
  if(suspended||measuring||!enabled)return;
  let ref=null;for(const item of projection.items){const row=cards.get(item.key)?.row;if(row&&row.offsetTop<=feed.scrollTop+40)ref=item.ref;}
  if(review.offsetTop<=feed.scrollTop+40)ref=null;if(!same(ref,viewed)){viewed=ref;renderCursor();}
 });},{signal});
 for(const name of ['pointerdown','wheel','touchstart'])feed.addEventListener(name,()=>interaction(name),{signal,passive:true});
 root.addEventListener('focusin',()=>interaction('focus'),{signal});root.addEventListener('focusout',()=>queueMicrotask(syncActive),{signal});
 function celebrate({before,after,ref}){
  if(!enabled)return;const key=setKey(ref),card=cards.get(key);if(!card)return;
  card.milestone=card.feedback.textContent=completionMilestone(before,after,ref).text;card.b.done.dataset.label=`${card.milestone} · Tap to undo`;
  if(rewarded.has(key))return;rewarded.add(key);if(reduced.matches)return;
  const segment=[...segments.children].find(n=>n.dataset.key===key);card.row.classList.add('is-celebrating');segment?.classList.add('is-celebrating');
  const timer=setTimeout(()=>{card.row.classList.remove('is-celebrating');segment?.classList.remove('is-celebrating');animationTimers.delete(timer);},500);animationTimers.add(timer);
 }
 const unsubscribe=port.subscribe(event=>{
  update(port.read());if(!enabled||event.cause!=='edit')return;
  advance.cancel();const ref=event.action?.ref;if(event.action?.type!=='toggle'||!ref)return;
  const key=setKey(ref),before=projectWorkout(event.before),after=projectWorkout(event.after);
  if(!before.doneKeys.has(key)&&after.doneKeys.has(key)){celebrate({...event,ref});advance.completed({...event,ref,viewed,autoNext:state.autoNext});}
  else{const card=cards.get(key);if(card){card.feedback.textContent=completionMilestone(event.before,event.after,ref).text;card.milestone=null;}}
 });
 root.addEventListener('input',()=>interaction('input'),{signal});window.addEventListener('resize',()=>advance.cancel(),{signal});
 function stopCelebration(){for(const timer of animationTimers)clearTimeout(timer);animationTimers.clear();for(const n of root.querySelectorAll('.is-celebrating'))n.classList.remove('is-celebrating');}
 reduced.addEventListener('change',()=>{if(reduced.matches)stopCelebration();},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)advance.cancel();},{signal});
 // Height changes move card offsets; hold snapping and scroll tracking until the viewed set is re-anchored.
 function setFeedHeight(px){
  if(destroyed||px===feedHeight)return;feedHeight=px;root.style.setProperty('--focus-feed-height',px+'px');if(!enabled)return;
  fitCards();
  measuring++;syncActive();const ref=viewed,target=ref?cards.get(setKey(ref))?.row:review;
  if(target){programmatic=true;feed.scrollTo({top:target.offsetTop,behavior:'instant'});
   // The keyboard shrinks the feed while typing: keep the focused field above the pinned Complete (64px).
   const active=document.activeElement;if(typingField()&&target.contains(active)){const f=active.getBoundingClientRect(),box=feed.getBoundingClientRect(),below=f.bottom+64-box.bottom;if(below>0)feed.scrollTop+=Math.min(below,f.top-box.top);}
   programmatic=false;}
  requestAnimationFrame(()=>{measuring--;if(!destroyed)syncActive();});
 }
 function restore(){port.relocate(()=>{port.restoreExerciseNotes();for(const card of cards.values())card.restore();port.restoreRows();});}
 return {
  update,
  setEnabled(value){if(destroyed||enabled===value)return;advance.cancel();stopCelebration();if(!value){enabled=false;logger?.classList.remove('is-focus');restore();root.hidden=true;return;}
   const focused=document.activeElement,exerciseId=focused?.closest('.log-exercise')?.dataset.exerciseId,setId=focused?.closest('.log-set')?.dataset.setId;
   if(exerciseId)viewed=setId?{exerciseId,setId}:projection.items.find(i=>i.ref.exerciseId===exerciseId)?.ref??viewed;
   enabled=true;root.hidden=false;port.relocate(()=>{port.setRowPlacement(place);update(port.read());if(exerciseId&&focused?.matches('textarea')){const card=cards.get(setKey(viewed));if(card)port.command({type:'exercise-note',exerciseId,host:card.exerciseEditor});}logger?.classList.add('is-focus');});jump(viewed??projection.current);
  },
  jump,celebrate,setFeedHeight,isEnabled:()=>enabled&&!destroyed,visibleRef:()=>viewed,focusContext,suspend(value){suspended=value;if(value)advance.cancel();syncActive();},restore,
  destroy(){if(destroyed)return;advance.destroy();stopCelebration();if(enabled){enabled=false;logger?.classList.remove('is-focus');restore();}destroyed=true;unsubscribe();events.abort();resize.disconnect();cancelAnimationFrame(scrollFrame);cancelAnimationFrame(fitFrame);for(const card of cards.values())card.destroy();cards.clear();root.remove();}
 };
}
