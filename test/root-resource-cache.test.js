import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRootResourceCache} from '../src/root-resource-cache.js';
const deferred=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
test('deduplicates reads, caches empty data and isolates copies',async()=>{
 const cache=createRootResourceCache(),wait=deferred();let calls=0;
 const loader=()=>{calls++;return wait.promise;};
 const a=cache.load('programs',loader),b=cache.load('programs',loader);
 await Promise.resolve();assert.equal(calls,1);wait.resolve([]);
 assert.equal((await a).status,'accepted');await b;
 assert.deepEqual(cache.read('programs').value,[]);
 cache.read('programs').value.push('bad');assert.deepEqual(cache.read('programs').value,[]);
});
for(const operation of ['invalidate','replace','clear'])test(operation+' rejects old reads without overwriting newer data',async()=>{
 const cache=createRootResourceCache(),wait=deferred();const old=cache.load('programs',()=>wait.promise);
 if(operation==='replace')cache.replace('programs',['new']);else if(operation==='clear')cache.clear();else cache.invalidate(['programs']);
 wait.resolve(['old']);assert.equal((await old).status,'superseded');
 assert.deepEqual(cache.read('programs')?.value??null,operation==='replace'?['new']:null);
 assert.equal((await cache.load('programs',()=>['fresh'])).status,'accepted');
});
test('failures do not become successful empty snapshots and can retry',async()=>{
 const cache=createRootResourceCache();await assert.rejects(cache.load('catalog',()=>{throw Error('offline');}));
 assert.equal(cache.read('catalog'),null);await cache.load('catalog',()=>({entries:[]}));
 assert.deepEqual(cache.read('catalog').value,{entries:[]});
});
