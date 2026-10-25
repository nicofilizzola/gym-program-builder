// In-memory only. An invalidation during a pending read forces a fresh read after it settles.
const stores=new WeakMap();
export function getCatalogStore(api){
 if(!stores.has(api)){
  let data=null,pending=null,epoch=0,loaded=-1;
  const store={
   get value(){return data;},
   invalidate(){epoch++;},
   async load(force=false){
    if(force)epoch++;
    if(pending){await pending;return loaded===epoch?data:store.load();}
    if(data&&loaded===epoch)return data;
    const reading=epoch;
    pending=api.catalog().then(value=>{data=value;loaded=reading;return value;}).finally(()=>{pending=null;});
    await pending;return loaded===epoch?data:store.load();
   }
  };
  stores.set(api,store);
 }
 return stores.get(api);
}
export const invalidateCatalog=api=>getCatalogStore(api).invalidate();
