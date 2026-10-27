import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,serializeDocument,documentFileName} from '../src/document-file.js';

test('portable timing survives round trip and malformed later exercises reject whole files',()=>{
 const ex={name:'Curl',sets:3,repRange:{min:8,max:12},primaryMuscles:['Biceps'],secondaryMuscles:[],restSeconds:45,catalogId:'untrusted',catalogRevision:1,familyId:'curl',equipment:'Machine'};
 const t={name:'Upper',exercises:[ex],goals:{},extraMinutes:12,bufferPercent:25};
 const text=serializeDocument('template',t),result=parseDocument(text);
 assert.equal(result.document.extraMinutes,12);assert.equal(result.document.bufferPercent,25);
 assert.equal(result.document.exercises[0].restSeconds,45);assert.equal('catalogId' in result.document.exercises[0],false);
 const bad={...t,exercises:[ex,{...ex,restSeconds:14}]};
 assert.match(parseDocument(JSON.stringify({version:2,kind:'template',template:bad})).error,/Exercise 2:/);
 const legacy=parseDocument(JSON.stringify({version:1,exercises:[{...ex,restSeconds:90}],goals:{}}));
 assert.equal(legacy.document.exercises[0].restSeconds,90);
 assert.equal(legacy.document.extraMinutes,5);assert.equal(legacy.document.bufferPercent,10);
 assert.ok(parseDocument(JSON.stringify({version:1,exercises:[{...ex,restSeconds:null}],goals:{}})).error);
});
test('portable program retains hidden schedule and replaces identities',()=>{
 const p={name:'Week',mode:'simple',goals:{Chest:30},workouts:[{id:'old',name:'Upper',day:6,exercises:[],goals:{Chest:12}}]};
 const text=serializeDocument('program',p);
 assert.equal(text.includes('old'),false);
 assert.deepEqual(parseDocument(text,{makeId:()=>'new'}),{kind:'program',document:{...p,workouts:[{...p.workouts[0],id:'new',extraMinutes:5,bufferPercent:10}]}});
 assert.equal(documentFileName('program',new Date(2026,9,23)),'gym-program-2026-10-23.json');
 assert.equal(documentFileName('template',new Date(2026,9,23)),'gym-session-template-2026-10-23.json');
});
test('legacy templates import and invalid whole files reject',()=>{
 assert.deepEqual(parseDocument('{"version":1,"exercises":[],"goals":{}}'),{kind:'template',document:{name:'Imported session template',exercises:[],goals:{},extraMinutes:5,bufferPercent:10}});
 for(const text of ['{','{"version":3}','{"version":2,"kind":"other"}',JSON.stringify({version:2,kind:'template',template:{name:'',exercises:[],goals:{}}}),JSON.stringify({version:2,kind:'template',template:{name:'X',exercises:[],goals:{Chest:12.5}}}),' '.repeat(1048577)]) assert.ok(parseDocument(text).error);
 const t={name:'Template',exercises:[],goals:{Calves:0.5}};
 assert.deepEqual(parseDocument(serializeDocument('template',t)),{kind:'template',document:{...t,extraMinutes:5,bufferPercent:10}});
 assert.throws(()=>serializeDocument('template',{...t,name:''}));
});

test('mixed sequence files resolve fresh IDs and reject invalid indices',()=>{
 const p={name:'Cycle',mode:'simple',goals:{},workouts:[{id:'a',name:'Upper',day:2,exercises:[],goals:{}}],
  sequence:[{type:'rest',id:'r1'},{type:'workout',workoutId:'a'},{type:'rest',id:'r2'}]};
 const text=serializeDocument('program',p),portable=JSON.parse(text);
 assert.deepEqual(portable.program.sequence,[{type:'rest'},{type:'workout',workoutIndex:0},{type:'rest'}]);
 let i=0;const first=parseDocument(text,{makeId:()=> 'n'+ ++i}).document;
 assert.deepEqual(first.sequence,[{type:'rest',id:'n2'},{type:'workout',workoutId:'n1'},{type:'rest',id:'n3'}]);
 assert.notDeepEqual(parseDocument(text).document.sequence,parseDocument(text).document.sequence);
 for(const sequence of [null,[],[{type:'workout',workoutIndex:-1}],[{type:'workout',workoutIndex:0.5}],
  [{type:'workout',workoutIndex:1}],[{type:'workout',workoutIndex:0},{type:'workout',workoutIndex:0}],
  [{type:'workout',workoutId:'a'}],[{type:'banana'}]])
  assert.ok(parseDocument(JSON.stringify({...portable,program:{...portable.program,sequence}})).error);
 const restOnly={...p,workouts:[],sequence:[{type:'rest',id:'r'}]};
 assert.equal(parseDocument(serializeDocument('program',restOnly)).document.sequence[0].type,'rest');
});
