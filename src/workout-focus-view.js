import {projectWorkout,focusFallback,setKey,completionMilestone,focusGroups,focusPages,progressClusters} from './workout-focus-model.js';
import {mountWorkoutFocusPair} from './workout-focus-pair.js';
import {createWorkoutAdvance} from './workout-focus-advance.js';
import {setRowBindings} from './workout-set-row.js';
import {mountWorkoutRuler} from './workout-ruler.js';
import {mountWorkoutTitle} from './workout-title.js';
import {mountWorkoutHistory} from './workout-history-summary.js';
import {actionIcon} from './action-controls.js';
import {fitGroup,fitPair,stackHeight} from './workout-focus-fit.js';
import {mountProgressScrub} from './workout-progress-scrub.js';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
const same=(a,b)=>a===b||Boolean(a&&b&&setKey(a)===setKey(b));
const noteIcon=()=>actionIcon('note');
// A page's snap position (a straight set's row, or a round's page): its top minus the pinned block it rests under (its inline scroll-margin-top).
const snapTop=el=>el.offsetTop-(parseFloat(el.style.scrollMarginTop)||0);

/** Borrows canonical row/control nodes. All edits still go through the logger port. */
export function mountWorkoutFocus(host,{port,ui,onInteraction=()=>{},onViewed=()=>{},onFinish=()=>{}}){
 let enabled=false,destroyed=false,suspended=false,viewed=ui.viewed,snapshot=port.read(),projection=projectWorkout(snapshot.log),scrollFrame=null,fitFrame=null,programmatic=false,measuring=0,feedHeight=null,lastGroups=[],travel=null,noteAnchor=null,completing=null,composing=null,pendingJump=null;
 const state={autoNext:ui.autoNext,weightIncrement:ui.weightIncrement},cards=new Map(),groups=new Map(),rounds=new Map(),presenters=new Set(),events=new AbortController(),{signal}=events;
 // Pages resolve exact refs; `selection` remembers each round's partner for this attachment only (the session keeps just `viewed`).
 let pagesState={pages:[],pageByKey:new Map()},pageIndex=new Map(),itemByKey=new Map(),selection=new Map();
 const rewarded=new Set(),animationTimers=new Set(),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const advance=createWorkoutAdvance({read:()=>({log:snapshot.log,viewed,autoNext:state.autoNext,suspended:!enabled||suspended||typingField()||Boolean(document.querySelector('dialog[open]'))}),onAdvance:ref=>jump(ref,{animate:true,focus:true}),reduced:()=>reduced.matches});
 const root=node('section','workout-focus'),progress=node('button','focus-progress'),meta=node('span','focus-progress-meta'),position=node('span',''),count=node('span',''),segments=node('span','focus-progress-segments');
 progress.type='button';progress.setAttribute('aria-haspopup','dialog');meta.append(position,count);progress.append(meta,segments);
 const feed=node('ol','focus-feed');feed.tabIndex=0;feed.setAttribute('aria-label','Workout sets');
 const review=node('li','focus-review');review.innerHTML='<p class="focus-eyebrow">Your workout</p><h2 tabindex="-1">Make it a good finish.</h2><p class="focus-review-copy"></p><button type="button" class="add-btn">Finish workout</button><p class="focus-muted">Finishing is always your choice.</p>';review.querySelector('button').onclick=()=>onFinish();feed.append(review);
 const empty=node('div','focus-empty');empty.innerHTML='<h2>No sets yet</h2><p>Add an exercise or use the overview to add sets.</p><button type="button" class="secondary-btn">Add exercise</button><div class="focus-picker"></div>';
 empty.querySelector('button').onclick=()=>port.command({type:'add-exercise',host:empty.querySelector('.focus-picker')});
 const toolbar=node('div','focus-toolbar'),overview=node('button','focus-overview','Workout overview'),current=node('button','focus-current','Back to current');overview.type=current.type='button';overview.onclick=()=>{advance.cancel();onInteraction({type:'overview',opener:overview});};progress.onclick=()=>{if(scrub.consumeClick())return;advance.cancel();onInteraction({type:'overview',opener:progress});};current.onclick=()=>{advance.cancel();jump(projection.current,{animate:true,focus:true});};
 const autoLabel=node('label','focus-auto'),auto=document.createElement('input');auto.type='checkbox';auto.checked=state.autoNext;autoLabel.append(auto,document.createTextNode('Auto-next'));auto.onchange=()=>{advance.cancel();state.autoNext=auto.checked;onInteraction({type:'preference',patch:{autoNext:state.autoNext}});if(enabled)update(snapshot);};toolbar.append(overview,current,autoLabel);
 const scrub=mountProgressScrub(progress,{strip:segments,
  targets:()=>{const byKey=new Map(projection.items.map(i=>[i.key,i]));return [...segments.querySelectorAll('.focus-progress-segment')].map(el=>({ref:byKey.get(el.dataset.key)?.ref,el})).filter(t=>t.ref);},
  describe:ref=>{const item=projection.items.find(i=>same(i.ref,ref));return {exercise:snapshot.log.exercises[item.exerciseIndex].name,set:item.preview.label};},
  onStart:()=>{advance.cancel();cancelTravel();},onRelease:ref=>{if(!same(ref,viewed))jump(ref,{animate:true,focus:true});}});
 root.append(progress,feed,empty,toolbar);root.hidden=true;host.append(root);
 const logger=host.closest('.workout-logger');
 // Section size changes (notes, wrapping, feedback) refit once per frame.
 const resize=new ResizeObserver(()=>{cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitCards);});
 function interaction(type='input'){advance.cancel();onInteraction({type});syncActive();}
 // The exercise block (name row, tags, note, history) shared by straight groups and round panes.
 function createPresenter(){
  const name=node('div','focus-group-name'),details=node('div','focus-group-details');
  const heading=node('h2','focus-exercise-title'),exerciseAction=node('button','focus-exercise-note');exerciseAction.type='button';exerciseAction.innerHTML=noteIcon();name.append(heading,exerciseAction);
  const noteText=node('button','focus-exercise-note-text');noteText.type='button';
  const editor=node('div','focus-exercise-editor'),historyHost=node('div','focus-history');details.append(noteText,editor,historyHost);
  let tagList=null,tagKey='',title=null,history=null;
  const presenter={name,details,editor,action:exerciseAction,exerciseId:null,active:()=>false,
   update(ex){
    presenter.exerciseId=ex.id;
    const note=ex.note||'';exerciseAction.setAttribute('aria-label',`${note?'Edit':'Add'} exercise note, ${ex.name}`);exerciseAction.title=note;exerciseAction.classList.toggle('has-note',Boolean(note));
    // The full note stays readable below the title; it opens the same editor. Once borrowed, the logger's note part shows it instead.
    noteText.textContent=note;noteText.setAttribute('aria-label',`Edit exercise note, ${ex.name}: ${note}`);noteText.hidden=!note||editor.hasChildNodes();
    const tags=[ex.brand&&['Brand: ',ex.brand,'is-brand'],...(ex.focusTags||[]).map(t=>['Focus: ',t,''])].filter(Boolean),tagsKey=JSON.stringify([ex.name,tags]);
    if(tagsKey!==tagKey){tagKey=tagsKey;tagList?.remove();tagList=null;if(tags.length){tagList=node('ul','focus-tags');tagList.setAttribute('role','list');tagList.setAttribute('aria-label','Tags, '+ex.name);for(const [prefix,text,cls] of tags){const li=node('li','focus-tag'+(cls?' '+cls:'')),hidden=node('span','visually-hidden',prefix);li.append(hidden,text);tagList.append(li);}details.prepend(tagList);}}
    if(!title){title=mountWorkoutTitle(heading,{text:ex.name,onInteraction:()=>interaction('title')});}else title.update({text:ex.name});
    const historyState={exercise:ex,lastTime:snapshot.lastTime,bestPerformance:snapshot.bestPerformance,bestStatus:snapshot.bestStatus,unavailable:snapshot.unavailable};if(!history)history=mountWorkoutHistory(historyHost,historyState);else history.update(historyState);
    presenter.sync();
   },
   // The borrowed note host stays after closing; only an open (not closing) field counts as editing.
   editing:()=>Boolean(editor.querySelector('.log-note-part:not(.is-removing) .log-note-input')),
   // A compact round's visually hidden title is a plain heading: no ticker motion and no focusable control.
   sync(){exerciseAction.hidden=presenter.editing();const compact=Boolean(name.closest('.is-compact'));title?.update({active:enabled&&presenter.active(),hidden:compact,suspended:suspended||Boolean(travel)||compact||Boolean(document.querySelector('dialog[open]'))||typingField()});},
   destroy(){presenters.delete(presenter);title?.destroy();history?.destroy();for(const el of [name,details])resize.unobserve(el);}
  };
  exerciseAction.onclick=noteText.onclick=()=>{holdNoteAnchor();interaction('note');port.command({type:'exercise-note',exerciseId:presenter.exerciseId,host:editor});};
  for(const el of [name,details])resize.observe(el);presenters.add(presenter);
  return presenter;
 }
 // One per run of an exercise's sets: its name row and details pin while the rows snap under them.
 function createGroup(key){
  const li=node('li','focus-group'),list=node('ol','focus-group-sets'),presenter=createPresenter();li.append(presenter.name,presenter.details,list);
  const group={key,li,list,presenter,keys:[],
   update(ex){li.dataset.exerciseId=ex.id;presenter.update(ex);},
   editing:()=>presenter.editing(),
   destroy(){port.relocate(()=>port.restoreExerciseNotes(li));presenter.destroy();li.remove();}
  };
  presenter.active=()=>Boolean(viewed)&&group.keys.includes(setKey(viewed));
  return group;
 }
 // One superset working round: the outer page alone snaps; each existing member gets a pane with its own exercise block and canonical row.
 function createRound(key){
  const li=node('li','focus-round');
  const round={key,li,page:null,compact:false,panes:new Map(),destroy(){round.compact=false;placeNote(round);for(const el of header)resize.unobserve(el);for(const pane of round.panes.values())pane.destroy();round.panes.clear();round.pair.destroy();li.remove();}};
  round.pair=mountWorkoutFocusPair(li,{onSelect:ref=>choose(round,ref),onInteraction:()=>interaction('partner'),reduced,relocate:port.relocate});
  // The round context and selector band are the header the fit measures (wrapped names, a relocated note action).
  const header=[...li.children].filter(el=>!el.classList.contains('focus-pair-panes'));for(const el of header)resize.observe(el);
  return round;
 }
 function createPane(exerciseId){
  const el=node('div','focus-pair-pane'),list=node('ol','focus-group-sets'),presenter=createPresenter();el.dataset.exerciseId=exerciseId;el.append(presenter.name,presenter.details,list);
  const pane={el,list,presenter,keys:[],destroy(){port.relocate(()=>port.restoreExerciseNotes(el));presenter.destroy();presenter.action.remove();el.remove();}};
  presenter.active=()=>Boolean(viewed)&&pane.keys.includes(setKey(viewed));
  return pane;
 }
 function createCard(ref,row){
  const b=setRowBindings(row),key=setKey(ref),markers=[],widgets=[],disposers=[];
  function borrow(el,target){if(!markers.some(m=>m.el===el)){const marker=document.createComment('compact-control');el.before(marker);markers.push({el,marker});}if(el.parentElement!==target)target.append(el);}
  const context=node('header','focus-context focus-only'),contextText=node('div','focus-context-text'),eyebrow=node('p','focus-eyebrow'),label=node('p','focus-set-label');contextText.tabIndex=-1;contextText.append(label,eyebrow);
  const action=node('button','focus-set-note');action.type='button';action.innerHTML=noteIcon()+'<span class="visually-hidden">Add set note</span>';action.onclick=()=>{interaction('note');port.command({type:'set-note',ref,open:true});};
  const marker=node('span','focus-complete-marker');marker.innerHTML=actionIcon('check');context.append(contextText,action,marker);
  row.querySelector('.log-set-clip').prepend(context);row.classList.add('focus-card');row.dataset.exerciseId=ref.exerciseId;
  const controls=node('div','focus-number-controls focus-only'),rirStrip=node('div','focus-rir-strip focus-only'),notes=node('div','focus-note-area focus-only'),complete=node('div','focus-complete focus-only'),feedback=node('p','focus-feedback visually-hidden');
  // A round's action names what it logs; aria-labelledby overrides the row's own aria-label only while borrowed.
  const doneName=node('span','visually-hidden');doneName.id='focus-done-'+crypto.randomUUID();complete.append(doneName);
  const grid=row.querySelector('.log-set-row');grid.append(controls,rirStrip,notes,feedback);
  // Complete sits on the whole card (not the controls grid) so, when pinned, it can stick anywhere the card is in view.
  row.querySelector('.log-set-clip').append(complete);
  feedback.setAttribute('role','status');
  const caption=row.querySelector('.log-rir-label');caption.innerHTML='RIR<small>Optional</small>';
  function borrowAll(){caption.innerHTML='RIR<small>Optional</small>';borrow(b.number,marker);for(const kind of ['weight','reps'])borrow(b.inputs[kind].closest('.log-stepper'),controls);borrow(caption,rirStrip);borrow(b.rir,rirStrip);borrow(b.noteHost,notes);borrow(b.done,complete);}
  port.relocate(borrowAll);
  const observed=[context,controls,rirStrip,notes,complete];for(const el of observed)resize.observe(el);
  for(const kind of ['weight','reps']){
   const input=b.inputs[kind],stepper=input.closest('.log-stepper');if(!input.id)input.id='focus-input-'+crypto.randomUUID();
   const caption=node('label','focus-control-label focus-only',kind==='weight'?'Weight · kg':'Reps');caption.htmlFor=input.id;stepper.prepend(caption);disposers.push(()=>caption.remove());
   if(kind==='weight'){const bw=node('span','focus-bodyweight focus-only','BW');bw.setAttribute('aria-hidden','true');stepper.append(bw);const refresh=()=>{bw.hidden=input.value!==''||input.placeholder!=='';};input.addEventListener('input',refresh,{signal});refresh();disposers.push(()=>bw.remove());}
   const widget=mountWorkoutRuler(stepper,{input,kind,caption:kind==='reps'?caption:null,onAdjust:value=>b.applyValue(kind,value),onInteraction:()=>interaction('ruler')});widgets.push({kind,widget});
  }
  const card={milestone:null,ref,key,row,b,contextText,eyebrow,label,widgets,action,completeMarker:marker,feedback,borrowAll,
   update(item,ex,set,on){
    const warm=item.kind==='warmup',page=pageOf(ref),other=page?.kind==='round'?page.members.find(m=>m.ref&&m.key!==key):null,open=other&&!projection.doneKeys.has(other.key);card.round=page?.kind==='round';
    rirStrip.hidden=warm;context.classList.toggle('is-warmup',warm);
    contextText.setAttribute('aria-label',`${item.preview.label}, ${ex.name}`);
    const partner=item.pairId?snapshot.log.exercises.find((e,i,a)=>item.member?.endsWith('1')?a[i-1]?.id===ex.id:a[i+1]?.id===ex.id):null,superset=item.pairId&&snapshot.log.exercises.find(e=>e.id===item.pairId)?.superset;
    const rest=item.pairId?`Paired with ${partner?.name||'partner'} · ${superset?.restBetweenSeconds??0}s between · ${superset?.restAfterRoundSeconds??0}s after round`:ex.target?`Rest ${ex.target.restSeconds}s`:ex.equipment||'';
    // A round's header and selectors already name the superset, member and round: its set context only adds the rests.
    label.textContent=warm?`Warm-up · W${item.kindIndex}`:card.round?`Rest ${superset?.restBetweenSeconds??0}s · ${superset?.restAfterRoundSeconds??0}s after the round`:item.preview.label;
    eyebrow.textContent=card.round?'':[warm?(item.pairId?`Superset ${item.member}`:''):item.pairId?`Superset ${item.member}`:item.kindIndex===1?'First working set':'Next set',rest].filter(Boolean).join(' · ');
    const setIndex=ex.sets.findIndex(s=>s.id===set.id),kindIndex=ex.sets.slice(0,setIndex+1).filter(s=>s.kind===set.kind).length;
    action.setAttribute('aria-label',`Add set note, ${item.kind==='warmup'?'Warm-up set':'Set'} ${kindIndex}, ${ex.name}`);action.hidden=Boolean(b.noteHost.querySelector('.log-set-note-part:not(.is-removing)'));
    const name=!card.round?null:set.done?`Undo ${item.member} completion`:!open?'Complete round':state.autoNext?`Log ${item.member} & switch to ${other.member}`:`Log ${item.member}`;
    b.done.dataset.label=name??(set.done?`${card.milestone??'Set complete'} · Tap to undo`:item.kind==='warmup'?'Complete warm-up':'Complete set');
    // Neutral first-partner Log; its arrow points to the partner it switches to.
    if(card.round&&!set.done&&open)b.done.dataset.log=state.autoNext?(other.member>item.member?'next':'prev'):'stay';else delete b.done.dataset.log;
    if(name){doneName.textContent=name;b.done.setAttribute('aria-labelledby',doneName.id);}else b.done.removeAttribute('aria-labelledby');
    const bw=row.querySelector('.focus-bodyweight');if(bw)bw.hidden=b.inputs.weight.value!==''||b.inputs.weight.placeholder!=='';
    // Canonical row inputs already carry authoritative, kind-filtered placeholders.
    for(const {kind,widget} of widgets)widget.update({value:kind==='weight'?set.weightKg:set.reps,placeholder:b.inputs[kind].placeholder===''?null:Number(b.inputs[kind].placeholder),increment:kind==='weight'?state.weightIncrement:1,range:kind==='reps'&&item.kind==='working'?ex.target?.repRange??null:null,enabled:on});
   },
   restore(){for(const {widget} of widgets)widget.update({enabled:false});b.done.removeAttribute('aria-labelledby');port.relocate(()=>{for(const {el,marker} of markers)if(marker.parentNode)marker.after(el);});caption.textContent='RIR';},
   destroy(){for(const {widget} of widgets)widget.destroy();card.restore();for(const dispose of disposers)dispose();for(const {marker} of markers)marker.remove();context.remove();action.remove();controls.remove();rirStrip.remove();notes.remove();complete.remove();feedback.remove();row.classList.remove('focus-card','is-viewed');row.style.removeProperty('--focus-card-min');row.style.removeProperty('scroll-margin-top');for(const el of observed)resize.unobserve(el);}
  };
  b.disposers.add(()=>{for(const {widget} of widgets)widget.destroy();});
  return card;
 }
 // In-flow sections of a card, including the Focus row's own sections (its box is display:contents).
 function sections(clip){return [...clip.children].flatMap(el=>getComputedStyle(el).display==='contents'?[...el.children]:[el]).filter(el=>el.getClientRects().length&&getComputedStyle(el).position!=='absolute');}
 const height=el=>el.getBoundingClientRect().height,setStyle=(el,name,value)=>{if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);};
 // A set page's content: its sections and gaps (its own box may be stretched to fill), plus its bottom separator.
 function contentHeight(row){
  const clip=row.querySelector('.log-set-clip'),cs=getComputedStyle(clip),heights=sections(clip).map(el=>{const m=getComputedStyle(el);return height(el)+parseFloat(m.marginTop)+parseFloat(m.marginBottom);});
  // the extra rowGap is the zero-height .log-set-clip::after item that shares the residual
  return stackHeight(heights,parseFloat(cs.rowGap)||0,parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)+(parseFloat(cs.rowGap)||0))+parseFloat(getComputedStyle(row).borderBottomWidth);
 }
 // Both member panes are measured where they sit (the inactive one is hidden, not removed); the header is everything above them.
 function measureRound(round,compact){
  const li=round.li,panes=li.querySelector('.focus-pair-panes'),members=[...round.panes.values()].filter(p=>p.list.firstElementChild);
  return {header:panes.getBoundingClientRect().top-li.getBoundingClientRect().top,heights:members.map(p=>(compact?0:height(p.presenter.name))+height(p.presenter.details)+contentHeight(p.list.firstElementChild))};
 }
 // Each live round is laid out once in each mode (class only, no node moves, nothing painted), so the decision never depends on the current mode.
 function fitRounds(feedHeight){
  const live=[...rounds.values()].filter(r=>[...r.panes.values()].some(p=>p.list.firstElementChild)),mode=on=>{for(const r of live)r.li.classList.toggle('is-compact',on);return live.map(r=>measureRound(r,on));};
  const full=mode(false),tight=mode(true);for(const r of live)r.li.classList.toggle('is-compact',r.compact);
  return live.map((round,i)=>{const li=round.li,border=parseFloat(getComputedStyle(li).borderBottomWidth)||0;
   return {round,panes:li.querySelector('.focus-pair-panes'),border,fit:fitPair({feedHeight:feedHeight-border,headerHeight:full[i].header,compactHeaderHeight:tight[i].header,fullHeights:full[i].heights,compactHeights:tight[i].heights})};});
 }
 // Compact rounds show the selected exercise's note action and its set's note action in the round context; otherwise each sits in its own row.
 function placeNote(round){
  const selected=selectedOf(round.page),put=(el,parent,before=null)=>{if(el.parentElement===parent)return;const focused=document.activeElement===el;parent.insertBefore(el,before);if(focused)el.focus({preventScroll:true});};
  for(const [id,pane] of round.panes){const here=round.compact&&selected?.exerciseId===id,card=cards.get(pane.keys[0]);
   put(pane.presenter.action,here?round.pair.context:pane.presenter.name);
   if(card)put(card.action,here?round.pair.context:card.completeMarker.parentElement,here?null:card.completeMarker);}
 }
 // Reads every page, then writes: each straight row fills the space under its pinned block; a round fills the feed (or grows) around its larger member.
 function fitCards(){
  if(!enabled||destroyed)return;syncActive();const feedHeight=feed.clientHeight;
  const anchorRow=noteAnchor?.row.isConnected?noteAnchor.row:inView().row,anchor=noteAnchor?.row===anchorRow?noteAnchor.delta:snapTop(anchorRow)-feed.scrollTop;
  const fits=lastGroups.map(g=>groups.get(g.key)).map(group=>{const li=group.li;
   const [name,details,list]=li.children,rows=[...list.children].filter(r=>r.classList.contains('focus-card'));if(!rows.length)return null;
   const nameHeight=height(name);
   return {li,rows,nameHeight,fit:fitGroup({feedHeight,nameHeight,detailsHeight:height(details),contentHeights:rows.map(contentHeight),editing:group.editing()})};
  }).filter(Boolean);
  // Compacting moves the note actions into the header, so rounds are measured once more after any mode change.
  const compactAll=pairs=>pairs.filter(p=>p.round.compact!==p.fit.compact).map(p=>{p.round.compact=p.fit.compact;p.round.li.classList.toggle('is-compact',p.fit.compact);placeNote(p.round);return p.round;});
  let pairs=fitRounds(feedHeight);
  if(compactAll(pairs).length){pairs=fitRounds(feedHeight);compactAll(pairs);syncActive();}
  for(const {li,rows,nameHeight,fit} of fits){
   li.classList.toggle('is-name-only',fit.nameOnly);setStyle(li,'--focus-name-h',nameHeight+'px');setStyle(li,'--focus-pin',fit.pinned+'px');
   rows.forEach((row,i)=>{const r=fit.rows[i];setStyle(row,'--focus-card-min',r.minHeight+'px');setStyle(row,'scroll-margin-top',r.offset+'px');});
  }
  for(const {round,panes,border,fit} of pairs){setStyle(round.li,'min-height',fit.minHeight+border+'px');setStyle(panes,'min-height',fit.paneMinHeight+'px');}
  const moved=snapTop(anchorRow)-feed.scrollTop-anchor;if(!travel&&Math.abs(moved)>.5){programmatic=true;feed.scrollTop+=moved;programmatic=false;}
 }
 const pageOf=ref=>ref?pagesState.pageByKey.get(setKey(ref))??null:null;
 const pageNode=page=>page.kind==='round'?rounds.get(page.key)?.li:cards.get(page.keys[0])?.row;
 function pageEl(ref){if(!ref)return review;const page=pageOf(ref);return page?pageNode(page):null;}
 // A round shows its remembered partner, else its first unfinished, else its first existing one.
 function selectedOf(page){
  if(page.kind!=='round')return itemByKey.get(page.keys[0])?.ref??null;
  const kept=selection.get(page.key);if(kept&&page.keys.includes(setKey(kept)))return kept;
  const existing=page.members.filter(m=>m.ref);return (existing.find(m=>!projection.doneKeys.has(m.key))??existing[0])?.ref??null;
 }
 function renderRound(round,{animate=false}={}){
  const page=round.page,total=pagesState.pages.filter(p=>p.kind==='round'&&p.pairId===page.pairId).length;
  const members=page.members.map(m=>({...m,name:snapshot.log.exercises.find(e=>e.id===m.exerciseId)?.name??'',done:Boolean(m.key&&projection.doneKeys.has(m.key)),pane:m.ref?round.panes.get(m.exerciseId)?.el??null:null,context:m.key?cards.get(m.key)?.contextText??null:null}));
  round.pair.update({page,members,selected:selectedOf(page),total,animate,completedKey:completing});placeNote(round);
 }
 // A selection shows its partner's rulers and hides the other's, on any round.
 function select(page,ref,animate=false){selection.set(page.key,ref);const round=rounds.get(page.key);if(!round)return;renderRound(round,{animate});for(const key of page.keys){const card=cards.get(key);if(card)syncRuler(card);}}
 // A selector tap changes the viewed set in place on the viewed round; elsewhere it only changes what that round shows.
 function choose(round,ref){const page=round.page;if(!page?.keys.includes(setKey(ref)))return;if(pageOf(viewed)?.key===page.key)jump(ref);else select(page,ref,true);}
 // Rulers draw only near the viewed page, and inside a round only for the shown partner.
 function rulerOn(card){
  const page=pageOf(card.ref);if(!enabled||!page)return false;const at=pageIndex.get(page.key),vp=pageOf(viewed),v=vp?pageIndex.get(vp.key):pagesState.pages.length;
  return Math.abs(at-v)<=1&&(page.kind!=='round'||same(selectedOf(page),card.ref));
 }
 function syncRuler(card){if(rulerOn(card)){const item=itemByKey.get(card.key),ex=snapshot.log.exercises[item.exerciseIndex];card.update(item,ex,ex.sets.find(s=>s.id===card.ref.setId),true);}else for(const {widget} of card.widgets)widget.update({enabled:false});}
 function ensureCard(ref,row){const key=setKey(ref);let card=cards.get(key);if(!card){card=createCard(ref,row);cards.set(key,card);}else port.relocate(card.borrowAll);return card;}
 // Logger renders (saves, RIR taps, hydration) call this for every row: a row already in the feed stays in its group; update() groups new ones.
 function place({ref,row}){if(!enabled)return;ensureCard(ref,row);if(!feed.contains(row))feed.insertBefore(row,review);}
 function typingField(){return Boolean(document.activeElement?.matches('input[type="text"],input:not([type]),textarea,select,[contenteditable="true"]'));}
 function syncActive(){for(const presenter of presenters)presenter.sync();feed.classList.toggle('is-unsnapped',suspended||Boolean(measuring)||typingField());}
 function update(next){
  if(destroyed)return;snapshot=next;if(!enabled)return;const previous=projection.items,oldViewed=viewed;projection=projectWorkout(snapshot.log);itemByKey=new Map(projection.items.map(i=>[i.key,i]));
  pagesState=focusPages(snapshot.log,projection.items,pagesState.pages);pageIndex=new Map(pagesState.pages.map((p,i)=>[p.key,i]));
  if(viewed&&!itemByKey.has(setKey(viewed)))viewed=focusFallback(previous,projection.items,viewed);
  else if(!viewed&&previous.length===0)viewed=projection.current;
  // Stale memberships are forgotten; the viewed partner always stays its round's selection.
  for(const [key,ref] of selection){const p=pagesState.pages[pageIndex.get(key)];if(p?.kind!=='round'||!p.keys.includes(setKey(ref)))selection.delete(key);}
  const viewedPage=pageOf(viewed);if(viewedPage?.kind==='round')selection.set(viewedPage.key,viewed);
  let removedFocus=false;
  for(const [key,card] of cards)if(!itemByKey.has(key)){removedFocus||=card.row.contains(document.activeElement);cards.delete(key);card.destroy();card.row.remove();}
  // Groups (runs of one exercise's set pages) keep their element through regrouping (inherited keys); a duplicate key gets a fresh one so each group stays distinct.
  const taken=new Set(),liveRounds=new Set(),retired=[];lastGroups=focusGroups(projection.items.filter(i=>pagesState.pageByKey.get(i.key).kind==='set'),lastGroups).map(g=>{const key=taken.has(g.key)?crypto.randomUUID():g.key;taken.add(key);return {...g,key};});
  const groupOf=new Map(lastGroups.flatMap(g=>g.keys.map(k=>[k,g]))),units=[];
  for(const page of pagesState.pages){const unit=page.kind==='round'?page:groupOf.get(page.keys[0]);if(units.at(-1)!==unit)units.push(unit);}
  const exercise=id=>snapshot.log.exercises.find(e=>e.id===id);
  function show(ref,list,at){const row=port.row(ref);if(!row)return;const card=ensureCard(ref,row);if(list.children[at]!==row)port.relocate(()=>list.insertBefore(row,list.children[at]||null));const item=itemByKey.get(card.key),ex=snapshot.log.exercises[item.exerciseIndex];card.update(item,ex,ex.sets.find(s=>s.id===ref.setId),rulerOn(card));}
  units.forEach((unit,i)=>{
   if(unit.kind==='round'){
    let round=rounds.get(unit.key);if(!round){round=createRound(unit.key);rounds.set(unit.key,round);}round.page=unit;liveRounds.add(unit.key);
    if(feed.children[i]!==round.li)port.relocate(()=>feed.insertBefore(round.li,feed.children[i]));
    for(const m of unit.members){
     let pane=round.panes.get(m.exerciseId);
     if(!m.ref){if(pane){round.panes.delete(m.exerciseId);retired.push(pane);}continue;}
     if(!pane){pane=createPane(m.exerciseId);round.panes.set(m.exerciseId,pane);}pane.keys=[m.key];
     show(m.ref,pane.list,0);pane.presenter.update(exercise(m.exerciseId));
    }
    renderRound(round);return;
   }
   let group=groups.get(unit.key);if(!group){group=createGroup(unit.key);groups.set(unit.key,group);}group.keys=unit.keys;
   if(feed.children[i]!==group.li)port.relocate(()=>feed.insertBefore(group.li,feed.children[i]));
   unit.keys.forEach((key,j)=>show(itemByKey.get(key).ref,group.list,j));
   group.update(snapshot.log.exercises[unit.exerciseIndex]);
  });
  for(const [key,group] of groups)if(!taken.has(key)){groups.delete(key);retired.push(group);}
  for(const [key,round] of rounds)if(!liveRounds.has(key)){rounds.delete(key);retired.push(...round.panes.values(),round);round.panes.clear();}
  // Transfer each canonical note host to a surviving block of its exercise before retiring; restoring it would hide the live editor.
  const leaving=new Set(retired.map(r=>r.presenter).filter(Boolean));
  for(const {presenter} of retired){if(!presenter?.editor.hasChildNodes())continue;
   const survivor=[...presenters].find(p=>!leaving.has(p)&&p.exerciseId===presenter.exerciseId);
   if(survivor){port.relocate(()=>survivor.editor.append(...presenter.editor.childNodes));survivor.update(exercise(survivor.exerciseId));}
  }
  for(const r of retired)r.destroy();
  if(travel?.ref&&!projection.items.some(i=>same(i.ref,travel.ref)))cancelTravel();
  const existing=new Map([...segments.querySelectorAll('.focus-progress-segment')].map(el=>[el.dataset.key,el])),oldClusters=new Map([...segments.children].map(el=>[el.dataset.key,el]));
  progressClusters(projection.items).forEach(({key,keys},index)=>{
   let box=oldClusters.get(key);if(!box){box=node('span','focus-progress-cluster');box.dataset.key=key;}oldClusters.delete(key);box.style.flexGrow=keys.length;
   keys.forEach((k,i)=>{let el=existing.get(k);if(!el){el=node('span','focus-progress-segment');el.dataset.key=k;el.append(node('span','focus-progress-fill'));}el.classList.toggle('is-done',projection.doneKeys.has(k));if(box.children[i]!==el)box.insertBefore(el,box.children[i]||null);existing.delete(k);});
   if(segments.children[index]!==box)segments.insertBefore(box,segments.children[index]||null);
  });for(const el of existing.values())el.remove();for(const box of oldClusters.values())box.remove();
  const completed=projection.workingKeys.filter(k=>projection.doneKeys.has(k)).length;count.textContent=`${completed} / ${projection.workingKeys.length} working sets`;
  const item=projection.items.find(i=>same(i.ref,viewed));position.textContent=item?`Exercise ${item.exerciseIndex+1} of ${snapshot.log.exercises.length}`:'Workout review';progressName(item,completed);
  current.hidden=same(viewed,projection.current);empty.hidden=projection.items.length>0;feed.hidden=projection.items.length===0;
  review.querySelector('.focus-review-copy').textContent=completed===projection.workingKeys.length&&completed?'Your working sets are complete. Review your work, then finish.':'Review your completed work or keep training.';
  fitCards();
  const reordered=previous.map(i=>i.key).join('|')!==projection.items.map(i=>i.key).join('|');
  if(!same(oldViewed,viewed)||reordered)settle(viewed,removedFocus);syncActive();
 }
 function focusContext(ref){const page=pageOf(ref);if(page?.kind==='round'&&!same(selectedOf(page),ref))select(page,ref);(ref?cards.get(setKey(ref))?.contextText:review.querySelector('h2'))?.focus({preventScroll:true});}
 // A partner on the viewed round is selected in place; any other page travels (animate) or settles there.
 function jump(ref,{animate=false,focus=false}={}){
  if(!enabled||destroyed)return;
  // A composing field is never hidden or blurred: only the latest request applies once it ends.
  if(composing){if(composing.isConnected&&composing===document.activeElement){pendingJump={ref,options:{animate,focus}};return;}composing=null;}
  const target=pageEl(ref);if(!target)return;noteAnchor=null;
  const page=pageOf(ref);
  // `viewed` changes first: the focus move inside select() can blur a note whose commit re-renders the feed.
  if(page?.kind==='round'){const here=!travel&&pageOf(viewed)?.key===page.key;if(here)viewed=ref;select(page,ref,here);if(here){renderCursor();if(focus)focusContext(ref);return;}}
  if(animate&&!reduced.matches)return startTravel(ref,target,focus);
  settle(ref,focus);
 }
 function settle(ref,focus=false){
  const target=pageEl(ref);if(!target)return;cancelTravel();viewed=ref;programmatic=true;renderCursor();feed.scrollTo({top:snapTop(target),behavior:'instant'});programmatic=false;
  if(focus)focusContext(ref);syncActive();
 }
 // Explicit jumps scroll through the sets in between; the viewed set (progress, rulers, ticker) changes on arrival.
 function startTravel(ref,target,focus){
  cancelTravel();travel={ref,top:snapTop(target),timer:null};feed.scrollTo({top:travel.top,behavior:'smooth'});
  if(focus)focusContext(ref);settleLater();syncActive();
 }
 // Arrival also counts after 150ms without scroll events (no movement, or a browser that never fires scrollend).
 function settleLater(){clearTimeout(travel.timer);travel.timer=setTimeout(arrive,150);}
 function arrive(){
  if(!travel)return;const {ref,timer}=travel;clearTimeout(timer);travel=null;if(!enabled||destroyed)return;viewed=ref;
  const target=pageEl(ref);if(target&&Math.abs(feed.scrollTop-snapTop(target))>1){programmatic=true;feed.scrollTo({top:snapTop(target),behavior:'instant'});programmatic=false;}
  renderCursor();syncActive();
 }
 // A touch, wheel, key, dialog or resize ends the travel where it is; snapping and track() pick the set.
 function cancelTravel(){if(!travel)return;clearTimeout(travel.timer);travel=null;feed.scrollTo({top:feed.scrollTop,behavior:'instant'});if(enabled&&!destroyed){track();syncActive();}}
 function progressName(item,completed=projection.workingKeys.filter(k=>projection.doneKeys.has(k)).length){progress.setAttribute('aria-label',`Workout overview, ${item?`exercise ${item.exerciseIndex+1} of ${snapshot.log.exercises.length}`:'workout review'}, ${completed} of ${projection.workingKeys.length} working sets`);}
 function renderCursor(){
  const page=pageOf(viewed);if(page?.kind==='round'&&!same(selection.get(page.key),viewed))select(page,viewed);
  const item=itemByKey.get(viewed&&setKey(viewed));position.textContent=item?`Exercise ${item.exerciseIndex+1} of ${snapshot.log.exercises.length}`:'Workout review';progressName(item);current.hidden=same(viewed,projection.current);onViewed(viewed);
  // Geometry is enabled only around the destination; canonical inputs always remain mounted.
  for(const card of cards.values())card.row.classList.toggle('is-viewed',same(card.ref,viewed));
  for(const card of cards.values())syncRuler(card);
  syncActive();
 }
 feed.addEventListener('scroll',()=>{
  // Outside the rAF throttle so arrival is seen even under a fake clock.
  if(travel){if(Math.abs(feed.scrollTop-travel.top)<=1)arrive();else settleLater();return;}
  if(!enabled||programmatic||suspended||measuring)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{
  if(suspended||measuring||!enabled)return;track();
 });},{signal});
 // The set the scroll position shows (null = review), read from geometry rather than the possibly stale `viewed`.
 function inView(){let page=null,row=null;for(const p of pagesState.pages){const el=pageNode(p);if(el&&snapTop(el)<=feed.scrollTop+40){page=p;row=el;}}return review.offsetTop<=feed.scrollTop+40?{ref:null,row:review}:{ref:page?selectedOf(page):null,row:row||review};}
 function track(){if(noteAnchor)return;const {ref}=inView();if(!same(ref,viewed)){viewed=ref;renderCursor();}}
 for(const name of ['pointerdown','wheel','touchstart'])feed.addEventListener(name,e=>{if(!e.target.closest('.focus-exercise-editor')||name==='wheel')noteAnchor=null;interaction(name);},{signal,passive:true});
 feed.addEventListener('scrollend',arrive,{signal});feed.addEventListener('wheel',cancelTravel,{signal,passive:true});
 // Any key, even with focus outside Focus (body after a tap), stops pending Auto-next; it runs before the click that Enter/Space would send.
 document.addEventListener('pointerdown',cancelTravel,{signal,capture:true});document.addEventListener('keydown',()=>{advance.cancel();cancelTravel();},{signal,capture:true});
 // Pressing or typing inside a round's panes stills its partner motion so the target stays put.
 for(const name of ['pointerdown','keydown','input'])root.addEventListener(name,e=>{const li=e.target.closest?.('.focus-pair-panes')&&e.target.closest('.focus-round');if(li)for(const round of rounds.values())if(round.li===li)round.pair.cancelMotion();},{signal,capture:true});
 document.addEventListener('compositionstart',e=>{composing=e.target;},{signal,capture:true});
 document.addEventListener('compositionend',()=>{composing=null;const p=pendingJump;pendingJump=null;if(p&&(!p.ref||itemByKey.has(setKey(p.ref))))jump(p.ref,p.options);},{signal});
 // Keep the pre-edit set position through note growth and its collapse, including every animated frame.
 function holdNoteAnchor(){const row=pageEl(viewed);if(row)noteAnchor={row,delta:snapTop(row)-feed.scrollTop};}
 root.addEventListener('input',e=>{if(!noteAnchor&&e.target.closest('.focus-exercise-editor'))holdNoteAnchor();},{signal,capture:true});
 root.addEventListener('click',e=>{if(e.target.closest('.focus-exercise-editor button'))holdNoteAnchor();},{signal,capture:true});
 feed.addEventListener('keydown',e=>{if((e.key==='Tab'&&!e.isComposing)||!typingField())noteAnchor=null;},{signal});
 root.addEventListener('focusin',()=>interaction('focus'),{signal});root.addEventListener('focusout',()=>queueMicrotask(syncActive),{signal});
 function celebrate({before,after,ref}){
  if(!enabled)return;const key=setKey(ref),card=cards.get(key);if(!card)return;
  card.milestone=card.feedback.textContent=completionMilestone(before,after,ref).text;if(!card.round)card.b.done.dataset.label=`${card.milestone} · Tap to undo`;
  if(rewarded.has(key))return;rewarded.add(key);if(reduced.matches)return;
  const segment=[...segments.querySelectorAll('.focus-progress-segment')].find(n=>n.dataset.key===key);card.row.classList.add('is-celebrating');segment?.classList.add('is-celebrating');
  const timer=setTimeout(()=>{card.row.classList.remove('is-celebrating');segment?.classList.remove('is-celebrating');animationTimers.delete(timer);},500);animationTimers.add(timer);
 }
 const stopMotion=()=>{for(const round of rounds.values())round.pair.cancelMotion();};
 const unsubscribe=port.subscribe(event=>{
  // Only an explicit toggle animates its selector's check; hydration and acknowledgements show final states.
  completing=event.cause==='edit'&&event.action?.type==='toggle'&&event.action.ref?setKey(event.action.ref):null;
  try{update(port.read());}finally{completing=null;}if(!enabled||event.cause!=='edit')return;
  advance.cancel();const ref=event.action?.ref;if(event.action?.type!=='toggle'||!ref)return;
  const key=setKey(ref),before=projectWorkout(event.before),after=projectWorkout(event.after);
  if(!before.doneKeys.has(key)&&after.doneKeys.has(key)){celebrate({...event,ref});advance.completed({...event,ref,viewed,autoNext:state.autoNext});}
  else{const card=cards.get(key);if(card){card.feedback.textContent=completionMilestone(event.before,event.after,ref).text;card.milestone=null;}}
 });
 root.addEventListener('input',()=>interaction('input'),{signal});window.addEventListener('resize',()=>{advance.cancel();cancelTravel();},{signal});
 function stopCelebration(){for(const timer of animationTimers)clearTimeout(timer);animationTimers.clear();for(const n of root.querySelectorAll('.is-celebrating'))n.classList.remove('is-celebrating');}
 reduced.addEventListener('change',()=>{if(reduced.matches)stopCelebration();},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)advance.cancel();},{signal});
 // Height changes move card offsets; hold snapping and scroll tracking until the viewed set is re-anchored.
 function setFeedHeight(px){
  if(destroyed||px===feedHeight)return;
  // A user's scroll can land before its tracking frame; read it before changing the geometry.
  if(enabled&&!suspended&&!measuring&&feedHeight!==null)track();
  cancelTravel();noteAnchor=null;feedHeight=px;root.style.setProperty('--focus-feed-height',px+'px');if(!enabled)return;
  fitCards();
  measuring++;syncActive();const ref=viewed,target=pageEl(ref);
  if(target){programmatic=true;feed.scrollTo({top:snapTop(target),behavior:'instant'});
   // The keyboard shrinks the feed while typing: keep the focused field above the pinned Complete (64px), but never under the pinned block (the top edge wins).
   const active=document.activeElement;if(typingField()&&target.contains(active)){const f=active.getBoundingClientRect(),box=feed.getBoundingClientRect(),pin=parseFloat(target.closest('.focus-group')?.style.getPropertyValue('--focus-pin'))||0,below=f.bottom+64-box.bottom;if(below>0)feed.scrollTop+=Math.min(below,f.top-box.top-pin);}
   programmatic=false;}
  requestAnimationFrame(()=>{measuring--;if(destroyed)return;syncActive();if(!measuring&&enabled&&!suspended)track();});
 }
 function restore(){noteAnchor=null;stopMotion();port.relocate(()=>{port.restoreExerciseNotes();for(const card of cards.values())card.restore();port.restoreRows();});for(const presenter of presenters)presenter.sync();}
 return {
  update,
  setEnabled(value){if(destroyed||enabled===value)return;advance.cancel();stopCelebration();if(!value){cancelTravel();enabled=false;logger?.classList.remove('is-focus');restore();root.hidden=true;return;}
   const focused=document.activeElement,exerciseId=focused?.closest('.log-exercise')?.dataset.exerciseId,setId=focused?.closest('.log-set')?.dataset.setId;
   if(exerciseId)viewed=setId?{exerciseId,setId}:projection.items.find(i=>i.ref.exerciseId===exerciseId)?.ref??viewed;
   enabled=true;root.hidden=false;port.relocate(()=>{port.setRowPlacement(place);update(port.read());if(exerciseId&&focused?.matches('textarea')){const page=pageOf(viewed),host=page?.kind==='round'?rounds.get(page.key)?.panes.get(viewed.exerciseId)?.presenter.editor:[...groups.values()].find(g=>g.keys.includes(setKey(viewed)))?.presenter.editor;if(host)port.command({type:'exercise-note',exerciseId,host});}logger?.classList.add('is-focus');});settle(viewed??projection.current);
  },
  setWeightIncrement(n){if(destroyed||state.weightIncrement===n)return;state.weightIncrement=n;onInteraction({type:'preference',patch:{weightIncrement:n}});if(enabled)update(snapshot);},
  jump,celebrate,setFeedHeight,isEnabled:()=>enabled&&!destroyed,visibleRef:()=>viewed,focusContext,suspend(value){suspended=value;if(value){noteAnchor=null;advance.cancel();cancelTravel();stopMotion();}syncActive();},restore,
  destroy(){if(destroyed)return;cancelTravel();advance.destroy();scrub.destroy();stopCelebration();if(enabled){enabled=false;logger?.classList.remove('is-focus');restore();}destroyed=true;unsubscribe();events.abort();resize.disconnect();cancelAnimationFrame(scrollFrame);cancelAnimationFrame(fitFrame);for(const card of cards.values())card.destroy();cards.clear();for(const group of groups.values())group.destroy();groups.clear();for(const round of rounds.values())round.destroy();rounds.clear();root.remove();}
 };
}
