import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutStartLauncher} from '../src/workout-start-launcher.js';
test('launcher resolves bundles and forwards activation, retries and close once',async()=>{
 let sheet,close,closed=0;const changes=[],errors=[];
 const launcher=createWorkoutStartLauncher({api:{
  programBundle:async()=>({record:{document:{name:'P',workouts:[{id:'o',templateId:'t',day:0}]}},templates:[{id:'t',kind:'template',document:{name:'T',coverId:'barbell'}}]}),
  get:async id=>({id}),list:async()=>[{id:'new'}],setActiveProgram:async id=>({activeProgramId:id})
 },onStart:async()=>{throw Error('cannot start');},onNavigate:()=>{},onError:e=>errors.push(e.message),
 openSheet:options=>{sheet=options;return {close:()=>close(),closed:new Promise(r=>{close=r;})};}});
 const opened=launcher.open({data:{programs:[],templates:null,logs:[],activeProgramId:null},initialTab:'program',onSettingsChanged:s=>changes.push(s),onClosed:()=>closed++});
 assert.equal(sheet.initialTab,'program');
 assert.equal((await sheet.loadProgram('p')).workouts[0].coverId,'barbell');
 assert.deepEqual(await sheet.loadTemplate('t'),{id:'t'});
 assert.deepEqual(await sheet.onRetryList('program'),[{id:'new'}]);
 await sheet.onActivate('p');assert.deepEqual(changes,[{activeProgramId:'p'}]);
 await sheet.onStart({});assert.deepEqual(errors,['cannot start']);
 opened.close();await opened.closed;await Promise.resolve();assert.equal(closed,1);
 launcher.destroy();
});
test('destroyed launcher ignores late setting updates',async()=>{
 let resolve,sheet,changed=0;
 const launcher=createWorkoutStartLauncher({api:{setActiveProgram:()=>new Promise(r=>resolve=r)},onError:()=>{},onStart:()=>{},onNavigate:()=>{},
 openSheet:options=>{sheet=options;return {close(){},closed:new Promise(()=>{})};}});
 launcher.open({data:{},onSettingsChanged:()=>changed++});const pending=sheet.onActivate('p');launcher.destroy();resolve({activeProgramId:'p'});await pending;
 assert.equal(changed,0);
});
