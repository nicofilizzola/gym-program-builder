import {nearestIndex} from './workout-focus-model.js';

/** Pointer-only scrubbing along the progress strip: a bubble names the nearest working set and a release near the strip travels there. Keyboard users reach sets through the overview. */
export function mountProgressScrub(button,{strip,targets,describe,onStart,onRelease}){
 const events=new AbortController(),{signal}=events,bubble=document.createElement('div'),name=document.createElement('span'),set=document.createElement('span');
 bubble.className='focus-scrub-bubble';bubble.popover='manual';bubble.setAttribute('aria-hidden','true');name.className='focus-scrub-name';set.className='focus-scrub-set';bubble.append(name,set);document.body.append(bubble);
 let press=null,consumed=false;
 // A scrub's release never opens the overview, even after a cancel; the next press or key clears that.
 function reset(){if(press?.refs){consumed=true;bubble.hidePopover();}press=null;}
 button.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;reset();consumed=false;try{button.setPointerCapture(e.pointerId);}catch{}press={id:e.pointerId,x:e.clientX,refs:null,ref:null};},{signal});
 button.addEventListener('pointermove',e=>{
  if(e.pointerId!==press?.id)return;
  if(!press.refs){if(Math.abs(e.clientX-press.x)<=8)return;const list=targets();if(!list.length)return;onStart();press.refs=list.map(t=>t.ref);press.centers=list.map(({el})=>{const r=el.getBoundingClientRect();return r.left+r.width/2;});bubble.showPopover();}
  press.ref=press.refs[nearestIndex(press.centers,e.clientX)];const text=describe(press.ref);name.textContent=text.exercise;set.textContent=text.set;
  const w=bubble.offsetWidth,h=bubble.offsetHeight;bubble.style.left=Math.max(8,Math.min(e.clientX-w/2,innerWidth-8-w))+'px';bubble.style.top=Math.max(8,strip.getBoundingClientRect().top-h-8)+'px';
 },{signal});
 button.addEventListener('pointerup',e=>{if(e.pointerId!==press?.id)return;const {ref}=press,s=strip.getBoundingClientRect();reset();if(ref&&e.clientY>=s.top-48&&e.clientY<=s.bottom+48)onRelease(ref);},{signal});
 for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(e.pointerId===press?.id)reset();},{signal});
 button.addEventListener('keydown',()=>{consumed=false;},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();},{signal});
 return {consumeClick(){const value=consumed;consumed=false;return value;},destroy(){events.abort();press=null;bubble.remove();}};
}
