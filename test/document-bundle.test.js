import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as bundles from '../src/document-bundle.js';
const template={name:'Push',exercises:[],goals:{},extraMinutes:5,bufferPercent:10};
const bundle={record:{kind:'program',document:{name:'Week',mode:'simple',goals:{},workouts:[{id:'a',templateId:'t',day:0},{id:'b',templateId:'t',day:null}],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'}]}},templates:[{id:'t',kind:'template',document:template}]};
test('portable bundles preserve actual shared identity and reject dangling keys',()=>{
 const text=bundles.serializeDocumentBundle(bundle),data=JSON.parse(text);
 assert.equal(data.version,3);assert.equal(data.templates.length,1);
 assert.equal(data.program.workouts[0].templateKey,data.program.workouts[1].templateKey);
 assert.equal(data.templates[0].template.catalogId,undefined);
 const parsed=bundles.parseDocumentBundle(text);assert.ok(parsed.bundle);
 data.program.workouts[1].templateKey='missing';assert.match(bundles.parseDocumentBundle(JSON.stringify(data)).error,/template/i);
 assert.ok(bundles.parseDocumentBundle(' '.repeat(1048577)).error);
});
test('legacy equal embedded sessions remain independent and metadata is portable plain values',()=>{
 const w={...template,id:'a',day:0},legacy={version:2,kind:'program',program:{name:'Old',mode:'schedule',goals:{},workouts:[w,{...w,id:'b'}]}};
 const parsed=bundles.parseDocumentBundle(JSON.stringify(legacy));assert.equal(parsed.bundle.templates.length,2);
 assert.notEqual(parsed.bundle.program.workouts[0].templateKey,parsed.bundle.program.workouts[1].templateKey);
 const ex={name:'Bench',sets:4,restSeconds:45,warmupSets:0,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],equipment:'Barbell',referenceDescription:'<img>',variantDescription:'Slow',brand:'Brand',focusTags:['Upper chest']};
 const text=bundles.serializeDocumentBundle({record:{kind:'template',document:{...template,exercises:[ex]}}});
 assert.deepEqual(bundles.parseDocumentBundle(text).bundle.template.exercises[0],ex);
 ex.restSeconds=14;assert.ok(bundles.parseDocumentBundle(JSON.stringify({version:3,kind:'template',template:{...template,exercises:[ex]}})).error);
});
