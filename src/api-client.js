export function createApiClient({fetch:request=globalThis.fetch,onMutation=()=>{}}={}) {
  async function call(path,method='GET',value) {
    const response=await request(`/api/${path}`,{method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});
    if(response.status===204){if(method!=='GET')notify();return;}
    let result;try {result=await response.json();}catch {throw Object.assign(Error('Server returned an invalid response.'),{status:response.status});}
    if(!response.ok)throw Object.assign(Error(result.error?.message||'Request failed.'),{status:response.status,code:result.error?.code,details:result.error?.details});
    if(method!=='GET')notify(result);
    return result;
    function notify(result){try{onMutation({path,method,value,result});}catch{/* A subscriber cannot undo a successful server write. */}}
  }
  return {
    programBundle:id=>call('documents/'+encodeURIComponent(id)+'/bundle'),
    templateUsage:async id=>(await call('documents/'+encodeURIComponent(id)+'/usage')).programs,
    createAndAttach:request=>call('document-commands/attach','POST',request),
    importDocument:request=>call('document-commands/import','POST',request),
    analysisCapability:()=>call('analysis'),
    getProfile:()=>call('profile'),
    getSettings:async()=>(await call('settings')).settings,
    setActiveProgram:async programId=>(await call('settings/active-program','PUT',{programId})).settings,
    updateProfile:({revision,profile})=>call('profile','PUT',{revision,profile}),
    listWorkouts:({before,beforeId}={})=>{
      const query=new URLSearchParams();if(before!==undefined)query.set('before',before);if(beforeId!==undefined)query.set('beforeId',beforeId);
      const text=query.toString();return call('workouts'+(text?'?'+text:''));
    },
    activeWorkout:async()=>(await call('workouts/active')).record,
    getWorkout:async id=>(await call('workouts/'+encodeURIComponent(id))).record,
    saveWorkout:async({id,revision,log})=>(await call('workouts/'+encodeURIComponent(id),'PUT',{revision,log})).record,
    deleteWorkout:({id,revision})=>call('workouts/'+encodeURIComponent(id)+'?revision='+encodeURIComponent(revision),'DELETE'),
    bestPerformance:async({variantIds,exclude})=>(await call('workouts/best?'+new URLSearchParams({variantIds:variantIds.join(','),...(exclude?{exclude}:{})}))).bestPerformance,
    lastTime:async({variantIds,exclude})=>(await call('workouts/last?'+new URLSearchParams({variantIds:variantIds.join(','),...(exclude?{exclude}:{})}))).lastTime,
    catalog:()=>call('catalog'),
    listTags:async()=>(await call('catalog/tags')).tags,
    createTag:async value=>(await call('catalog/tags','POST',value)).tag,
    updateTag:async({id,...value})=>(await call('catalog/tags/'+encodeURIComponent(id),'PUT',value)).tag,
    archiveTag:async({id,...value})=>(await call('catalog/tags/'+encodeURIComponent(id)+'/archive','PUT',value)).tag,
    referenceImpact:async id=>(await call('catalog/references/'+encodeURIComponent(id)+'/impact')).impact,
    createReference:async value=>(await call('catalog/references','POST',value)).reference,
    getReference:async id=>(await call('catalog/references/'+encodeURIComponent(id))).reference,
    updateReference:async({id,...value})=>(await call('catalog/references/'+encodeURIComponent(id),'PUT',value)).reference,
    archiveReference:async({id,...value})=>(await call('catalog/references/'+encodeURIComponent(id)+'/archive','PUT',value)).reference,
    moveCatalog:async({id,...value})=>(await call('catalog/'+encodeURIComponent(id)+'/reference','PUT',value)).entry,
    createCatalog:async value=>(await call('catalog','POST',value)).entry,
    catalogImpact:async id=>(await call('catalog/'+encodeURIComponent(id)+'/impact')).impact,
    updateCatalog:async({id,...value})=>(await call('catalog/'+encodeURIComponent(id),'PUT',value)).entry,
    archiveCatalog:async({id,...value})=>(await call('catalog/'+encodeURIComponent(id)+'/archive','PUT',value)).entry,
    renameFamily:async({id,...value})=>(await call('catalog/families/'+encodeURIComponent(id),'PUT',value)).family,
    login:password=>call('auth/login','POST',{password}),passwordSession:()=>call('auth/session'),logout:()=>call('auth/logout','POST',{}),
    list:async kind=>(await call(`documents?kind=${encodeURIComponent(kind)}`)).records,
    get:async id=>(await call(`documents/${encodeURIComponent(id)}`)).record,
    create:async value=>(await call('documents','POST',value)).record,
    update:async({id,...value})=>(await call(`documents/${encodeURIComponent(id)}`,'PUT',value)).record,
    remove:({id,revision})=>call(`documents/${encodeURIComponent(id)}`,'DELETE',{revision})
  };
}
