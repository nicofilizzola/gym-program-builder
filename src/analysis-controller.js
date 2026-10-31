import {prepareAnalysisSnapshot,analysisFingerprint} from './analysis-input.js';
import {streamAnalysis} from './analysis-client.js';
export function createAnalysisController({getWorkout,getSnapshot=()=>prepareAnalysisSnapshot(getWorkout()),request=streamAnalysis,onState=()=>{}}){
 let state={phase:'idle',text:'',snapshotName:'',stale:false,error:null},fingerprint=null,abort=null,generation=0,destroyed=false;
 const notify=()=>{if(!destroyed)onState({...state});};
 const refresh=()=>{if(!fingerprint||destroyed)return;let next;try{next=analysisFingerprint(getSnapshot());}catch{}const stale=next!==fingerprint;if(stale!==state.stale){state={...state,stale};notify();}};
 return {
  getState:()=>({...state}),refresh,
  async start(){
   if(destroyed)return;generation++;abort?.abort();abort=new AbortController();const id=generation,requestAbort=abort;
   let snapshot;try{snapshot=getSnapshot();}catch(error){state={...state,phase:'error',error};notify();return;}
   fingerprint=analysisFingerprint(snapshot);state={phase:'connecting',text:'',snapshotName:snapshot.name,stale:false,error:null};notify();
   const current=()=>!destroyed&&id===generation&&!requestAbort.signal.aborted;
   try{await request(snapshot,{signal:requestAbort.signal,onEvent:event=>{
    if(!current())return;
    if(event.type==='delta')state={...state,phase:'streaming',text:state.text+event.text};
    if(event.type==='complete')state={...state,phase:'complete'};
    notify();
   }});}catch(error){if(current()){state={...state,phase:'error',error};notify();}}
  },
  stop(){if(!['connecting','streaming'].includes(state.phase)||destroyed)return;generation++;abort?.abort();state={...state,phase:'stopped',error:null};notify();},
  destroy(){destroyed=true;generation++;abort?.abort();}
 };
}
