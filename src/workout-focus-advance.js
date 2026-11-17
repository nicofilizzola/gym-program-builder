import {projectWorkout,setKey,focusPages,roundComplete} from './workout-focus-model.js';
const equal=(a,b)=>a===b||Boolean(a&&b&&setKey(a)===setKey(b));

/** The superset round holding `key` in `log`, and where Auto-next goes from it: its unfinished partner, or once complete the first unfinished set on a later page (null = review). Null for ordinary sets. */
function roundAt(log,key){
 const p=projectWorkout(log),{pages,pageByKey}=focusPages(log,p.items),page=pageByKey.get(key);if(page?.kind!=='round')return null;
 const open=pg=>pg.keys.find(k=>!p.doneKeys.has(k)),ref=k=>p.items.find(i=>i.key===k).ref,complete=roundComplete(page,p.doneKeys);
 const next=complete?pages.slice(pages.indexOf(page)+1).find(open):page;
 return {keys:page.keys.join('|'),complete,target:next?ref(open(next)):null};
}

/** Explicit completion intent only; saves and history refreshes cannot schedule this. */
export function createWorkoutAdvance({read,onAdvance,timers=globalThis,reduced=()=>false}){
 let timer=null,destroyed=false;
 function cancel(){if(timer!==null)timers.clearTimeout(timer);timer=null;}
 return {cancel,destroy(){cancel();destroyed=true;},completed({before,after,ref,viewed,autoNext}){
  cancel();if(destroyed||before.id!==after.id||after.status!=='active')return;
  const b=projectWorkout(before),a=projectWorkout(after),key=setKey(ref);
  if(b.doneKeys.has(key)||!a.doneKeys.has(key))return;
  // Ordinary sets keep the first-current gate; a round accepts either member and only moves forward.
  const round=roundAt(after,key);
  if(!autoNext||!equal(viewed,ref)||(!round&&!equal(b.current,ref)))return;
  const target=round?round.target:a.current,logId=after.id;
  function fire(){timer=null;if(destroyed)return;const state=read(),p=projectWorkout(state.log);
   if(state.log.id!==logId||state.log.status!=='active'||state.suspended||!state.autoNext||!equal(state.viewed,viewed)||!p.doneKeys.has(key))return;
   // The round must still be complete with the same members, and lead to the same target.
   const fresh=round&&roundAt(state.log,key);
   if(round?!(fresh?.complete&&fresh.keys===round.keys&&equal(fresh.target,target)):!equal(p.current,target))return;
   onAdvance(target);
  }
  const state=read();if(state.suspended||!state.autoNext||!equal(state.viewed,ref))return;
  // The first partner switches in place at once; only a round's completion waits for its feedback.
  if(round&&!round.complete)return onAdvance(target);
  if(reduced())fire();else timer=timers.setTimeout(fire,650);
 }};
}
