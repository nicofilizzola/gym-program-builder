import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as controllerModule from '../src/shared-session-controller.js';
const record={id:'t',kind:'template',revision:1,document:{name:'Push',exercises:[],goals:{}}};
test('one shared template queue retains dirty edits on remote refresh conflict',async()=>{
 let remote=structuredClone(record);const updates=[];
 const api={get:async()=>structuredClone(remote),update:async request=>{remote={...remote,revision:remote.revision+1,document:request.document};return remote;},create:async request=>({...record,id:request.id,document:request.document})};
 const c=controllerModule.createSharedSessionController({api,onTemplate:r=>updates.push(r),makeId:()=> 'copy'});
 const first=c.load(record);assert.equal(c.load(record),first);
 c.edit('t',{...record.document,name:'Local'});remote={...record,revision:2,document:{...record.document,name:'Remote'}};
 await c.refresh();assert.equal(first.isDirty(),true);await assert.rejects(c.flush(),{status:409});
 assert.equal(updates.at(-1)?.document.name==='Remote',false);
 const copy=await c.saveAsCopy('t');assert.equal(copy.document.name,'Local');assert.equal(copy.id,'copy');c.dispose();
});
test('late refresh after save acknowledgement cannot replace a newer template revision',async()=>{
 let release;const read=new Promise(resolve=>{release=resolve;});const updates=[];
 const c=controllerModule.createSharedSessionController({api:{get:()=>read,update:async request=>({...record,revision:2,document:request.document})},onTemplate:r=>updates.push(r)});
 c.load(record);const refreshing=c.refresh();c.edit('t',{...record.document,name:'Newest'});await c.flush();release(record);await refreshing;
 assert.equal(updates.at(-1).document.name,'Newest');assert.equal(updates.at(-1).revision,2);c.dispose();
});
