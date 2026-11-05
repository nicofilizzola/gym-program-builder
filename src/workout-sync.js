import {createAutosave} from './autosave.js';
import {upgradeLog} from './workout-log.js';

/** Local-first sync for the active workout: localStorage mirror + autosave with automatic retry. */
export const MIRROR_KEY='gpb.activeWorkout';
const OFFLINE='Offline · saved on this device',NO_MIRROR='Not saved on this device';
const BACKOFF=[2000,4000,8000,16000],BACKOFF_MAX=30000;

const isRevision=n=>Number.isInteger(n)&&n>=0;
export function readMirror(storage){
 try {
  const value=JSON.parse(storage.getItem(MIRROR_KEY));
  if(!value||typeof value!=='object'||!value.log||typeof value.log!=='object'||!isRevision(value.baseRevision)||typeof value.dirty!=='boolean')return null;
  return {log:value.log,baseRevision:value.baseRevision,dirty:value.dirty,lastTime:value.lastTime??null};
 }catch {return null;}
}
export function writeMirror(storage,mirror){
 try {storage.setItem(MIRROR_KEY,JSON.stringify(mirror));return true;}catch {return false;}
}
export function clearMirror(storage){try {storage.removeItem(MIRROR_KEY);}catch {/* storage unavailable */}}

export const backoffDelay=attempt=>BACKOFF[attempt]??BACKOFF_MAX;
export const isNetworkError=error=>typeof error?.status!=='number'||error.status>=500;
export function conflictReason(error){
 if(error?.status!==409)return null;
 return error.details?.reason==='active_exists'?'active_exists':'revision_conflict';
}

/** Boot decision for a mirror vs the server's copy of the same log. Never discards dirty local data. */
export function recoveryDecision({mirror,server,reachable}){
 const decide=action=>({action});
 if(!mirror)return decide(reachable&&server&&server.log?.status==='active'?'use-server':'none');
 if(!reachable)return decide('resume-local');
 if(!mirror.dirty){
  if(server)return decide(server.log?.status==='finished'?'clear-mirror':'use-server');
  return decide(mirror.baseRevision>0?'clear-mirror':'resume-local');
 }
 if(!server)return decide(mirror.baseRevision===0?'resume-local':'conflict');
 return decide(server.revision===mirror.baseRevision?'resume-local':'conflict');
}

