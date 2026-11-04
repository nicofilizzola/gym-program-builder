import {tooltipPosition} from './tooltip.js';

let nextId=0;

/** Ordinary buttons in a top-layer group retain native Tab/Enter/Space behavior. */
export function mountReorderMenu({label='Reorder options'}={}){
 const popup=document.createElement('div');
 popup.id=`reorder-options-${++nextId}`;popup.className='reorder-menu';
 popup.setAttribute('popover','manual');popup.setAttribute('role','group');popup.setAttribute('aria-label',label);
 document.body.append(popup);
 const events=new AbortController(),options={signal:events.signal};
 let trigger=null,anchorRect=null;
 function close(restoreFocus=false){
  const previous=trigger;trigger=null;
  previous?.setAttribute('aria-expanded','false');
  if(popup.matches(':popover-open'))popup.hidePopover();
  if(restoreFocus&&previous?.isConnected)previous.focus({preventScroll:true});
 }
 function toggle(button,choices){
  const same=trigger===button;close();if(same)return;
  trigger=button;button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',popup.id);
  popup.replaceChildren(...choices.map(({label,disabled=false,run})=>{
   const option=document.createElement('button');option.type='button';option.className='secondary-btn';option.textContent=label;option.disabled=disabled;
   option.onclick=()=>{close(true);run();};return option;
  }));
  popup.showPopover();
  anchorRect=button.getBoundingClientRect();
  const position=tooltipPosition(anchorRect,popup.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
  popup.style.left=`${position.left}px`;popup.style.top=`${position.top}px`;
  popup.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
 }
 document.addEventListener('pointerdown',event=>{if(trigger&&!trigger.contains(event.target)&&!popup.contains(event.target))close();},options);
 document.addEventListener('focusin',event=>{if(trigger&&!trigger.contains(event.target)&&!popup.contains(event.target))close();},options);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&trigger){event.preventDefault();event.stopImmediatePropagation();close(true);}
 },{...options,capture:true});
 document.addEventListener('scroll',event=>{
  if(!trigger||popup.contains(event.target))return;
  // Click/focus auto-scrolling may deliver its queued event after we positioned
  // the popup. Dismiss only when scrolling actually moves its anchor.
  const rect=trigger.getBoundingClientRect();
  if(Math.abs(rect.top-anchorRect.top)>.5||Math.abs(rect.left-anchorRect.left)>.5)close(true);
 },{...options,capture:true});
 window.addEventListener('resize',()=>close(true),options);
 return {toggle,close,destroy(){close();events.abort();popup.remove();}};
}
