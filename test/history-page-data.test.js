import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRootResourceCache} from '../src/root-resource-cache.js';
import {createHistoryPageData} from '../src/history-page-data.js';
const tick=()=>new Promise(r=>setImmediate(r));
const row=id=>({id,startedAt:id});
test('cached extent is published before refresh and first page remains distinct',async()=>{
 const cache=createRootResourceCache(),states=[];cache.replace('history:visible',{records:[row('a'),row('b')],hasMore:false,visibleCount:2});
 let release;const adapter=createHistoryPageData({cache,api:{listWorkouts:()=>new Promise(r=>release=r)},pendingSummary:()=>null,onState:s=>states.push(s)});
 adapter.start({visibleCount:2});adapter.settled();assert.equal(states.at(-1).data.records.length,2);
 await tick();release({records:[],hasMore:false});await tick();assert.deepEqual(states.at(-1).data.records,[]);assert.deepEqual(cache.read('history:first').value.records,[]);adapter.destroy();
});
test('pending finish is merged once and failed history remains unknown',async()=>{
 const states=[],cache=createRootResourceCache();const adapter=createHistoryPageData({cache,api:{listWorkouts:()=>{throw Error('offline');}},pendingSummary:()=>row('local'),onState:s=>states.push(s)});
 adapter.start({visibleCount:0});adapter.settled();await tick();assert.equal(states.at(-1).phase,'error');assert.equal(states.at(-1).pending.id,'local');assert.equal(cache.read('history:first'),null);adapter.destroy();
});
test('load more racing refresh cannot shrink or duplicate the visible extent',async()=>{
 const cache=createRootResourceCache(),states=[];cache.replace('history:visible',{records:[row('a')],hasMore:true,visibleCount:1});
 let release;const api={listWorkouts:args=>args?Promise.resolve({records:[row('a'),row('b')],hasMore:false}):new Promise(r=>release=r)};
 const adapter=createHistoryPageData({cache,api,pendingSummary:()=>null,onState:s=>states.push(s)});adapter.start({visibleCount:1});adapter.settled();await tick();await adapter.loadMore();release({records:[row('a')],hasMore:true});await tick();assert.deepEqual(states.at(-1).data.records.map(r=>r.id),['a','b']);adapter.destroy();
});
test('a fresh head racing pagination reconciles new records without losing the appended tail',async()=>{
 const cache=createRootResourceCache(),states=[];cache.replace('history:visible',{records:[row('old')],hasMore:true,visibleCount:1});
 let release;const api={listWorkouts:args=>args?Promise.resolve({records:[row('older')],hasMore:false}):new Promise(r=>release=r)};
 const adapter=createHistoryPageData({cache,api,onState:s=>states.push(s)});adapter.start();adapter.settled();await tick();await adapter.loadMore();
 release({records:[row('new'),row('old')],hasMore:true});await tick();await tick();
 assert.deepEqual(states.at(-1).data.records.map(r=>r.id),['new','old','older']);adapter.destroy();
});
test('an old pagination response cannot resurrect rows after fresh reconciliation',async()=>{
 const cache=createRootResourceCache(),states=[];cache.replace('history:visible',{records:[row('old')],hasMore:true,visibleCount:1});
 let head,tail;const api={listWorkouts:args=>new Promise(r=>{if(args)tail=r;else head=r;})};
 const adapter=createHistoryPageData({cache,api,onState:s=>states.push(s)});adapter.start();adapter.settled();await tick();const more=adapter.loadMore();
 head({records:[row('new')],hasMore:false});await tick();tail({records:[row('deleted')],hasMore:false});await more;
 assert.deepEqual(states.at(-1).data.records.map(r=>r.id),['new']);adapter.destroy();
});
