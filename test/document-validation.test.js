import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument } from '../src/document-validation.js';

const workout = () => ({name:'Upper',exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}],goals:{Chest:12}});
const program = () => ({name:'Week',mode:'simple',goals:{Chest:30},workouts:[{...workout(),id:'a',day:null}]});
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

test('sequence validation retains rest days and rejects broken references in drafts',()=>{
 const p={...program(),sequence:[{type:'rest',id:'r'},{type:'workout',workoutId:'a'}]};
 for(const draft of [false,true]){
  assert.deepEqual(validateDocument('program',p,{draft}).document,p);
  for(const sequence of [null,{},[],[{type:'rest',id:'a'}],[{type:'workout',workoutId:'unknown'}],
   [{type:'rest',id:'r'},{type:'rest',id:'r'},{type:'workout',workoutId:'a'}],
   [{type:'workout',workoutId:'a'},{type:'workout',workoutId:'a'}],[{type:'other'}]])
   assert.ok(validateDocument('program',{...p,sequence},{draft}).error,JSON.stringify(sequence));
 }
 assert.ok(validateDocument('program',{...p,workouts:[...p.workouts,{...p.workouts[0],id:'b'}],
  sequence:[{type:'workout',workoutId:'b'},{type:'workout',workoutId:'a'}]}).error);
 assert.ok(validateDocument('program',{...p,workouts:[],sequence:[{type:'rest',id:'r'}]}).document);
 for(const mode of ['simple','schedule'])assert.equal(validateDocument('program',{...program(),mode}).document.mode,mode);
});

