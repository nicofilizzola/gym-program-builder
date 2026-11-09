export function affectedRootResources({path,method}){
 if(method==='GET'||method==='HEAD')return [];
 const root=path.split('?')[0].split('/')[0];
 if(root==='documents'||root==='document-commands')return ['programs','templates','settings'];
 if(root==='catalog')return ['catalog','programs','templates'];
 if(path.split('?')[0]==='settings/active-program')return ['settings'];
 if(root==='workouts')return ['history:first','history:visible'];
 return [];
}
export function bindRootCacheInvalidation({cache,workouts}){
 const unsubscribe=workouts.subscribe(({reason})=>{if(reason==='signout')cache.clear();else if(reason==='finish'||reason==='discard')cache.invalidate(['history:first','history:visible']);});
 return {onMutation(event){if(event.scope!==undefined&&event.scope!==cache.scope())return;const keys=affectedRootResources(event);if(keys.length)cache.invalidate(keys);if(event.path==='settings/active-program'&&event.result?.settings)cache.replace('settings',event.result.settings);},destroy:unsubscribe};
}
