import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affectedRootResources,bindRootCacheInvalidation} from '../src/root-cache-invalidation.js';
import {createRootResourceCache} from '../src/root-resource-cache.js';
import {createApiClient} from '../src/api-client.js';
test('mutation paths invalidate their affected resources, never reads or profile/auth writes',()=>{
 for(const [path,method,want] of [
  ['documents','POST',['programs','templates','settings']],['documents/p?revision=2','DELETE',['programs','templates','settings']],
  ['document-commands/import','POST',['programs','templates','settings']],['document-commands/attach','POST',['programs','templates','settings']],
  ['catalog','POST',['catalog','programs','templates']],['catalog/tags/x/archive','PUT',['catalog','programs','templates']],
  ['settings/active-program','PUT',['settings']],['workouts/x?revision=1','DELETE',['history:first','history:visible']],
  ['profile','PUT',[]],['auth/logout','POST',[]],['documents','GET',[]]
 ])assert.deepEqual(affectedRootResources({path,method}),want,path);
});
test('an old auth lifetime mutation acknowledgement cannot refill or overwrite the new cache',async()=>{
 const cache=createRootResourceCache(),binding=bindRootCacheInvalidation({cache,workouts:{subscribe(){return ()=>{};}}});let release;
 const api=createApiClient({mutationScope:()=>cache.scope(),onMutation:binding.onMutation,fetch:()=>new Promise(r=>release=r)});
 const old=api.setActiveProgram('old');cache.clear();cache.replace('settings',{activeProgramId:'new'});
 release(Response.json({settings:{activeProgramId:'old'}}));await old;
 assert.deepEqual(cache.read('settings').value,{activeProgramId:'new'});binding.destroy();
});
test('confirmed active setting defeats old reads; local finish and signout clear the right data',async()=>{
 const cache=createRootResourceCache();let listener,resolve;const binding=bindRootCacheInvalidation({cache,workouts:{subscribe(fn){listener=fn;return ()=>listener=null;}}});
 const old=cache.load('settings',()=>new Promise(r=>resolve=r));await Promise.resolve();
 binding.onMutation({path:'settings/active-program',method:'PUT',result:{settings:{activeProgramId:'new'}}});resolve({activeProgramId:'old'});await old;assert.equal(cache.read('settings').value.activeProgramId,'new');
 cache.replace('history:first',{records:['x']});listener({reason:'finish'});assert.equal(cache.read('history:first'),null);
 listener({reason:'signout'});assert.equal(cache.read('settings'),null);binding.destroy();assert.equal(listener,null);
});
