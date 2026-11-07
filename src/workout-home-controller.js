import {activeProgram,upNextOccurrence} from './workout-up-next.js';
import {resolveProgram} from './program-links.js';

const message=error=>error?.message||"Couldn't load your next workout.";
const mergedHistory=(records,pending)=>[...new Map([...records,...(pending?[pending]:[])].map(record=>[record.id,record])).values()]
 .sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)||String(b.id).localeCompare(String(a.id)));

/** Home owns presentation state only; the workout controller remains the sole log writer. */
export function createWorkoutHomeController({api,workouts,launcher,onNavigate,onError=()=>{},onState=()=>{},now=()=>new Date(),events=globalThis,timers=globalThis}){
 let disposed=false,generation=0,rollover=null,releaseBar=null,unsubscribe=()=>{},initializing=true;
 let snapshot=workouts.homeSnapshot(),data={programs:null,templates:null,logs:[],activeProgramId:null};
 let state={kind:'loading',today:now(),activeLog:snapshot.activeLog,pending:snapshot.pending,program:null,recommendation:null,error:'',refreshing:true,starting:false,canStart:false,setupAction:null};
 function publish(patch={}){
  if(disposed)return;
  state={...state,...patch,today:now(),activeLog:snapshot.activeLog,pending:snapshot.pending};
  if(snapshot.activeLog)state={...state,kind:'resume',canStart:false,error:'',refreshing:false,setupAction:null};
  if(state.kind==='resume'){releaseBar??=workouts.suppressBar();}
  else if(releaseBar){releaseBar();releaseBar=null;}
  onState(state);
 }
 function armRollover(){
  if(rollover!==null)timers.clearTimeout(rollover);
  if(disposed)return;
  const current=now(),next=new Date(current.getFullYear(),current.getMonth(),current.getDate()+1);
  rollover=timers.setTimeout(()=>{rollover=null;if(globalThis.document?.visibilityState!=='hidden')refresh();else armRollover();},Math.max(1,next-current));
 }
 async function refresh(){
  if(disposed)return;
  const mine=++generation,valid=()=>!disposed&&mine===generation;
  publish({refreshing:true,canStart:false,error:'',...(!state.recommendation&&!snapshot.activeLog?{kind:'loading'}:{})});
  armRollover();
  // Templates are optional for the main cover and may settle after the recommendation.
  Promise.resolve().then(()=>api.list('template')).then(list=>{if(valid())data.templates=list;},error=>{if(valid()){data.templates=null;if(error?.status===401)onError(error);}});
  const results=await Promise.allSettled([api.getSettings(),api.list('program'),api.listWorkouts()]);
  if(!valid())return;
  try{
   if(results[0].status==='rejected')throw results[0].reason;
   if(results[1].status==='rejected')throw results[1].reason;
   const settings=results[0].value,programs=results[1].value;
   data={...data,programs,activeProgramId:settings.activeProgramId,logs:results[2].status==='fulfilled'?results[2].value.records:[]};
   const current=activeProgram(programs,settings.activeProgramId);
   if(!current){publish({kind:'empty',program:null,recommendation:null,refreshing:false,canStart:false,setupAction:programs.length?'set-active':'programs'});return;}
   if(results[2].status==='rejected')throw results[2].reason;
   const bundle=await api.programBundle(current.id);if(!valid())return;
   const program={...resolveProgram(bundle.record.document,bundle.templates),id:current.id};
   const logs=mergedHistory(data.logs,snapshot.pending),next=upNextOccurrence(program,logs,now());
   const workout=next&&program.workouts.find(w=>w.id===next.occurrenceId);
   if(!workout){publish({kind:'empty',program,recommendation:null,refreshing:false,canStart:false,setupAction:'open-program'});return;}
   const options={template:{id:workout.templateId,document:workout},program:{id:current.id,name:program.name},occurrenceId:workout.id};
   publish({kind:'recommendation',program,recommendation:{next,workout,options},error:'',refreshing:false,canStart:true,setupAction:null});
  }catch(error){
   if(!valid())return;
   publish({kind:state.recommendation?'recommendation':'error',error:message(error),refreshing:false,canStart:false});
   if(error?.status===401)onError(error);
  }
 }
 function choose({setup=false}={}){
  if(disposed||state.starting)return;
  return launcher.open({data:{...data,logs:mergedHistory(data.logs,snapshot.pending)},initialTab:setup?'program':undefined,
   onSettingsChanged:settings=>{if(!disposed){data.activeProgramId=settings.activeProgramId;generation++;publish({canStart:false,refreshing:true});}},
   onClosed:()=>{if(!disposed)refresh();}});
 }
 async function start(){
  if(disposed||!state.canStart||state.starting||snapshot.activeLog)return false;
  const options=state.recommendation.options;publish({starting:true,error:''});
  try{return await workouts.start(options);}
  catch(error){if(!disposed){publish({error:message(error)});if(error?.status===401)onError(error);}return false;}
  finally{if(!disposed)publish({starting:false});}
 }
 function resume(){if(!disposed&&snapshot.activeLog)return onNavigate('#/workouts/'+snapshot.activeLog.id);}
 function focus(){if(globalThis.document?.visibilityState!=='hidden')refresh();}
 function destroy(){
  if(disposed)return;disposed=true;generation++;unsubscribe();launcher.destroy();
  if(rollover!==null)timers.clearTimeout(rollover);
  events.removeEventListener?.('focus',focus);globalThis.document?.removeEventListener('visibilitychange',focus);
  releaseBar?.();releaseBar=null;
 }
 unsubscribe=workouts.subscribe(event=>{
  if(disposed)return;
  if(event.reason==='signout'){destroy();return;}
  const previous=snapshot;snapshot=event.snapshot;
  if(snapshot.activeLog)publish();
  else if(!initializing&&(previous.activeLog||JSON.stringify(previous.pending)!==JSON.stringify(snapshot.pending)))refresh();
 });
 initializing=false;
 events.addEventListener?.('focus',focus);globalThis.document?.addEventListener('visibilitychange',focus);
 publish();refresh();
 return {refresh,start,resume,choose,destroy};
}