export function createWorkoutSync({api,storage,record,lastTime=null,dirty=false,timers=globalThis,events=globalThis,onStatus=()=>{},onRecord=()=>{},onConflict=()=>{}}){
 const id=record.id;
 let log=upgradeLog(structuredClone(record.log)),revision=record.revision,last=lastTime;
 let lastError=null,reason=null,attempt=0,retryTimer=null,mirrorFailed=false,quiet=false,disposed=false;

 const mirror=isDirty=>{
  if(writeMirror(storage,{log,baseRevision:revision,dirty:isDirty,lastTime:last}))return true;
  // Never leave a copy older than memory behind: on reload it could pass for this device's version.
  clearMirror(storage);mirrorFailed=true;return false;
 };
 const cancelRetry=()=>{if(retryTimer!==null)timers.clearTimeout(retryTimer);retryTimer=null;};
 const retryNow=()=>{cancelRetry();if(!disposed)autosave.retry().catch(()=>{});};
 const scheduleRetry=()=>{
  if(retryTimer!==null||disposed)return;
  retryTimer=timers.setTimeout(()=>{retryTimer=null;retryNow();},backoffDelay(attempt++));
 };
 const status=value=>{
  if(quiet||disposed)return;
  if(value==='Saved'){onStatus(mirrorFailed?NO_MIRROR:value);return;}
  if(value==='Sign in to save'){onStatus('Sign in to sync');return;}
  if(value==='Conflict'){onStatus(value);return;}
  let shown=value;
  if(value==='Couldn’t save'&&isNetworkError(lastError)){shown=OFFLINE;scheduleRetry();}
  onStatus(mirrorFailed&&shown!=='Couldn’t save'?NO_MIRROR:shown);
 };
 const acknowledged=value=>{
  if(quiet)return;
  log=structuredClone(value.document);revision=value.revision;attempt=0;
  const pending=autosave.isDirty();
  // Each ack rewrites the mirror; the warning lasts until a write succeeds again.
  if(log.status==='finished'&&!pending){clearMirror(storage);mirrorFailed=false;}
  else mirrorFailed=!mirror(pending);
  if(!disposed)onRecord({id:value.id,revision:value.revision,log:structuredClone(value.document)});
 };
 const autosave=createAutosave({
  record:{id,revision,document:structuredClone(log)},delay:400,timers,
  save:({id:saveId,revision:saveRevision,document})=>api.saveWorkout({id:saveId,revision:saveRevision,log:document})
   .then(r=>{lastError=null;return {id:r.id,revision:r.revision,document:r.log};},error=>{lastError=error;throw error;}),
  onStatus:status,onRecord:acknowledged,
  onConflict:error=>{reason=conflictReason(error);cancelRetry();if(!disposed)onConflict(reason);}
 });
 const online=()=>{if(!disposed&&retryTimer!==null)retryNow();};
 const listening=typeof events?.addEventListener==='function';
 if(listening)events.addEventListener('online',online);

 function change(value){
  if(disposed)return;
  log=structuredClone(value);mirror(true);autosave.change(log);
 }
 /** Replace the autosave base without a server ack, keeping the mirror untouched. */
 function rebase(nextRevision,document){
  cancelRetry();quiet=true;
  try {autosave.reload({id,revision:nextRevision,document:structuredClone(document)});}finally {quiet=false;}
  revision=nextRevision;lastError=null;attempt=0;
 }
 function dispose(){disposed=true;cancelRetry();autosave.dispose();if(listening)events.removeEventListener('online',online);}
 const fetchServer=()=>api.getWorkout(id).catch(error=>{if(error?.status===404)return null;throw error;});
 const settle=async()=>{if(autosave.isSaving())await autosave.flush().catch(()=>{});};

 if(dirty)change(log);
 else if(log.status!=='finished')mirror(false);

 return {
  change,
  setLastTime(map){if(disposed)return;last=map;const pending=autosave.isDirty();if(pending||log.status!=='finished')mirror(pending);},
  flush:()=>autosave.flush(),
  /** The server's copy of this log (null when it is gone), after any in-flight save settles. */
  async savedVersion(){await settle();return fetchServer();},
  /**
   * Saves this device's log over the server's. `transform(log)` may change it first (Keep over a finished copy finishes it);
   * an active log never overwrites a finished server copy, and active_exists only discards `otherId` when given (null: none).
   * Those refusals throw (code finished_elsewhere / other_changed) and leave the local log and the conflict as they were.
   */
  async keepLocal({transform=value=>value,otherId}={}){
   await settle();
   let base,finishedElsewhere=false;
   if(reason==='active_exists'){
    const other=await api.activeWorkout();
    if(other&&other.id!==id){
     // otherId null means none was active when the user chose: a newer one is never discarded unseen.
     if(otherId!==undefined&&other.id!==otherId)throw Object.assign(Error('Another workout is now in progress on another device.'),{code:'other_changed'});
     await api.deleteWorkout({id:other.id,revision:other.revision});base=revision;
    }else base=other?other.revision:revision;
   }else{
    const server=await fetchServer();
    finishedElsewhere=server?.log.status==='finished';
    base=server?.revision??0;
   }
   if(disposed)return;
   await settle();
   if(disposed)return;
   const next=transform(structuredClone(log));
   // The server rejects reactivating a finished log, which would pause sync with no way forward.
   if(finishedElsewhere&&next.status!=='finished')throw Object.assign(Error('This workout was finished on another device.'),{code:'finished_elsewhere'});
   reason=null;rebase(base,next);change(next);
   await autosave.flush().catch(()=>{});
  },
  async useSaved(){
   await settle();
   const server=await fetchServer();
   if(disposed)return server;
   await settle();
   if(disposed)return server;
   reason=null;
   if(!server){clearMirror(storage);dispose();return null;}
   cancelRetry();lastError=null;attempt=0;
   autosave.reload({id:server.id,revision:server.revision,document:upgradeLog(structuredClone(server.log))});
   return server;
  },
  /** Replay after sign-in (401) or another paused non-conflict failure; no-op when not paused or in conflict. */
  resume(){
   if(disposed||!lastError||lastError.status===409)return Promise.resolve();
   cancelRetry();return autosave.retry();
  },
  dispose,
  isDirty:()=>autosave.isDirty(),
  get log(){return structuredClone(log);},
  get revision(){return revision;},
  get lastTime(){return last;}
 };
}
