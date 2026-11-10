/** History's first-page scheduling input and bounded visible extent have separate ownership. */
export function createHistoryPageData({api,cache,pendingSummary=()=>null,isCurrent=()=>true,onState,onAuthError=()=>{}}){
 let destroyed=false,settled=false,generation=0,revision=0,wanted=0,loadingMore=false,timer=null;
 let data=cache.read('history:visible')?.value,error=null,refreshing=false,pageCount=Math.max(1,data?.pageCount||1);
 const valid=()=>!destroyed&&isCurrent(),dedupe=records=>[...new Map(records.map(row=>[row.id,row])).values()];
 function publish(){if(!valid()||!settled)return;const pending=pendingSummary();onState({phase:data?'ready':error?'error':'loading',data,error,refreshing,pending:pending&&!data?.records.some(row=>row.id===pending.id)?pending:null});}
 async function refresh(){
  if(!valid())return;const mine=++generation;error=null;clearTimeout(timer);
  timer=setTimeout(()=>{if(valid()&&mine===generation){refreshing=true;publish();}},250);
  try{
   const first=await cache.load('history:first',()=>api.listWorkouts());if(!valid()||mine!==generation||first.status!=='accepted')return;
   let page=first.snapshot.value,pages=1;
   while(page.hasMore&&(pages<pageCount||page.records.length<Math.max(wanted,data?.records.length||0))){
    const last=page.records.at(-1);if(!last)break;
    const more=await api.listWorkouts({before:last.startedAt,beforeId:last.id});if(!valid()||mine!==generation)return;
    const records=dedupe([...page.records,...more.records]);if(records.length===page.records.length)break;
    page={records,hasMore:more.hasMore};pages++;
   }
   pageCount=pages;revision++;data={...page,visibleCount:page.records.length,pageCount};error=null;cache.replace('history:visible',data);
  }catch(failure){if(!valid()||mine!==generation)return;if(failure.status===401){onAuthError(failure);return;}error=failure;}
  finally{if(mine===generation){clearTimeout(timer);refreshing=false;publish();}}
 }
 async function loadMore(){
  if(!valid()||loadingMore||!data?.hasMore)return;loadingMore=true;const mine=generation,ownedRevision=revision;pageCount++;
  const last=data.records.at(-1);
  try{const more=await api.listWorkouts({before:last?.startedAt,beforeId:last?.id});if(!valid()||mine!==generation||ownedRevision!==revision)return;
   data={records:dedupe([...data.records,...more.records]),hasMore:more.hasMore,pageCount};data.visibleCount=data.records.length;wanted=data.visibleCount;error=null;cache.replace('history:visible',data);publish();
  }catch(failure){if(valid()&&mine===generation){if(failure.status===401)onAuthError(failure);else{error=failure;publish();}}}
  finally{loadingMore=false;}
 }
 const unsubscribe=cache.subscribe(event=>{if(event.type==='clear')destroy();else if(event.keys.some(key=>key.startsWith('history:')))void refresh();});
 function destroy(){destroyed=true;generation++;clearTimeout(timer);unsubscribe();}
 return {start({visibleCount=0}={}){wanted=visibleCount;void refresh();},suspend(){settled=false;},settled(){settled=true;publish();},refresh,loadMore,destroy};
}
