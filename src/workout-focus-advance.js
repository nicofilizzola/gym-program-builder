import {projectWorkout,setKey} from './workout-focus-model.js';
const equal=(a,b)=>a===b||Boolean(a&&b&&setKey(a)===setKey(b));

/** Explicit completion intent only; saves and history refreshes cannot schedule this. */
export function createWorkoutAdvance({read,onAdvance,timers=globalThis,reduced=()=>false}){
 let timer=null,destroyed=false;
 function cancel(){if(timer!==null)timers.clearTimeout(timer);timer=null;}
 return {cancel,destroy(){cancel();destroyed=true;},completed({before,after,ref,viewed,autoNext}){
  cancel();if(destroyed||before.id!==after.id||after.status!=='active')return;
  const b=projectWorkout(before),a=projectWorkout(after),key=setKey(ref);
  if(b.doneKeys.has(key)||!a.doneKeys.has(key))return;
  if(!autoNext||!equal(viewed,ref)||!equal(b.current,ref))return;
  const target=a.current,logId=after.id;
  function fire(){timer=null;if(destroyed)return;const state=read(),p=projectWorkout(state.log);
   if(state.log.id!==logId||state.log.status!=='active'||state.suspended||!state.autoNext||!equal(state.viewed,viewed)||!p.doneKeys.has(key)||!equal(p.current,target))return;
   onAdvance(target);
  }
  const state=read();if(state.suspended||!state.autoNext||!equal(state.viewed,ref))return;
  if(reduced())fire();else timer=timers.setTimeout(fire,650);
 }};
}
