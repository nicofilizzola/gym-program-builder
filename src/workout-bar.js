import {formatElapsed} from './workout-sets.js';

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Slim bar fixed to the bottom while a workout is active elsewhere. Slides in/out over 180ms (instant with reduced
 * motion or on initial render); the page reserves its height so nothing is covered.
 */
export function mountWorkoutBar(host,{onResume=()=>{}}={}){
 const bar=document.createElement('section');bar.className='workout-bar';bar.hidden=true;bar.setAttribute('aria-label','Active workout');
 bar.innerHTML='<div class="workout-bar-inner"><p class="workout-bar-text"></p><a class="secondary-btn workout-bar-resume">Resume</a></div>';
 const text=bar.querySelector('.workout-bar-text'),link=bar.querySelector('a');
 let shown=null,interval=null,generation=0,closeTimer=null;
 const tick=()=>{if(shown)text.textContent=`Workout in progress · ${shown.name} · ${formatElapsed(Date.now()-Date.parse(shown.startedAt))}`;};
 // The tab bar (phones) sits below the resume bar, so the page reserves both; pinned page status sits above them.
 const reserve=()=>{document.body.style.paddingBottom=bar.hidden?'':`calc(var(--tab-bar-height) + ${bar.offsetHeight}px)`;document.body.style.setProperty('--workout-bar-space',bar.hidden?'0px':`${bar.offsetHeight}px`);};
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(bar.classList.contains('is-open'))reserve();}):null;
 resize?.observe(bar);
 const visible=()=>{if(document.visibilityState==='visible')tick();};
 document.addEventListener('visibilitychange',visible);
 link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!shown)return;
  event.preventDefault();onResume(shown.id);
 });
 host.append(bar);

 function settleClosed(){clearTimeout(closeTimer);closeTimer=null;bar.hidden=true;reserve();}
 return {
  show(data,{animate=true}={}){
   shown={...data};link.href='#/workouts/'+data.id;tick();
   interval??=setInterval(tick,60000);
   generation++;clearTimeout(closeTimer);closeTimer=null;
   bar.inert=false;bar.removeAttribute('aria-hidden');
   if(bar.classList.contains('is-open')&&!bar.hidden){reserve();return;}
   const wasHidden=bar.hidden;bar.hidden=false;
   // Leaving display:none never transitions; read the closed state first so the slide-in plays.
   if(animate&&wasHidden&&!reducedMotion.matches)getComputedStyle(bar).transform;
   bar.classList.add('is-open');reserve();
  },
  hide({animate=true}={}){
   if(bar.hidden)return;
   clearInterval(interval);interval=null;
   const current=++generation;
   if(bar.contains(document.activeElement))document.activeElement.blur();
   bar.classList.remove('is-open');bar.inert=true;bar.setAttribute('aria-hidden','true');
   if(!animate||reducedMotion.matches){settleClosed();return;}
   const end=event=>{if(event.target===bar&&event.propertyName==='transform'&&current===generation){bar.removeEventListener('transitionend',end);settleClosed();}};
   bar.addEventListener('transitionend',end);
   closeTimer=setTimeout(()=>{bar.removeEventListener('transitionend',end);if(current===generation)settleClosed();},260);
  },
  destroy(){clearInterval(interval);clearTimeout(closeTimer);resize?.disconnect();document.removeEventListener('visibilitychange',visible);bar.remove();document.body.style.paddingBottom='';}
 };
}
