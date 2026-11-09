/** A single root view's data lifetime, independent of visual settlement. */
export function createRootPageSession({key,cache,load,onState,onAuthError=()=>{},isCurrent=()=>true}){
 let destroyed=false,ready=false,request=0,timer=null;
 let state={phase:'loading',data:undefined,refreshing:false,error:null,fromCache:false};
 const valid=()=>!destroyed&&isCurrent();
 const publish=()=>{if(valid()&&ready)onState({...state});};
 async function refresh(){
  if(!valid())return;const mine=++request;clearTimeout(timer);
  state={...state,refreshing:false,error:null};
  timer=setTimeout(()=>{if(valid()&&mine===request){state={...state,refreshing:true};publish();}},250);
  try{
   const result=await cache.load(key,load);if(!valid()||mine!==request||result.status!=='accepted')return;
   state={phase:'ready',data:result.snapshot.value,refreshing:false,error:null,fromCache:false};
  }catch(error){
   if(!valid()||mine!==request)return;
   if(error.status===401){onAuthError(error);return;}
   state={...state,phase:state.data===undefined?'error':'ready',refreshing:false,error};
  }finally{if(mine===request){clearTimeout(timer);timer=null;publish();}}
 }
 const unsubscribe=cache.subscribe(event=>{if(event.type==='clear'){destroy();return;}if(event.keys.includes(key))void refresh();});
 function destroy(){destroyed=true;request++;clearTimeout(timer);unsubscribe();}
 return {start(){const saved=cache.read(key);if(saved)state={phase:'ready',data:saved.value,refreshing:false,error:null,fromCache:true};if(valid())onState({phase:'loading',data:undefined,refreshing:false,error:null,fromCache:false});void refresh();},suspend(){ready=false;},settled(){ready=true;publish();},refresh,destroy};
}
