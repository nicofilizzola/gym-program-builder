export function createApiClient({fetch:request=globalThis.fetch}={}) {
  async function call(path,method='GET',value) {
    const response=await request(`/api/${path}`,{method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});
    if(response.status===204)return;
    let result;try {result=await response.json();}catch {throw Object.assign(Error('Server returned an invalid response.'),{status:response.status});}
    if(!response.ok)throw Object.assign(Error(result.error?.message||'Request failed.'),{status:response.status,code:result.error?.code});
    return result;
  }
  return {
    catalog:()=>call('catalog'),
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
