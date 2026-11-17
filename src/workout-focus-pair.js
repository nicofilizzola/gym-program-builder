import {actionIcon} from './action-controls.js';
import {setKey} from './workout-focus-model.js';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};

/** One superset round: its context, two partner selectors and both member panes in one grid area (only the selected one operable). */
export function mountWorkoutFocusPair(host,{onSelect,onInteraction=()=>{},reduced}){
 const context=node('header','focus-round-context'),label=node('p','focus-round-label'),count=node('p','focus-round-count'),group=node('div','focus-partners'),panes=node('div','focus-pair-panes');
 const icon=node('span','focus-round-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=actionIcon('link');label.append(icon,node('span',''));context.append(label,count);
 group.setAttribute('role','group');host.append(context,group,panes);
 let members=[];
 const buttons=[0,1].map(i=>{
  const button=node('button','focus-partner'),member=node('span','focus-partner-member'),name=node('span','focus-partner-name'),text=node('span',''),absent=node('span','focus-partner-absent','No set this round'),check=node('span','focus-partner-check');
  button.type='button';check.setAttribute('aria-hidden','true');check.innerHTML=actionIcon('check');name.append(text,absent);button.append(member,name,check);group.append(button);
  button.onclick=()=>{const m=members[i];if(!m?.ref)return;onInteraction();onSelect(m.ref);};
  return {button,member,text,absent,check};
 });
 return {
  // Final states only; `animate`, `completedKey` and `reduced` are accepted for the partner motion added later.
  update({page,members:next,selected,total=page.round}){
   members=next;const letter=next[0].member[0],key=selected&&setKey(selected);
   label.lastChild.textContent=`Superset ${letter}`;count.textContent=`Round ${page.round} of ${total}`;group.setAttribute('aria-label',`Superset ${letter} partners`);
   next.forEach((m,i)=>{const b=buttons[i],on=Boolean(m.key&&m.key===key);
    b.member.textContent=m.member;b.text.textContent=m.name;b.button.disabled=!m.ref;b.absent.hidden=Boolean(m.ref);
    // An absent member has no set, so no completion mark at all.
    if(m.ref){b.check.hidden=!m.done;if(!b.check.isConnected)b.button.append(b.check);}else b.check.remove();
    b.button.setAttribute('aria-label',[m.member,m.name,!m.ref?'No set this round':m.done?'complete':''].filter(Boolean).join(', '));
    if(on)b.button.setAttribute('aria-current','step');else b.button.removeAttribute('aria-current');
   });
   const show=next.find(m=>m.key&&m.key===key)?.pane??null,live=next.map(m=>m.pane).filter(Boolean);
   // Focus moves to the visible destination before the old pane becomes inert.
   const active=document.activeElement;if(active&&!show?.contains(active)&&[...panes.children].some(p=>p.contains(active)))next.find(m=>m.pane===show)?.context?.focus({preventScroll:true});
   for(const m of next)if(m.pane&&m.pane.parentElement!==panes)panes.append(m.pane);
   for(const pane of live){const on=pane===show;pane.inert=!on;pane.classList.toggle('is-inactive',!on);}
  },
  cancelMotion(){},
  destroy(){context.remove();group.remove();panes.remove();}
 };
}
