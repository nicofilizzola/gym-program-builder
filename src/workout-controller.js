import {chooseAction,confirmAction} from './confirm-dialog.js';
import {createWorkoutLog,workoutSummary,validateWorkoutLog} from './workout-log.js';
import {finishWorkout,confirmFinish,NO_SETS as FINISH_NO_SETS} from './workout-edit.js';
import {readMirror,clearMirror,createWorkoutSync,recoveryDecision,isNetworkError} from './workout-sync.js';

export const NO_SETS=FINISH_NO_SETS;
export const OFFLINE_DISCARD='Connect to discard this workout.';
export const UNRECOVERED='A workout saved on this device could not be recovered yet. Reload or sign in, then try again.';
export const PENDING_FINISH='Your finished workout has not synced yet. Connect to sync it before starting a new workout.';
export const linkedVariantIds=log=>[...new Set(log.exercises.map(e=>e.variantId).filter(Boolean))];

/**
 * Owns the one sync of the active (or finished but not yet synced) workout across routes, so retries continue
 * while the user is elsewhere and two logs never write the single mirror. Loggers attach to it; they never create one.
 */
export function createWorkoutController({api,storage=globalThis.localStorage,choose=chooseAction,confirm=confirmAction,navigate=async()=>{},bar=null,
 onError=()=>{},onSignIn=()=>{},now=()=>new Date(),makeId=()=>crypto.randomUUID(),timers=globalThis,events=globalThis}){
 let owned=null,view=null,booted=false,booting=null,resolving=false,starting=false,session=0;
 const observers=new Set(),barSuppression=new Set();
 let lastPublished='';
 function homeSnapshot(){
  const log=owned?.sync?.log;
  return {activeLog:log?.status==='active'?log:null,pending:log?.status==='finished'&&owned.sync.isDirty()?workoutSummary(log):null};
 }
 function notify(reason='change'){
  const snapshot=homeSnapshot(),key=JSON.stringify(snapshot);
  if(reason==='change'&&key===lastPublished)return;
  lastPublished=key;
  for(const listener of observers){try{listener({reason,snapshot:structuredClone(snapshot)});}catch{/* observers cannot interrupt workout sync */}}
 }

 const ownedId=()=>owned?.sync?.log.id??null;
 /** Tells a finishing attachment about its entry: status, conflict, or the released finished acknowledgement. */
 const tell=(entry,event,value)=>{for(const watch of [...entry.watchers])watch(event,value);};
 /** A dirty mirror this controller does not own (a failed or pending boot): never overwrite it. */
 const strayMirror=()=>{const mirror=readMirror(storage);return mirror?.dirty&&mirror.log.id!==ownedId()?mirror:null;};
 const isActive=()=>Boolean(owned?.sync)&&owned.sync.log.status==='active';
 function refreshBar({animate=true}={}){
  if(!bar)return;
  const log=owned?.sync?.log;
  if(log&&log.status==='active'&&view?.id!==log.id&&!barSuppression.size)bar.show({id:log.id,name:log.name,startedAt:log.startedAt},{animate});
  else bar.hide({animate});
 }
 function release(entry=owned){if(!entry||owned!==entry)return;owned=null;entry.sync?.dispose();notify('ownership');}
 function own(record,{lastTime=null,bestPerformance=null,dirty=false}={}){
  release();
  const entry={sync:null,status:'',conflict:null,bestRequests:new Map(),watchers:new Set()};
  owned=entry;
  entry.sync=createWorkoutSync({api,storage,record,lastTime,bestPerformance,dirty,timers,events,
   onLogChange:()=>{if(owned===entry&&entry.sync)notify(entry.sync.log.status==='finished'?'finish':'change');},
   onStatus:text=>{if(owned!==entry)return;entry.status=text;if(view?.id===record.id)view.setStatus?.(text);tell(entry,'status');if(text==='Sign in to sync')onSignIn();},
   onRecord:value=>{
    // A finished snapshot acknowledged with nothing pending is done: the sync already cleared the mirror.
    // Ownership is released before the acknowledged record is handed on, so there is never a second writer.
    if(owned===entry&&value.log.status==='finished')queueMicrotask(()=>{if(owned===entry&&!entry.sync.isDirty()){release(entry);refreshBar();tell(entry,'released',value);}});
   },
   onConflict:reason=>{if(owned===entry)resolveConflict(entry,reason);}});
  notify('ownership');return entry;
 }

 /** Last time for linked variants: network failures give null (offline copy); other errors are reported and left absent. */
 async function fetchLastTime(ids,exclude){
  if(!ids.length)return {};
  try{return await api.lastTime({variantIds:ids,exclude});}
  catch(error){if(isNetworkError(error))return null;onError(error);return undefined;}
 }

 /** The conflict dialog and its follow-up confirmations, from what the server holds now. */
 async function conflictPrompt(entry,reason){
  const here=entry.sync.log,title='Workout changed elsewhere';
  const keep={value:'keep',label:'Keep this device\'s version',primary:true},saved={value:'saved',label:'Use saved version'};
  const useSaved={title:'Use saved version?',message:'Your changes on this device will be discarded.',confirmLabel:'Use saved version',destructive:true};
  if(reason==='active_exists'){
   // Name what each choice discards; Keep may only delete the workout that was named.
   // Unreachable: generic name, and Keep discards whichever other workout is active. Known (even none): only that one.
   const other=await api.activeWorkout().catch(()=>undefined),known=other&&other.id!==here.id?other:null;
   const otherName=known?known.log.name:'the other workout',capital=otherName[0].toUpperCase()+otherName.slice(1);
   return {otherId:other===undefined?undefined:known?known.id:null,
    dialog:{title,message:`${capital} is in progress on another device. Only one workout can be in progress.`,
     choices:[{...keep,label:`Keep ${here.name} (discards ${otherName})`},{...saved,label:`Switch to ${otherName} (discards ${here.name})`}]},
    confirmKeep:{title:`Discard ${otherName}?`,message:`${capital} and its sets will be deleted. This cannot be undone.`,confirmLabel:'Discard workout',destructive:true},
    confirmSaved:{title:`Discard ${here.name}?`,message:'This workout and its sets on this device will be discarded.',confirmLabel:'Discard workout',destructive:true}};
  }
  // Unknown (offline) server state shows the plain dialog; keepLocal still refuses to reactivate a finished copy.
  const server=await entry.sync.savedVersion().catch(()=>undefined);
  if(server?.log.status==='finished'){
   // A finished copy cannot become active again: Keep finishes this device's log, so it needs a done set.
   const message='This workout was finished on another device.';
   if(finishWorkout(here,now()).error)return {dialog:{title,message,choices:[{...saved,primary:true}]},confirmSaved:useSaved};
   return {finish:true,dialog:{title,message:`${message} Keep this device's version to finish it with this device's sets.`,choices:[keep,saved]},confirmSaved:useSaved};
  }
  return {dialog:{title,message:'This workout was changed on another device.',choices:[keep,saved]},confirmSaved:useSaved};
 }
 async function resolveConflict(entry,reason){
  entry.conflict=reason;tell(entry,'conflict');
  if(resolving)return;
  resolving=true;
  try{
   while(owned===entry&&entry.conflict){
    const current=entry.conflict;
    const prompt=await conflictPrompt(entry,current);
    if(owned!==entry)break;
    const choice=await choose(prompt.dialog);
    if(owned!==entry||!choice)break;
    if(choice==='keep'){
     let transform;
     if(prompt.finish){
      const read=()=>owned===entry?entry.sync.log:null;
      const result=await confirmFinish(read,{confirm,now});
      if(result.cancelled||owned!==entry)break;
      if(result.error){onError(Error(result.error));break;}
      // Finish the log as it is when it is saved, with the same finish time the user just accepted.
      const finishedAt=result.log.finishedAt;
      transform=value=>{const r=finishWorkout(value,new Date(Date.parse(finishedAt)));if(r.error)throw Error(r.error);return r.log;};
     }else if(prompt.confirmKeep&&!await confirm(prompt.confirmKeep))break;
     if(owned!==entry)break;
     const id=entry.sync.log.id;
     entry.conflict=null;
     try{await entry.sync.keepLocal({transform,otherId:prompt.otherId});}
     catch(error){
      entry.conflict??=current;
      // The server changed since the dialog was shown: ask again with what it holds now.
      if(error?.code==='finished_elsewhere'||error?.code==='other_changed')continue;
      onError(error);break;
     }
     // Kept as finished: the log leaves the active logger (released once synced, read-only while pending).
     if(transform){refreshBar();await navigate('#/workouts/'+id);}
     continue;
    }
    if(!await confirm(prompt.confirmSaved))break;
    if(owned!==entry)break;
    entry.conflict=null;
    let server;
    try{server=await entry.sync.useSaved();}catch(error){entry.conflict??=current;onError(error);break;}
    await afterUseSaved(entry,server,current);
   }
  }finally{resolving=false;}
 }
 async function afterUseSaved(entry,server,reason){
  if(server?.log.status==='finished'){
   // The finished copy's acknowledgement may already have released the entry (and cleared the mirror).
   if(owned===entry){release(entry);clearMirror(storage);}
   else if(owned)return;
   refreshBar();await navigate('#/workouts/'+server.id);return;
  }
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
  if(view?.id===id)view.setLog?.(server.log);
  refreshBar();
 }

 async function finish(){
  if(resolving||!isActive())return false;
  const entry=owned;
  const result=await confirmFinish(()=>owned===entry&&isActive()?entry.sync.log:null,{confirm,now});
  if(result.cancelled)return false;
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
  release(entry);clearMirror(storage);refreshBar();notify('discard');
  return true;
 }

 async function start({template,program,occurrenceId}={}){
  if(starting||resolving)return false;
  starting=true;
  try{
   // Recover this device's unsynced log first; a failed boot stops the start instead of overwriting the mirror.
   await boot();
   if(strayMirror())throw Error(UNRECOVERED);
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

 /** Recovers the mirror and the server's active log. Idempotent after success; a failure is retried on the next call. */
 function boot(){
  if(booted)return Promise.resolve();
  const mine=session;
  booting??=recover(mine).then(()=>{if(mine===session)booted=true;},error=>{if(mine===session)booting=null;throw error;});
  return booting;
 }
 async function recover(mine){
  const mirror=readMirror(storage);
  let reachable=true,active=null,server=null;
  try{active=await api.activeWorkout();}catch(error){if(!isNetworkError(error))throw error;reachable=false;}
  if(mirror&&reachable){
   // The mirror's own log decides recovery; a different active log never silently replaces dirty local data.
   if(active?.id===mirror.log.id)server=active;
   else try{server=await api.getWorkout(mirror.log.id);}catch(error){if(error?.status===404)server=null;else if(isNetworkError(error))reachable=false;else throw error;}
  }
  // Signed out meanwhile: the next sign-in boots again.
  if(owned||mine!==session)return;
  if(mirror){
   const {action}=recoveryDecision({mirror,server,reachable});
   if(action==='use-server'){own(server,{lastTime:mirror.lastTime,bestPerformance:mirror.bestPerformance});return;}
   if(action==='resume-local'||action==='conflict'){own({id:mirror.log.id,revision:mirror.baseRevision,log:mirror.log},{lastTime:mirror.lastTime,bestPerformance:mirror.bestPerformance,dirty:mirror.dirty});return;}
   if(action==='clear-mirror')clearMirror(storage);
  }
  if(reachable&&active)own(active);
 }

 /** A logger for `id` binds to the controller's sync; returns its callbacks and a detach. */
 function attach(id,handlers){
  const mine={id,...handlers};view=mine;
  const entry=owned?.sync?.log.id===id?owned:null;
  async function refreshBest(ids){
   const target=owned?.sync?.log.id===id?owned:null;if(!target||!ids.length)return;
   const generations=new Map(ids.map(variantId=>{const generation=(target.bestRequests.get(variantId)||0)+1;target.bestRequests.set(variantId,generation);return [variantId,generation];}));
   const currentIds=()=>owned===target?ids.filter(variantId=>target.bestRequests.get(variantId)===generations.get(variantId)):[];
   const publish=status=>{const variantIds=currentIds();if(variantIds.length&&view===mine)mine.setBestStatus?.({variantIds,status});};
   publish('loading');
   try{
    const map=await api.bestPerformance({variantIds:ids,exclude:id}),valid=currentIds();if(!valid.length)return;
    const merged={...(target.sync.bestPerformance||{})};for(const variantId of valid)if(Object.hasOwn(map,variantId))merged[variantId]=map[variantId];
    target.sync.setBestPerformance(merged);if(view===mine)mine.setBestPerformance?.(merged);publish('ready');
   }catch(error){if(!currentIds().length||view!==mine)return;publish(isNetworkError(error)?'offline':'error');if(!isNetworkError(error)){onError(error);if(error.status===401)onSignIn();}}
  }
  if(entry){
   handlers.setStatus?.(entry.status);
   void refreshBest(linkedVariantIds(entry.sync.log));
   if(entry.conflict&&!resolving)queueMicrotask(()=>{if(owned===entry&&entry.conflict)resolveConflict(entry,entry.conflict);});
   if(entry.sync.lastTime===null){
    const ids=linkedVariantIds(entry.sync.log);
    if(ids.length)fetchLastTime(ids,id).then(map=>{if(map&&owned===entry){entry.sync.setLastTime(map);if(view===mine)mine.setLastTime?.(map);}});
   }
  }
  const forMe=()=>owned?.sync?.log.id===id?owned:null,attachedSession=session;
  // The accepted finish, captured before it reaches the sync so an early acknowledgement is never missed.
  let finishing=null;
  const finishState=()=>{
   const {entry,record}=finishing,pending=!record;
   return {id,log:structuredClone(record?record.log:entry.sync?.log??finishing.log),status:pending?entry.status:'Saved',pending,record:record?structuredClone(record):null,blocked:pending&&(Boolean(entry.conflict)||entry.status==='Sign in to sync')};
  };
  const current=()=>view===mine&&session===attachedSession;
  const watch=(event,value)=>{if(!current())return;if(event==='released')finishing.record=structuredClone(value);mine.setFinishState?.(finishState());};
  return {
   onChange(log){const target=forMe();if(target&&log.status==='finished'&&!finishing){finishing={entry:target,log:structuredClone(log),record:null};target.watchers.add(watch);}target?.sync.change(log);},
   /** Legacy: flush, then History. With `stay`, report the accepted finish at once and keep syncing without navigating. */
   async onFinish({stay=false}={}){
    // An attachment left (route change or sign-out) while flushing no longer decides where the app goes.
    if(!stay){const target=forMe();await target?.sync.flush().catch(()=>{});if(current())await navigate('#/workouts');return {accepted:true};}
    if(!finishing||!current())return {accepted:false};
    if(owned===finishing.entry)void finishing.entry.sync.flush().catch(()=>{});
    return {accepted:true,state:finishState()};
   },
   async onDiscard(){if(forMe()&&await discard())await navigate('#/workouts');},
   /** Retry after a paused non-network failure (`Couldn’t save`). */
   onRetry(){return forMe()?.sync.resume().catch(()=>{});},
   onBestPerformanceNeeded:refreshBest,
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
   detach(){if(view===mine)view=null;finishing?.entry.watchers.delete(watch);}
  };
 }

 return {
  homeSnapshot,
  subscribe(listener){observers.add(listener);try{listener({reason:'ownership',snapshot:homeSnapshot()});}catch{}return ()=>observers.delete(listener);},
  suppressBar(){const token={};barSuppression.add(token);refreshBar({animate:false});return ()=>{if(barSuppression.delete(token))refreshBar({animate:false});};},
  boot,start,finish,discard,attach,refreshBar,
  get current(){return isActive()?{sync:owned.sync,log:owned.sync.log,lastTime:owned.sync.lastTime,bestPerformance:owned.sync.bestPerformance}:null;},
  /** Adopts an active server log (from another device) unless unsynced local changes are owned; true when this log is owned. */
  adopt(record){
   if(ownedId()===record.id)return true;
   if(!booted||record.log.status!=='active'||strayMirror())return false;
   if(owned){
    // The server holds one active log, so a clean owned log was finished or discarded elsewhere; local changes never are dropped.
    if(owned.conflict||owned.sync.isDirty()||owned.sync.revision===0)return false;
    release();clearMirror(storage);
   }
   own(record);return true;
  },
  owns:id=>ownedId()===id,
  snapshot(){return owned?.sync?{log:owned.sync.log,lastTime:owned.sync.lastTime,bestPerformance:owned.sync.bestPerformance}:null;},
  /** Best effort before Log out: saves pending workout edits while still signed in. */
  flush(){return owned?.sync?owned.sync.flush().catch(()=>{}):Promise.resolve();},
  /** After Log out: stop syncing and hide the bar. The mirror stays, so signing in again recovers the workout. */
  signOut(){session++;booted=false;booting=null;view=null;release();refreshBar({animate:false});notify('signout');},
  pendingSummary(){const log=owned?.sync?.log;return log&&log.status==='finished'&&owned.sync.isDirty()?workoutSummary(log):null;},
  resume(){return owned?.sync?.resume().catch(()=>{});}
 };
}
