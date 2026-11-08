import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRootResourceCache} from '../src/root-resource-cache.js';
import {createRootPageSession} from '../src/root-page-session.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('loaded data waits for visual settlement; held refresh never blocks settlement',async()=>{
 const states=[],cache=createRootResourceCache();let resolve;
 const session=createRootPageSession({key:'programs',cache,load:()=>new Promise(r=>resolve=r),onState:s=>states.push(s),isCurrent:()=>true});
 session.start();await tick();resolve(['p']);await tick();assert.equal(states.at(-1).phase,'loading');
 session.settled();assert.deepEqual(states.at(-1).data,['p']);session.destroy();
});
test('cached data survives refresh failure, successful empty replaces it',async()=>{
 const states=[],cache=createRootResourceCache();cache.replace('programs',['p']);let fail=true;
 const session=createRootPageSession({key:'programs',cache,load:()=>{if(fail)throw Error('offline');return [];},onState:s=>states.push(s),isCurrent:()=>true});
 session.start();session.settled();await tick();assert.deepEqual(states.at(-1).data,['p']);assert.ok(states.at(-1).error);
 fail=false;await session.refresh();assert.deepEqual(states.at(-1).data,[]);session.destroy();
});
test('auth errors bypass motion gate and destroyed sessions never publish',async()=>{
 let auth=0,published=0;const cache=createRootResourceCache();
 const session=createRootPageSession({key:'programs',cache,load:()=>{throw Object.assign(Error('sign in'),{status:401});},onAuthError:()=>auth++,onState:()=>published++,isCurrent:()=>true});
 session.start();await tick();assert.equal(auth,1);session.destroy();const count=published;session.settled();assert.equal(published,count);
});
