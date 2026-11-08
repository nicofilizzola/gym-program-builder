/** Auth-lifetime data only. Obsolete reads may finish, but never refill invalidated data. */
export function createRootResourceCache({now=Date.now}={}){
 const values=new Map(),epochs=new Map(),pending=new Map(),listeners=new Set();let auth=0;
 const epoch=key=>epochs.get(key)||0,copy=value=>structuredClone(value);
 const read=key=>values.has(key)?copy(values.get(key)):null;
 function invalidate(keys){
  for(const key of keys){epochs.set(key,epoch(key)+1);values.delete(key);pending.delete(key);}
  for(const listener of listeners)listener({type:'invalidate',keys});
 }
 function replace(key,value){epochs.set(key,epoch(key)+1);pending.delete(key);values.set(key,{value:copy(value),updatedAt:now(),epoch:epoch(key)});return read(key);}
 function load(key,loader){
  if(pending.has(key))return pending.get(key);
  const ownedAuth=auth,ownedEpoch=epoch(key);
  const promise=Promise.resolve().then(loader).then(value=>{
   if(auth!==ownedAuth||epoch(key)!==ownedEpoch)return {status:'superseded'};
   values.set(key,{value:copy(value),updatedAt:now(),epoch:ownedEpoch});return {status:'accepted',snapshot:read(key)};
  }).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});
  pending.set(key,promise);return promise;
 }
 return {read,load,replace,invalidate,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},clear(){auth++;values.clear();pending.clear();epochs.clear();for(const listener of listeners)listener({type:'clear',keys:[]});}};
}
