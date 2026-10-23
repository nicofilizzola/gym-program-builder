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
