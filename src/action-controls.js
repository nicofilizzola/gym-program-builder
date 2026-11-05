import {tooltipPosition} from './tooltip.js';

const paths={
 reorder:'<path d="M8 20V4m-4 4 4-4 4 4M16 4v16m-4-4 4 4 4-4"/>',
 catalog:'<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
 edit:'<path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14v6Z"/>',
 archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
 restore:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6M12 8v5l3 2"/>',
 move:'<path d="M4 6h12m-4-4 4 4-4 4M20 18H8m4-4-4 4 4 4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
 import:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
 export:'<path d="M12 15V3M8 7l4-4 4 4M4 15v5h16v-5"/>',
 duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
 'move-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
 'move-down':'<path d="M12 4v16m-6-6 6 6 6-6"/>',
 delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 context:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h4"/>',
 logout:'<path d="M9 4H4v16h5m6-13 5 5-5 5M8 12h12"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
 unlink:'<path d="m17.5 12.9 2.1-2.1a4.5 4.5 0 0 0-6.4-6.4L11.1 6.5M6.5 11.1l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l2.1-2.1M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
 swap:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
 settings:'<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 warning:'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4m0 3v.01"/>',
 start:'<path d="M7 4.5v15L19.5 12Z"/>',
 more:'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
 minus:'<path d="M5 12h14"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
 template:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 dumbbell:'<path d="M6 7v10M3 9v6m15-8v10m3-8v6M6 12h12"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
 'star-filled':'<path fill="currentColor" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>'
};
export function actionIcon(name){
 return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
let nextId=0,activeController;
export function mountActionTooltips(root,{selector='[data-action-tooltip]'}={}){
 const tip=document.createElement('div');
 tip.id=`action-tooltip-${++nextId}`;tip.className='action-tooltip';tip.setAttribute('role','tooltip');tip.setAttribute('popover','manual');
 document.body.append(tip);
 let trigger,showTimer,hideTimer,destroyed=false;
 const events=new AbortController(),options={signal:events.signal};
 function hide(){
  clearTimeout(showTimer);showTimer=null;clearTimeout(hideTimer);
  if(trigger){
   const ids=(trigger.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);
   if(ids.length)trigger.setAttribute('aria-describedby',ids.join(' '));else trigger.removeAttribute('aria-describedby');
  }
  trigger=null;if(tip.matches(':popover-open'))tip.hidePopover();
  if(activeController===controller)activeController=null;
 }
 function schedule(button){
  if(trigger===button&&(tip.matches(':popover-open')||showTimer)){clearTimeout(hideTimer);return;}
  activeController?.hide();hide();activeController=controller;trigger=button;
  showTimer=setTimeout(()=>{
   showTimer=null;
   if(destroyed||!button.isConnected||trigger!==button)return;
   tip.textContent=button.dataset.actionTooltip;tip.showPopover();
   const position=tooltipPosition(button.getBoundingClientRect(),tip.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
   tip.style.left=`${position.left}px`;tip.style.top=`${position.top}px`;
   const ids=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);ids.push(tip.id);button.setAttribute('aria-describedby',ids.join(' '));
  },150);
 }
 function depart(){
  if(trigger===document.activeElement)return;
  clearTimeout(showTimer);showTimer=null;clearTimeout(hideTimer);hideTimer=setTimeout(hide,150);
 }
 function buttonAt(target){const button=target instanceof Element?target.closest(selector):null;return button&&root.contains(button)?button:null;}
 root.addEventListener('pointerover',event=>{if(event.pointerType==='mouse'){const button=buttonAt(event.target);if(button)schedule(button);}},options);
 root.addEventListener('pointerout',event=>{const button=buttonAt(event.target);if(button&&!button.contains(event.relatedTarget)&&!tip.contains(event.relatedTarget))depart();},options);
 root.addEventListener('focusin',event=>{const button=buttonAt(event.target);if(button)schedule(button);},options);
 root.addEventListener('focusout',hide,options);
 root.addEventListener('click',event=>{
  const button=buttonAt(event.target);
  if(button?.getAttribute('aria-disabled')==='true')schedule(button);
  else hide();
 },options);
 tip.addEventListener('pointerenter',()=>clearTimeout(hideTimer),options);
 tip.addEventListener('pointerleave',depart,options);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&trigger){hide();}},options);
 document.addEventListener('scroll',()=>{
  // Focus may scroll its control into view before the delayed tooltip opens.
  // Its position is measured when shown; already visible tips still dismiss.
  if(showTimer&&trigger===document.activeElement)return;
  hide();
 },{...options,capture:true});
 window.addEventListener('resize',hide,options);
 const controller={hide,destroy(){hide();destroyed=true;events.abort();tip.remove();}};
 return controller;
}
