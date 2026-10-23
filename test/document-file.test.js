import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,serializeDocument,documentFileName} from '../src/document-file.js';
test('portable program retains hidden schedule and replaces identities',()=>{
 const p={name:'Week',mode:'simple',goals:{Chest:30},workouts:[{id:'old',name:'Upper',day:6,exercises:[],goals:{Chest:12}}]};
 const text=serializeDocument('program',p);
 assert.equal(text.includes('old'),false);
 assert.deepEqual(parseDocument(text,{makeId:()=>'new'}),{kind:'program',document:{...p,workouts:[{...p.workouts[0],id:'new'}]}});
 assert.equal(documentFileName('program',new Date(2026,9,23)),'gym-program-2026-10-23.json');
 assert.equal(documentFileName('template',new Date(2026,9,23)),'gym-session-template-2026-10-23.json');
});
test('legacy templates import and invalid whole files reject',()=>{
 assert.deepEqual(parseDocument('{"version":1,"exercises":[],"goals":{}}'),{kind:'template',document:{name:'Imported session template',exercises:[],goals:{}}});
 for(const text of ['{','{"version":3}','{"version":2,"kind":"other"}',JSON.stringify({version:2,kind:'template',template:{name:'',exercises:[],goals:{}}}),JSON.stringify({version:2,kind:'template',template:{name:'X',exercises:[],goals:{Chest:12.5}}}),' '.repeat(1048577)]) assert.ok(parseDocument(text).error);
 const t={name:'Template',exercises:[],goals:{Calves:0.5}};
 assert.deepEqual(parseDocument(serializeDocument('template',t)),{kind:'template',document:t});
 assert.throws(()=>serializeDocument('template',{...t,name:''}));
});
