import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as links from '../src/program-links.js';
import {validateDocument} from '../src/document-validation.js';

const template={id:'t',kind:'template',revision:2,document:{name:'Push',exercises:[{name:'Bench',sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}],goals:{},extraMinutes:15,bufferPercent:25}};
const program={name:'Week',mode:'schedule',goals:{},workouts:[{id:'a',templateId:'t',day:0},{id:'b',templateId:'t',day:null}]};
test('linked program validation keeps occurrences and rejects embedded content',()=>{
 assert.deepEqual(validateDocument('program',program).document,program);
 assert.match(validateDocument('program',{...program,workouts:[{...program.workouts[0],exercises:[]}]}).error,/embedded|content/i);
 for(const workouts of [[{id:'a',templateId:'',day:0}],[{id:'a',templateId:'t',day:7}],[program.workouts[0],program.workouts[0]]])assert.ok(validateDocument('program',{...program,workouts}).error);
 assert.ok(validateDocument('program',{...program,sequence:[{type:'workout',workoutId:'missing'}]}).error);
});
test('resolution shares template data without mutating authoritative records',()=>{
 const value=links.resolveProgram(program,[template]);
 assert.equal(value.workouts[0].exercises[0].sets,4);
 assert.equal(value.workouts[1].name,'Push');
 assert.equal(value.workouts[1].day,null);
 assert.equal(value.workouts[0].templateRevision,2);
 value.workouts[0].exercises[0].sets=9;
 assert.equal(template.document.exercises[0].sets,4);
 assert.throws(()=>links.resolveProgram(program,[]),/template/i);
 assert.throws(()=>links.resolveProgram(program,[{...template,kind:'program'}]),/template/i);
 assert.throws(()=>links.resolveProgram(program,[template,template]),/duplicate/i);
});
