import {parseWeight,parseReps,stepWeight,stepReps} from './workout-sets.js';
import {repRangeHint,repsCaption} from './workout-focus-model.js';

const text=value=>value===null||value===undefined?'':String(value);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

/** A presentation attached to the canonical input; only a deliberate adjustment writes. */
export function mountWorkoutRuler(host,{input,kind,caption=null,onAdjust,onInteraction=()=>{}}){
 const events=new AbortController(),{signal}=events,parse=kind==='weight'?parseWeight:parseReps,min=kind==='weight'?0:1,max=kind==='weight'?999.75:100;
 const root=document.createElement('div');root.className='workout-ruler';root.setAttribute('role','slider');root.hidden=true;
 root.innerHTML='<div class="workout-ruler-track" aria-hidden="true"></div><span class="workout-ruler-needle" aria-hidden="true"></span><span class="workout-ruler-nudge" aria-hidden="true">‹</span><span class="workout-ruler-nudge" aria-hidden="true">›</span>';
 const track=root.firstElementChild,[down,up]=root.querySelectorAll('.workout-ruler-nudge'),guide=document.createElement('p');guide.className='workout-rep-guidance visually-hidden';guide.hidden=true;guide.id='rep-hint-'+crypto.randomUUID();
 host.append(root);if(kind==='reps'){host.append(guide);input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),guide.id].filter(Boolean).join(' '));root.setAttribute('aria-describedby',guide.id);}
 let state={value:null,placeholder:null,increment:kind==='weight'?2.5:1,range:null,enabled:false},offset=0,drag=null,destroyed=false,settleTimer=null;
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 const effective=()=>state.value??state.placeholder??min;
 function updateHint(){
  const parsed=parse(input.value),args={kind:'working',reps:parsed.value,range:state.range,invalid:Boolean(parsed.error)},hint=repRangeHint(args);
  guide.hidden=kind!=='reps'||!state.enabled||!hint;guide.textContent=hint?.text||'';
  const outside=hint?.state==='below'||hint?.state==='above';host.classList.toggle('is-outside-range',!guide.hidden&&outside);
  if(caption&&kind==='reps'){const c=repsCaption(args);caption.textContent=c.text;caption.classList.toggle('is-outside',c.outside);}
 }
 function draw(){
  if(destroyed||!state.enabled)return;
  const width=root.clientWidth,center=width/2,step=state.increment,total=(max-min)/step*32;
  track.style.width=(width+total)+'px';track.style.backgroundPositionX=center+'px';track.style.transform=`translate3d(${-offset}px,0,0)`;
  track.replaceChildren();
  const from=Math.max(0,Math.floor(offset/32)-Math.ceil(width/64)-2),to=Math.min(Math.floor((max-min)/step),Math.ceil(offset/32)+Math.ceil(width/64)+2);
  if(kind==='reps'&&state.range){const band=document.createElement('span');band.className='workout-ruler-target';band.style.left=(center+(state.range.min-min)*32-16)+'px';band.style.width=((state.range.max-state.range.min+1)*32)+'px';track.append(band);}
  for(let index=from;index<=to;index++){
   const tick=document.createElement('span');tick.className='workout-ruler-tick';tick.style.left=(center+index*32)+'px';tick.textContent=String(Number((min+index*step).toFixed(2)));track.append(tick);
  }
  const actual=state.value,n=effective();root.setAttribute('aria-valuenow',n);root.setAttribute('aria-valuetext',actual===null?(state.placeholder===null?'Not entered':`Suggested ${n}${kind==='weight'?' kg':' reps'}`):`${n}${kind==='weight'?' kg':' reps'}`);
  root.setAttribute('aria-valuemin',min);root.setAttribute('aria-valuemax',max);root.setAttribute('aria-label','Adjust '+input.getAttribute('aria-label'));root.setAttribute('aria-orientation','horizontal');
  root.classList.toggle('is-suggestion',actual===null);down.classList.toggle('is-limit',n<=min);up.classList.toggle('is-limit',n>=max);
 }
 function syncPosition(){if(!drag?.moved)offset=(effective()-min)/state.increment*32;draw();}
 function adjust(n){const next=Number(clamp(n,min,max).toFixed(2));if(next!==state.value)onAdjust(next);}
 /** Arrow keys and taps share one step, so a tap equals the key from placeholders, off-grid values and limits. */
 function step(direction){adjust(kind==='weight'?stepWeight(state.value,state.placeholder,direction*state.increment):stepReps(state.value,state.placeholder,direction));syncPosition();}
 function settle(){
  drag=null;root.classList.remove('is-dragging');root.classList.toggle('is-settling',!reduced());syncPosition();
  clearTimeout(settleTimer);settleTimer=setTimeout(()=>root.classList.remove('is-settling'),170);
 }
 // The strip owns a pointer from press to release (touch-action:none); vertical drift never drops the gesture.
 root.addEventListener('pointerdown',e=>{if(!state.enabled||e.button!==0||!e.isPrimary)return;onInteraction();clearTimeout(settleTimer);root.classList.remove('is-settling');try{root.setPointerCapture(e.pointerId);}catch{}drag={id:e.pointerId,x:e.clientX,offset,moved:false};},{signal});
 root.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;
  if(!drag.moved){if(Math.abs(dx)<=8)return;drag.moved=true;root.classList.add('is-dragging');}
  offset=clamp(drag.offset-dx,0,(max-min)/state.increment*32);draw();adjust(min+Math.round(offset/32)*state.increment);
 },{signal});
 root.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;if(drag.moved){settle();return;}drag=null;const rect=root.getBoundingClientRect();step(e.clientX<rect.left+rect.width/2?-1:1);},{signal}); // a tap applies at once, like a key
 for(const event of ['pointercancel','lostpointercapture'])root.addEventListener(event,e=>{if(drag?.id===e.pointerId)settle();},{signal});
 root.addEventListener('wheel',e=>{if(!state.enabled||Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();onInteraction();offset=clamp(offset+e.deltaX,0,(max-min)/state.increment*32);adjust(min+Math.round(offset/32)*state.increment);syncPosition();},{signal,passive:false});
 root.addEventListener('keydown',e=>{
  if(!state.enabled||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();onInteraction();
  if(e.key==='Home'||e.key==='End'){adjust(e.key==='Home'?min:max);syncPosition();}else step(e.key==='ArrowLeft'?-1:1);
 },{signal});
 input.addEventListener('input',updateHint,{signal});
 const observer=new ResizeObserver(()=>syncPosition());observer.observe(root);
 return {
  update(next){if(destroyed)return;state={...state,...next};updateHint();root.hidden=!state.enabled;root.tabIndex=state.enabled?0:-1;if(!state.enabled){drag=null;track.replaceChildren();guide.hidden=true;return;}syncPosition();},
  destroy(){if(destroyed)return;destroyed=true;events.abort();observer.disconnect();clearTimeout(settleTimer);root.remove();guide.remove();host.classList.remove('is-outside-range');input.setAttribute('aria-describedby',(input.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==guide.id).join(' '));}
 };
}
