import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WORKOUT_COVERS,normalizeWorkoutCover} from '../src/workout-cover.js';
import {validateDocument} from '../src/document-validation.js';
import {createTemplate} from '../src/program.js';
import {createWorkoutLog,validateWorkoutLog} from '../src/workout-log.js';
import {parseDocumentBundle,serializeDocumentBundle} from '../src/document-bundle.js';
import {resolveProgram} from '../src/program-links.js';
const template=()=>({name:'Push',exercises:[],goals:{},extraMinutes:5,bufferPercent:10});
const makeLog=(document)=>createWorkoutLog({id:'log',now:new Date('2026-11-06T10:00:00Z'),makeId:()=>crypto.randomUUID(),...(document?{template:{id:'t',document}}:{})});
test('cover defaults only missing values and rejects unsafe or unknown identity',()=>{
 assert.equal(normalizeWorkoutCover(),'gym');
 for(const id of ['gym','dumbbells','barbell','machines'])assert.equal(normalizeWorkoutCover(id),id);
 for(const id of [null,'','https://example.com/a.jpg',[],{},'other'])assert.throws(()=>normalizeWorkoutCover(id),/Invalid workout cover\./);
 assert.equal(WORKOUT_COVERS.length,4);
});
test('templates normalize covers and workouts retain their own snapshot',()=>{
 assert.equal(createTemplate().coverId,'gym');
 assert.equal(validateDocument('template',template()).document.coverId,'gym');
 assert.equal(validateDocument('template',{...template(),coverId:null}).error,'Invalid workout cover.');
 const t={...template(),coverId:'barbell'},log=makeLog(t);t.coverId='machines';
 assert.equal(log.coverId,'barbell');assert.equal(makeLog().coverId,'gym');
 for(const logVersion of [1,2]){const old={...makeLog(),logVersion};delete old.coverId;assert.equal(validateWorkoutLog(old).log.coverId,'gym');}
 assert.equal(validateWorkoutLog({...makeLog(),coverId:'evil'}).error,'Invalid workout cover.');
});
test('portable versions retain or default covers and reject invalid supplied fields atomically',()=>{
 for(const version of [3,4]){
  assert.equal(parseDocumentBundle(JSON.stringify({version,kind:'template',template:template()})).bundle.template.coverId,'gym');
  assert.equal(parseDocumentBundle(JSON.stringify({version,kind:'template',template:{...template(),coverId:'bad'}})).error,'Invalid workout cover.');
 }
 for(const input of [{version:1,exercises:[],goals:{}},{version:2,kind:'template',template:template()}])assert.equal(parseDocumentBundle(JSON.stringify(input)).bundle.template.coverId,'gym');
 assert.equal(parseDocumentBundle(JSON.stringify({version:1,exercises:[],goals:{},coverId:'bad'})).error,'Invalid workout cover.');
 const t={id:'t',kind:'template',document:{...template(),coverId:'machines'}};
 const record={kind:'program',document:{name:'P',mode:'schedule',goals:{},workouts:[{id:'a',templateId:'t',day:0},{id:'b',templateId:'t',day:2}]}};
 const text=serializeDocumentBundle({record,templates:[t]}),data=JSON.parse(text);
 assert.equal(data.version,4);assert.equal(data.templates.length,1);assert.equal(data.templates[0].template.coverId,'machines');
 assert.equal(resolveProgram(record.document,[t]).workouts[1].coverId,'machines');
});
