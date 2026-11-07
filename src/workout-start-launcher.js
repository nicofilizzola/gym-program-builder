import {openWorkoutStartSheet} from './workout-start-sheet.js';
import {resolveProgram} from './program-links.js';

/** Shared wiring; the sheet still owns its own tab state and per-open cache. */
export function createWorkoutStartLauncher({api,onStart,onNavigate,onError=()=>{},openSheet=openWorkoutStartSheet}){
 let disposed=false,opened=null,generation=0;
 return {
  open({data,initialTab,onSettingsChanged=()=>{},onClosed=()=>{}}){
   if(disposed)return null;
   opened?.close();const mine=++generation,valid=()=>!disposed&&mine===generation;
   opened=openSheet({...data,initialTab,
    loadProgram:async id=>{const bundle=await api.programBundle(id);return resolveProgram(bundle.record.document,bundle.templates);},
    loadTemplate:id=>api.get(id),
    onRetryList:async kind=>{const list=await api.list(kind);if(valid())data[kind==='program'?'programs':'templates']=list;return list;},
    onActivate:async id=>{const saved=await api.setActiveProgram(id);if(valid()){data.activeProgramId=saved.activeProgramId;onSettingsChanged(saved);}return saved;},
    onStart:options=>{if(valid())return Promise.resolve().then(()=>onStart(options)).catch(error=>{if(valid())onError(error);});},
    onNavigate:hash=>{if(valid())return onNavigate(hash);}
   });
   const sheet=opened;sheet.closed.then(()=>{if(valid()){opened=null;onClosed();}});
   return sheet;
  },
  destroy(){disposed=true;generation++;opened?.close();opened=null;}
 };
}
