import {openWorkoutStartSheet} from './workout-start-sheet.js';
import {resolveProgram} from './program-links.js';

/** Shared wiring; the sheet still owns its own tab state and per-open cache. */
export function createWorkoutStartLauncher({api,onStart,onNavigate,onError=()=>{},openSheet=openWorkoutStartSheet,focusFallback=()=>null}){
 let disposed=false,opened=null,generation=0;
 return {
  open({data,loadLists=null,initialTab,onSettingsChanged=()=>{},onClosed=()=>{}}){
   if(disposed)return null;
   opened?.close();const mine=++generation,valid=()=>!disposed&&mine===generation;
   opened=openSheet({...data,initialTab,focusFallback,
    loadProgram:async id=>{const bundle=await api.programBundle(id);return resolveProgram(bundle.record.document,bundle.templates);},
    loadTemplate:id=>api.get(id),
    onRetryList:async kind=>{const list=await api.list(kind);if(valid())data[kind==='program'?'programs':'templates']=list;return list;},
    onRetryResources:()=>refreshLists(),
    onActivate:async id=>{const saved=await api.setActiveProgram(id);if(valid()){data.activeProgramId=saved.activeProgramId;onSettingsChanged(saved);}return saved;},
    onStart:options=>{if(valid())return Promise.resolve().then(()=>onStart(options)).catch(error=>{if(valid())onError(error);});},
    onNavigate:hash=>{if(valid())return onNavigate(hash);}
   });
   const sheet=opened;sheet.closed.then(()=>{if(valid()){opened=null;onClosed();}});
   function refreshLists(){if(!loadLists||!valid())return;return Promise.resolve(loadLists({onUpdate:event=>{
    if(!valid()||opened!==sheet)return;
    if(event.error?.status===401){onError(event.error);return;}
    data.listStatus={...data.listStatus,[event.resource]:event.status};
    if(event.status==='ready'){
     if(event.resource==='settings')data.activeProgramId=event.value.activeProgramId;
     else if(event.resource==='firstPage')data.logs=event.value.records;
     else data[event.resource]=event.value;
    }else if(event.status==='error'&&['programs','templates'].includes(event.resource))data[event.resource]=null;
    sheet.updateLists?.(data);
   }})).catch(error=>{if(valid())onError(error);});}
   if(loadLists)void refreshLists();
   return sheet;
  },
  destroy(){disposed=true;generation++;opened?.close();opened=null;}
 };
}
