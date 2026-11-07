import {selectBestPerformance} from './workout-best.js';
import {formatLastTime} from './workout-sets.js';

/** Benchmark presentation only; requests and caches remain with the logger/controller. */
export function mountWorkoutHistory(host,state){
 host.innerHTML='<p class="log-last-time"><span class="log-last-label"></span><span class="log-last-value"></span></p><p class="log-last-note" hidden></p><p class="log-best"></p>';
 const label=host.querySelector('.log-last-label'),value=host.querySelector('.log-last-value'),note=host.querySelector('.log-last-note'),best=host.querySelector('.log-best');
 function update({exercise:ex,lastTime:last,bestPerformance,bestStatus=new Map(),unavailable=new Set()}){
  const entry=last&&ex.variantId&&!unavailable.has(ex.variantId)?last[ex.variantId]:null;
  const known=last!==null&&!unavailable.has(ex.variantId);
  label.textContent=entry?'Last time':'';label.hidden=!entry;
  value.textContent=!ex.variantId?'No history':!known?'Last time unavailable offline':entry?formatLastTime(entry.sets):'No history';
  const text=entry?.note||'';note.hidden=!text;note.title=text;
  note.replaceChildren();if(text){const prefix=document.createElement('span');prefix.className='visually-hidden';prefix.textContent='Last time note:';note.append(prefix,`“${text}”`);}
  const range=ex.target?.repRange,title=range?`Best (${range.min}–${range.max} reps)`:'Best';
  if(ex.variantId&&!Object.hasOwn(bestPerformance||{},ex.variantId)){
   const status=bestStatus.get(ex.variantId)||'loading';best.textContent=status==='offline'?'Best unavailable offline':status==='error'?'Best unavailable':'Loading best…';return;
  }
  const winner=selectBestPerformance(ex.variantId?bestPerformance?.[ex.variantId]??[]:[],range);
  if(!winner){best.textContent=title+' · No qualifying performance';return;}
  const time=document.createElement('time');time.dateTime=winner.finishedAt;time.textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(winner.finishedAt));
  best.replaceChildren(`${title} · ${winner.weightKg===0?'BW':winner.weightKg+' kg'} × ${winner.reps} · `,time);
 }
 update(state);return {update,destroy(){host.replaceChildren();}};
}
