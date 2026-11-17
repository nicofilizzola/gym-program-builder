import {actionIcon} from './action-controls.js';
import {setKey} from './workout-focus-model.js';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
const EASE='cubic-bezier(.22,1,.36,1)';

/** One superset round: its context, two partner selectors and both member panes in one grid area (only the selected one operable). */
export function mountWorkoutFocusPair(host,{onSelect,onInteraction=()=>{},reduced,relocate=work=>work()}){
 const context=node('header','focus-round-context'),label=node('p','focus-round-label'),count=node('p','focus-round-count'),group=node('div','focus-partners'),panes=node('div','focus-pair-panes');
 const icon=node('span','focus-round-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=actionIcon('link');label.append(icon,node('span',''));context.append(label,count);
 // One underline moves between the two selectors.
 const underline=node('span','focus-partner-underline');underline.setAttribute('aria-hidden','true');
 group.setAttribute('role','group');host.append(context,group,panes);
 let members=[],selectedIndex=-1;
 // The latest selection's effects (pane entry, underline, selector colours) and each selector's check effect; cancelling settles the final styles.
 let motion=[];const checks=[null,null];
 const buttons=[0,1].map(i=>{
  const button=node('button','focus-partner'),member=node('span','focus-partner-member'),name=node('span','focus-partner-name'),text=node('span',''),absent=node('span','focus-partner-absent','No set this round'),check=node('span','focus-partner-check');
  button.type='button';check.setAttribute('aria-hidden','true');check.innerHTML=actionIcon('check');name.append(text,absent);button.append(member,name,check);group.append(button);
  button.onclick=()=>{const m=members[i];if(!m?.ref)return;onInteraction();onSelect(m.ref);};
  return {button,member,text,absent,check};
 });
 group.append(underline);
 function stopSelection(){for(const a of motion)a.cancel();motion=[];}
 function stopCheck(i){const a=checks[i];checks[i]=null;a?.cancel();buttons[i].check.hidden=!members[i]?.done;}
 function cancelMotion(){stopSelection();stopCheck(0);stopCheck(1);}
 const events=new AbortController();
 reduced.addEventListener('change',()=>{if(reduced.matches)cancelMotion();},{signal:events.signal});
 function animateCheck(i,done){
  const check=buttons[i].check,frames=[{opacity:0,transform:'scale(.65)'},{opacity:1,transform:'scale(1)'}];
  stopCheck(i);if(reduced.matches)return;
  // Undo plays the same signals backwards, keeping the check shown until it has faded.
  check.hidden=false;const a=check.animate(done?frames:frames.reverse(),{duration:160,easing:'ease-out',fill:'forwards'});checks[i]=a;
  a.onfinish=()=>{if(checks[i]===a)stopCheck(i);};
 }
 return {
  update({page,members:next,selected,animate=false,completedKey=null,total=page.round}){
   const key=selected&&setKey(selected),index=next.findIndex(m=>m.key&&m.key===key);
   const moving=animate&&!reduced.matches&&selectedIndex!==-1&&index!==-1&&index!==selectedIndex;
   // Sample what is on screen now so a reversal starts from the current appearance.
   const from=moving?{line:getComputedStyle(underline).transform,colors:buttons.map(b=>{const s=getComputedStyle(b.button);return {backgroundColor:s.backgroundColor,color:s.color};})}:null;
   // A routine patch keeps a running switch; a new selection retargets it.
   if(index!==selectedIndex)stopSelection();
   members=next;
   const letter=next[0].member[0];
   label.lastChild.textContent=`Superset ${letter}`;count.textContent=`Round ${page.round} of ${total}`;group.setAttribute('aria-label',`Superset ${letter} partners`);
   next.forEach((m,i)=>{const b=buttons[i],on=i===index;
    b.member.textContent=m.member;b.text.textContent=m.name;b.button.disabled=!m.ref;b.absent.hidden=Boolean(m.ref);
    // An absent member has no set, so no completion mark at all.
    if(m.ref){if(!checks[i])b.check.hidden=!m.done;if(!b.check.isConnected)b.button.append(b.check);}else{stopCheck(i);b.check.remove();}
    b.button.setAttribute('aria-label',[m.member,m.name,!m.ref?'No set this round':m.done?'complete':''].filter(Boolean).join(', '));
    if(on)b.button.setAttribute('aria-current','step');else b.button.removeAttribute('aria-current');
    if(m.ref&&completedKey&&m.key===completedKey)animateCheck(i,m.done);
   });
   underline.hidden=index===-1;if(index!==-1)group.dataset.selected=index;else delete group.dataset.selected;
   const show=next[index]?.pane??null,live=next.map(m=>m.pane).filter(Boolean);
   // Only attaching panes is a relocation; the focus move below is an ordinary one, so the logger's blur paths (note trimming) run.
   relocate(()=>{for(const m of next)if(m.pane&&m.pane.parentElement!==panes)panes.append(m.pane);});
   // The destination becomes operable and focus moves into it before the old pane becomes inert.
   if(show){show.inert=false;show.classList.remove('is-inactive');}
   const active=document.activeElement;if(active&&!show?.contains(active)&&[...panes.children].some(p=>p.contains(active)))next[index]?.context?.focus({preventScroll:true});
   for(const pane of live)if(pane!==show){pane.inert=true;pane.classList.add('is-inactive');}
   if(moving){
    const timing={duration:200,easing:EASE},dx=index>selectedIndex?12:-12;
    motion=[show.animate([{opacity:0,transform:`translateX(${dx}px)`},{opacity:1,transform:'translateX(0px)'}],timing),underline.animate([{transform:from.line,offset:0}],timing),
     ...buttons.map((b,i)=>b.button.animate([{...from.colors[i],offset:0}],{duration:180,easing:'ease-out'}))];
   }
   selectedIndex=index;
  },
  cancelMotion,
  destroy(){cancelMotion();events.abort();context.remove();group.remove();panes.remove();}
 };
}
