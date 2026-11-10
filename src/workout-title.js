/** Overflow-only title motion. The heading and its full accessible name survive every update. */
export function mountWorkoutTitle(heading,{text,active=false,suspended=false,onInteraction=()=>{}}){
 const events=new AbortController(),{signal}=events,reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const control=document.createElement('span');control.className='workout-title-control';
 const track=document.createElement('span');track.className='workout-title-track';track.setAttribute('aria-hidden','true');
 const copies=[document.createElement('span'),document.createElement('span')];copies.forEach(copy=>{copy.className='workout-title-copy';track.append(copy);});control.append(track);heading.replaceChildren(control);heading.classList.add('workout-title');
 const instructions=document.createElement('span');instructions.className='visually-hidden';instructions.id='title-help-'+crypto.randomUUID();instructions.textContent='Tap or press Enter or Space to pause or resume. Swipe or use arrow keys to read the name. Automatic motion is disabled with reduced motion.';heading.after(instructions);control.setAttribute('aria-describedby',instructions.id);
 let state={text,active,suspended},overflow=false,paused=false,offset=0,period=1,frame=null,last=0,hold=performance.now()+1400,drag=null,moved=false,destroyed=false;
 const canRun=()=>!destroyed&&state.active&&!state.suspended&&overflow&&!paused&&!drag&&!reduced.matches&&!document.hidden;
 function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;}
 function draw(){offset=((offset%period)+period)%period;track.style.transform=`translate3d(${-offset}px,0,0)`;}
 function semantics(){
  heading.setAttribute('aria-label',state.text);heading.classList.toggle('is-overflowing',overflow);control.tabIndex=overflow?0:-1;
  if(!overflow){control.removeAttribute('role');control.removeAttribute('aria-label');control.removeAttribute('aria-pressed');control.removeAttribute('title');return;}
  control.setAttribute('role',reduced.matches?'region':'button');control.setAttribute('aria-label',reduced.matches?'Exercise title: '+state.text:(paused?'Resume':'Pause')+' scrolling title: '+state.text);
  if(reduced.matches)control.removeAttribute('aria-pressed');else control.setAttribute('aria-pressed',paused);
  control.title=reduced.matches?'Swipe to read the full title':'Tap to pause or resume · Swipe to read';
 }
 function tick(now){frame=null;if(!canRun())return;const elapsed=last?Math.min(now-last,50):0;last=now;if(now>=hold){offset+=elapsed*.022;draw();}frame=requestAnimationFrame(tick);}
 function schedule(){if(canRun()&&frame===null){last=performance.now();frame=requestAnimationFrame(tick);}else if(!canRun())stop();}
 function measure(){
  if(destroyed||heading.clientWidth===0)return;
  const width=copies[0].getBoundingClientRect().width;period=Math.max(1,width+48);overflow=width>heading.clientWidth+1;copies[1].hidden=!overflow;
  if(!overflow)offset=0;semantics();draw();schedule();
 }
 function setText(){for(const copy of copies)copy.textContent=state.text;semantics();measure();}
 function toggle(){if(!overflow||reduced.matches)return;onInteraction();paused=!paused;hold=performance.now()+250;semantics();schedule();}
 control.addEventListener('pointerdown',e=>{if(!overflow||e.button!==0||!e.isPrimary)return;onInteraction();moved=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,offset,locked:false};stop();},{signal});
 control.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>8)moved=true;
  if(!drag.locked){if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){drag=null;hold=performance.now()+2200;schedule();return;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.25)return;drag.locked=true;try{control.setPointerCapture(e.pointerId);}catch{}control.classList.add('is-dragging');}
  offset=drag.offset-dx;draw();
 },{signal});
 function release(e){if(e.type==='pointercancel')moved=true;if(drag?.id!==e.pointerId)return;drag=null;control.classList.remove('is-dragging');hold=performance.now()+2200;schedule();}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(name,release,{signal});
 control.addEventListener('click',e=>{if(moved&&e.detail!==0){e.preventDefault();return;}toggle();},{signal});
 control.addEventListener('keydown',e=>{
  if(!overflow)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)toggle();return;}
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();onInteraction();hold=performance.now()+2200;
  offset=e.key==='Home'?0:e.key==='End'?Math.max(0,period-48-heading.clientWidth):offset+(e.key==='ArrowRight'?60:-60);draw();
 },{signal});
 control.addEventListener('wheel',e=>{if(!overflow||Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();onInteraction();offset+=e.deltaX;hold=performance.now()+2200;draw();},{signal,passive:false});
 document.addEventListener('visibilitychange',()=>{hold=performance.now()+1400;schedule();},{signal});reduced.addEventListener('change',()=>{semantics();schedule();},{signal});
 const observer=new ResizeObserver(measure);observer.observe(heading);document.fonts?.ready.then(()=>{if(!destroyed)measure();});setText();
 return {
  update(next){if(destroyed)return;const old=state;state={...state,...next};if(!old.active&&state.active||old.suspended&&!state.suspended)hold=performance.now()+1400;if(old.text!==state.text)setText();else{measure();schedule();}},
  destroy(){if(destroyed)return;destroyed=true;stop();events.abort();observer.disconnect();heading.classList.remove('workout-title','is-overflowing');heading.replaceChildren(document.createTextNode(state.text));instructions.remove();}
 };
}
