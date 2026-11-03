import {chooseAction,confirmAction} from './confirm-dialog.js';
import {createWorkoutLog,workoutSummary,validateWorkoutLog} from './workout-log.js';
import {finishWorkout,undoneSetCount} from './workout-edit.js';
import {readMirror,clearMirror,createWorkoutSync,recoveryDecision,isNetworkError} from './workout-sync.js';

export const NO_SETS='Log at least one set, or discard the workout.';
export const OFFLINE_DISCARD='Connect to discard this workout.';
export const PENDING_FINISH='Your finished workout has not synced yet. Connect to sync it before starting a new workout.';
export const linkedVariantIds=log=>[...new Set(log.exercises.map(e=>e.variantId).filter(Boolean))];

/**
 * Owns the one sync of the active (or finished but not yet synced) workout across routes, so retries continue
 * while the user is elsewhere and two logs never write the single mirror. Loggers attach to it; they never create one.
 */
export function createWorkoutController({api,storage=globalThis.localStorage,choose=chooseAction,confirm=confirmAction,navigate=async()=>{},bar=null,
 onError=()=>{},onSignIn=()=>{},now=()=>new Date(),makeId=()=>crypto.randomUUID(),timers=globalThis,events=globalThis}){
 let owned=null,view=null,booted=false,resolving=false,starting=false;

 const ownedId=()=>owned?.sync?.log.id??null;
 const isActive=()=>Boolean(owned?.sync)&&owned.sync.log.status==='active';
 function refreshBar({animate=true}={}){
  if(!bar)return;
  const log=owned?.sync?.log;
  if(log&&log.status==='active'&&view?.id!==log.id)bar.show({id:log.id,name:log.name,startedAt:log.startedAt},{animate});
  else bar.hide({animate});
 }
 function release(entry=owned){if(!entry||owned!==entry)return;owned=null;entry.sync?.dispose();}
 function own(record,{lastTime=null,dirty=false}={}){
  release();
  const entry={sync:null,status:'',conflict:null};
  owned=entry;
  entry.sync=createWorkoutSync({api,storage,record,lastTime,dirty,timers,events,
   onStatus:text=>{if(owned!==entry)return;entry.status=text;if(view?.id===record.id)view.setStatus?.(text);if(text==='Sign in to sync')onSignIn();},
   onRecord:value=>{
    // A finished snapshot acknowledged with nothing pending is done: the sync already cleared the mirror.
    if(owned===entry&&value.log.status==='finished')queueMicrotask(()=>{if(owned===entry&&!entry.sync.isDirty()){release(entry);refreshBar();}});
   },
   onConflict:reason=>{if(owned===entry)resolveConflict(entry,reason);}});
  return entry;
 }

 /** Last time for linked variants: network failures give null (offline copy); other errors are reported and left absent. */
 async function fetchLastTime(ids,exclude){
  if(!ids.length)return {};
  try{return await api.lastTime({variantIds:ids,exclude});}
  catch(error){if(isNetworkError(error))return null;onError(error);return undefined;}
 }

 async function resolveConflict(entry,reason){
  entry.conflict=reason;
  if(resolving)return;
  resolving=true;
  try{
   while(owned===entry&&entry.conflict){
    const current=entry.conflict;
    const choice=await choose({title:'Workout changed elsewhere',
     message:current==='active_exists'?'Another workout is already in progress on another device.':'This workout was changed on another device.',
     choices:[{value:'keep',label:'Keep this device\'s version',primary:true},{value:'saved',label:'Use saved version'}]});
    if(owned!==entry||!choice)break;
    if(choice==='keep'){
     entry.conflict=null;
     try{await entry.sync.keepLocal();}catch(error){entry.conflict??=current;onError(error);break;}
     continue;
    }
    if(!await confirm({title:'Use saved version?',message:'Your changes on this device will be discarded.',confirmLabel:'Use saved version',destructive:true}))break;
    if(owned!==entry)break;
    entry.conflict=null;
    let server;
    try{server=await entry.sync.useSaved();}catch(error){entry.conflict??=current;onError(error);break;}
    await afterUseSaved(entry,server,current);
   }
  }finally{resolving=false;}
 }
 async function afterUseSaved(entry,server,reason){
  if(owned!==entry)return;
  const id=entry.sync.log.id;
  if(!server){
   // The saved copy is gone (useSaved already cleared the mirror). Another device's active log takes over.
   release(entry);
   let other=null;
   if(reason==='active_exists')other=await api.activeWorkout().catch(()=>null);
   if(other&&!owned)own(other);
   refreshBar();
   await navigate(other?'#/workouts/'+other.id:'#/workouts');
   return;
  }
  if(server.log.status==='finished'){release(entry);clearMirror(storage);refreshBar();await navigate('#/workouts/'+server.id);return;}
  if(view?.id===id)view.setLog?.(server.log);
  refreshBar();
 }

 async function finish(){
  if(resolving||!isActive())return false;
  const entry=owned,log=entry.sync.log;
  if(!log.exercises.some(e=>e.sets.some(s=>s.done)))throw Error(NO_SETS);
  const open=undoneSetCount(log);
  if(open&&!await confirm({title:'Finish workout?',message:`${open===1?'1 set':`${open} sets`} not completed — finish anyway? Uncompleted sets will be removed.`,confirmLabel:'Finish workout'}))return false;
  if(owned!==entry||!isActive())return false;
  const result=finishWorkout(entry.sync.log,now());
  if(result.error)throw Error(result.error);
  entry.sync.change(result.log);
  refreshBar();
  await entry.sync.flush().catch(()=>{});
  return true;
 }

 async function discard(){
  if(resolving||!owned?.sync)return false;
  const entry=owned,id=entry.sync.log.id;
  await entry.sync.flush().catch(()=>{});
  if(owned!==entry)return false;
  const offline=error=>isNetworkError(error)?Error(OFFLINE_DISCARD):error;
  const remove=revision=>api.deleteWorkout({id,revision}).catch(error=>{if(error?.status===404)return;throw error;});
  const fetchServer=()=>api.getWorkout(id).catch(error=>{if(error?.status===404)return null;throw error;});
  const revision=entry.sync.revision;
  if(revision===0){
   // Never acknowledged: an unacknowledged first save may still have created it.
   let server=null;
   try{server=await fetchServer();}catch(error){if(!isNetworkError(error))throw error;}
   if(server)await remove(server.revision).catch(error=>{throw offline(error);});
  }else{
   try{await remove(revision);}
   catch(error){
    if(error?.status!==409)throw offline(error);
    const server=await fetchServer().catch(e=>{throw offline(e);});
    if(server){
     if(server.log.status!=='active')throw Error('This workout was finished on another device.');
     await remove(server.revision).catch(e=>{throw offline(e);});
    }
   }
  }
  if(owned!==entry)return false;
  release(entry);clearMirror(storage);refreshBar();
  return true;
 }

 async function start({template,program,occurrenceId}={}){
  if(starting||resolving)return false;
  starting=true;
  try{
   if(!owned){
    // A log started on another device since boot: offer it instead of a server rejection later.
    try{const other=await api.activeWorkout();if(other&&!owned){own(other);refreshBar();}}
    catch(error){if(!isNetworkError(error))throw error;}
   }
   if(owned&&!isActive()){
    const entry=owned;
    await entry.sync.flush().catch(()=>{});
    if(owned===entry&&entry.sync.isDirty())throw Error(PENDING_FINISH);
    release(entry);
   }
   if(owned){
    const log=owned.sync.log;
    const choice=await choose({title:'Workout in progress',message:`Resume, finish or discard ${log.name} before starting a new workout.`,
     choices:[{value:'resume',label:'Resume current'},{value:'finish',label:'Finish current'},{value:'discard',label:'Discard current',destructive:true}]});
    if(!choice||ownedId()!==log.id)return false;
    if(choice==='resume'){await navigate('#/workouts/'+log.id);return false;}
    if(choice==='finish'&&!await finish())return false;
    if(choice==='discard'){
     if(!await confirm({title:'Discard workout?',message:'This workout and its sets will be deleted. This cannot be undone.',confirmLabel:'Discard workout',destructive:true}))return false;
     if(!await discard())return false;
    }
    if(owned){if(owned.sync.isDirty())throw Error(PENDING_FINISH);release();}
   }
   const id=makeId();
   const checked=validateWorkoutLog(createWorkoutLog({id,now:now(),makeId,template,program,occurrenceId}));
   if(checked.error)throw Error(checked.error);
   const entry=own({id,revision:0,log:checked.log},{dirty:true});
   const last=await fetchLastTime(linkedVariantIds(checked.log),id);
   if(owned!==entry)return false;
   entry.sync.setLastTime(last===undefined?{}:last);
   await navigate('#/workouts/'+id);
   return true;
  }finally{starting=false;}
 }

 async function boot(){
  if(booted)return;
  booted=true;
  const mirror=readMirror(storage);
  let reachable=true,active=null,server=null;
  try{active=await api.activeWorkout();}catch(error){if(!isNetworkError(error))throw error;reachable=false;}
  if(mirror&&reachable){
   // The mirror's own log decides recovery; a different active log never silently replaces dirty local data.
   if(active?.id===mirror.log.id)server=active;
   else try{server=await api.getWorkout(mirror.log.id);}catch(error){if(error?.status===404)server=null;else if(isNetworkError(error))reachable=false;else throw error;}
  }
  if(owned)return;
  if(mirror){
   const {action}=recoveryDecision({mirror,server,reachable});
   if(action==='use-server'){own(server,{lastTime:mirror.lastTime});return;}
   if(action==='resume-local'||action==='conflict'){own({id:mirror.log.id,revision:mirror.baseRevision,log:mirror.log},{lastTime:mirror.lastTime,dirty:mirror.dirty});return;}
   if(action==='clear-mirror')clearMirror(storage);
  }
  if(reachable&&active)own(active);
 }

 /** A logger for `id` binds to the controller's sync; returns its callbacks and a detach. */
 function attach(id,handlers){
  const mine={id,...handlers};view=mine;
  const entry=owned?.sync?.log.id===id?owned:null;
  if(entry){
   handlers.setStatus?.(entry.status);
   if(entry.conflict&&!resolving)queueMicrotask(()=>{if(owned===entry&&entry.conflict)resolveConflict(entry,entry.conflict);});
   if(entry.sync.lastTime===null){
    const ids=linkedVariantIds(entry.sync.log);
    if(ids.length)fetchLastTime(ids,id).then(map=>{if(map&&owned===entry){entry.sync.setLastTime(map);if(view===mine)mine.setLastTime?.(map);}});
   }
  }
  const forMe=()=>owned?.sync?.log.id===id?owned:null;
  return {
   onChange(log){forMe()?.sync.change(log);},
   async onFinish(){const target=forMe();await target?.sync.flush().catch(()=>{});await navigate('#/workouts');},
   async onDiscard(){if(forMe()&&await discard())await navigate('#/workouts');},
   async onLastTimeNeeded(ids){
    const target=forMe();if(!target)return;
    const wanted=target.sync.lastTime===null?linkedVariantIds(target.sync.log):ids;
    let map;
    try{map=await api.lastTime({variantIds:wanted,exclude:id});}
    catch(error){if(isNetworkError(error))throw error;onError(error);return;}
    if(owned!==target)return;
    const merged={...(target.sync.lastTime||{}),...map};
    target.sync.setLastTime(merged);if(view===mine)mine.setLastTime?.(merged);
   },
   detach(){if(view===mine)view=null;}
  };
 }

 return {
  boot,start,finish,discard,attach,refreshBar,
  get current(){return isActive()?{sync:owned.sync,log:owned.sync.log,lastTime:owned.sync.lastTime}:null;},
  /** Adopts an active server log (from another device) unless unsynced local changes are owned; true when this log is owned. */
  adopt(record){
   if(ownedId()===record.id)return true;
   if(record.log.status!=='active')return false;
   if(owned){
    // The server holds one active log, so a clean owned log was finished or discarded elsewhere; local changes never are dropped.
    if(owned.conflict||owned.sync.isDirty()||owned.sync.revision===0)return false;
    release();clearMirror(storage);
   }
   own(record);return true;
  },
  owns:id=>ownedId()===id,
  snapshot(){return owned?.sync?{log:owned.sync.log,lastTime:owned.sync.lastTime}:null;},
  pendingSummary(){const log=owned?.sync?.log;return log&&log.status==='finished'&&owned.sync.isDirty()?workoutSummary(log):null;},
  resume(){return owned?.sync?.resume().catch(()=>{});}
 };
}
