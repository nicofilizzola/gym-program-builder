import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument } from '../src/document-validation.js';

const workout = () => ({name:'Upper',exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}],goals:{Chest:12}});
const program = () => ({name:'Week',mode:'simple',goals:{Chest:30},workouts:[{...workout(),id:'a',day:null}]});

test('timing defaults only absent fields in templates and program workouts',()=>{
 for(const kind of ['template','program']) {
  const original=kind==='template'?workout():program();
  const cleaned=validateDocument(kind,original).document;
  const w=kind==='template'?cleaned:cleaned.workouts[0];
  assert.equal(w.extraMinutes,5);assert.equal(w.bufferPercent,10);assert.equal(w.exercises[0].restSeconds,120);
  for(const [key,invalid] of [['restSeconds',[null,'90',-15,Infinity,301,14]],['extraMinutes',[null,'5',-1,Infinity,61,0.5]],['bufferPercent',[null,'10',-5,Infinity,51,7]]]) {
   for(const value of invalid) for(const draft of [true,false]) {
    const candidate=structuredClone(original),target=kind==='template'?candidate:candidate.workouts[0];
    (key==='restSeconds'?target.exercises[0]:target)[key]=value;
    const result=validateDocument(kind,candidate,{draft});
    assert.ok(result.error,key+' '+value+' must fail');
    if(key==='restSeconds')assert.match(result.error,/Exercise 1:/);
   }
  }
  const zero=structuredClone(original),target=kind==='template'?zero:zero.workouts[0];
  target.extraMinutes=0;target.bufferPercent=0;target.exercises[0].restSeconds=0;
  const result=validateDocument(kind,zero).document,zw=kind==='template'?result:result.workouts[0];
  assert.equal(zw.extraMinutes,0);assert.equal(zw.bufferPercent,0);assert.equal(zw.exercises[0].restSeconds,0);
 }
});
test('strict documents reject invalid structure, muscle and weekly bounds',()=>{
  assert.ok(validateDocument('program',program()).document);
  for(const value of [0,30.5,NaN]) assert.ok(validateDocument('program',{...program(),goals:{Chest:value}}).error);
  for(const day of [-1,7]) {const p=program();p.workouts[0].day=day;assert.ok(validateDocument('program',p).error);}
  const p=program();p.workouts.push(p.workouts[0]);assert.ok(validateDocument('program',p).error);
  assert.ok(validateDocument('program',{...program(),mode:'other'}).error);
  assert.ok(validateDocument('template',{...workout(),exercises:null}).error);
  const w=workout();w.exercises[0].secondaryMuscles=['Chest'];assert.ok(validateDocument('template',w,{draft:true}).error);
});
test('draft saves relax empty names and primary selections only',()=>{
  const w=workout();w.name='';w.exercises[0].name='';w.exercises[0].primaryMuscles=[];
  assert.ok(validateDocument('template',w,{draft:true}).document);
  assert.ok(validateDocument('template',w).error);
  w.exercises[0].sets=11;
  assert.ok(validateDocument('template',w,{draft:true}).error);
});
