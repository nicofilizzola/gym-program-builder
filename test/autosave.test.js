import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutosave} from '../src/autosave.js';
const base=()=>({id:'a',revision:1,kind:'template',document:{name:'Original',exercises:[],goals:{}}});
test('autosave coalesces edits, serializes in-flight generations and only acknowledges newest',async()=>{
 let tick;const timers={setTimeout:fn=>{tick=fn;return 1;},clearTimeout:()=>{tick=null;}};
 const writes=[],resolvers=[],statuses=[];const q=createAutosave({record:base(),timers,onStatus:s=>statuses.push(s),save:args=>new Promise(resolve=>{writes.push(args);resolvers.push(resolve);})});
 for(let i=0;i<20;i++)q.change({...base().document,name:String(i)});
 assert.equal(writes.length,0);tick();await Promise.resolve();assert.equal(writes.length,1);assert.equal(writes[0].document.name,'19');
 q.change({...base().document,name:'newest'});resolvers.shift()({...base(),revision:2,document:writes[0].document});
 await new Promise(r=>setTimeout(r,0));assert.equal(writes.length,2);assert.equal(writes[1].revision,2);assert.equal(q.isDirty(),true);
 resolvers.shift()({...base(),revision:3,document:writes[1].document});await q.flush();assert.equal(q.isDirty(),false);assert.equal(statuses.at(-1),'Saved');
});
test('conflicts pause without discarding edits and save-as-copy preserves them',async()=>{
 let captured;const q=createAutosave({record:base(),delay:99999,save:async()=>{throw Object.assign(Error('newer'),{status:409});},createCopy:async doc=>{captured=doc;return {...base(),id:'copy',document:doc};}});
 q.change({...base().document,name:'Local'});await assert.rejects(q.flush());assert.equal(q.isDirty(),true);
 const copy=await q.saveAsCopy();assert.equal(copy.id,'copy');assert.equal(captured.name,'Local');q.dispose();
});
test('network failure retries same revision and disposal ignores late responses',async()=>{
 let attempts=0,resolve;const q=createAutosave({record:base(),delay:99999,save:async args=>{attempts++;assert.equal(args.revision,1);if(attempts===1)throw Error('offline');return new Promise(r=>{resolve=r;});}});
 q.change({...base().document,name:'Local'});await assert.rejects(q.flush());const retry=q.retry();await Promise.resolve();q.dispose();resolve({...base(),revision:2});await retry;assert.equal(attempts,2);
});

test('retry replays a committed snapshot before saving edits made after a lost acknowledgement',async()=>{
 let stored=base(),lost=true;const writes=[];
 const q=createAutosave({record:base(),delay:99999,save:async args=>{
  writes.push(structuredClone(args));
  if(args.revision!==stored.revision){if(args.revision===stored.revision-1&&args.document.name===stored.document.name)return stored;throw Object.assign(Error('conflict'),{status:409});}
  stored={...stored,revision:stored.revision+1,document:args.document};if(lost){lost=false;throw Error('lost acknowledgement');}return stored;
 }});
 q.change({...base().document,name:'First'});await assert.rejects(q.flush());q.change({...base().document,name:'Latest'});await q.retry();
 assert.deepEqual(writes.map(w=>[w.revision,w.document.name]),[[1,'First'],[1,'First'],[2,'Latest']]);assert.equal(stored.document.name,'Latest');assert.equal(q.isDirty(),false);q.dispose();
});
test('conflict remains recoverable while local edits continue',async()=>{
 const statuses=[];const q=createAutosave({record:base(),delay:99999,onStatus:s=>statuses.push(s),save:async()=>{throw Object.assign(Error('conflict'),{status:409});}});
 q.change({...base().document,name:'First'});await assert.rejects(q.flush());q.change({...base().document,name:'Later'});assert.equal(statuses.at(-1),'Conflict');q.dispose();
});
test('save as copy persists edits made while creation is in flight',async()=>{
 let release,copy;const q=createAutosave({record:base(),delay:99999,save:async args=>{assert.equal(args.id,'copy');copy={...base(),id:'copy',revision:args.revision+1,document:args.document};return copy;},createCopy:doc=>new Promise(resolve=>{release=()=>resolve({...base(),id:'copy',document:doc});})});
 q.change({...base().document,name:'First'});const saving=q.saveAsCopy();q.change({...base().document,name:'Latest'});release();const result=await saving;assert.equal(result.document.name,'Latest');q.dispose();
});
