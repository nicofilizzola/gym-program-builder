import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.js';
import {createDb,migrate} from '../server/db.js';
import {seedCatalog} from '../server/catalog-seed.js';

const definition={name:'Bench press',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps','Front delts']};
test('catalog validation rejects incompatible mappings and incomplete definitions',()=>{
  assert.equal(catalog.validateCatalogEntry({...definition,name:'  Bench press  '}).entry.name,'Bench press');
  for(const bad of [{name:''},{equipment:'Unknown'},{primaryMuscles:[]},{secondaryMuscles:['Chest']},{primaryMuscles:['Forearms']},{primaryMuscles:['Chest','Chest']}])assert.ok(catalog.validateCatalogEntry({...definition,...bad}).error);
});
test('search matches every normalized word and ranks exact names ahead of prefixes',()=>{
  const entries=[{...definition,id:'b',familyName:'Press',name:'Bench press incline'},{...definition,id:'a',familyName:'Press'},{...definition,id:'c',familyName:'Press',name:'Décline bench press'},{...definition,id:'d',familyName:'Press',archived:true}];
  assert.deepEqual(catalog.searchCatalog(entries,'bench press').map(e=>e.id),['a','b','c']);
  assert.deepEqual(catalog.searchCatalog(entries,'decline barbell').map(e=>e.id),['c']);
  assert.equal(catalog.searchCatalog(entries,'bench cable').length,0);
  assert.equal(catalog.searchCatalog(entries,'',{equipment:'Cable'}).length,0);
});
test('resolving catalog snapshots preserves workout prescription',()=>{
  const result=catalog.snapshotExercise({sets:4,repRange:{min:6,max:8}}, {...definition,id:'bench',familyId:'press',revision:2});
  assert.equal(result.catalogId,'bench');assert.equal(result.name,'Bench press');assert.equal(result.sets,4);assert.deepEqual(result.repRange,{min:6,max:8});
});
test('explicit seed reruns never overwrite edited or archived catalog entries',async()=>{
  const db=createDb({url:':memory:'});
  try{await migrate(db);await seedCatalog(db);const rows=await db.execute('SELECT * FROM catalog_entries');assert.ok(rows.rows.length>=55);
    const id=rows.rows[0].id;await db.execute({sql:'UPDATE catalog_entries SET name=?,archived=1 WHERE id=?',args:['My edited exercise',id]});
    await seedCatalog(db);const found=await db.execute({sql:'SELECT name,archived FROM catalog_entries WHERE id=?',args:[id]});assert.equal(found.rows[0].name,'My edited exercise');assert.equal(Number(found.rows[0].archived),1);
  }finally{db.close();}
});

test('variantConflict needs the same name and the same tags',()=>{
 const v=(name,brandId=null,focusTagIds=[])=>({name,brandId,focusTagIds});
 assert.equal(catalog.variantConflict(v('Chest press'),v(' chést PRESS ')),true);
 assert.equal(catalog.variantConflict(v('Chest press'),v('Chest press','hammer')),false);
 assert.equal(catalog.variantConflict(v('Chest press','hammer'),v('Chest press','technogym')),false);
 assert.equal(catalog.variantConflict(v('Chest press','hammer',['a','b']),v('Chest press','hammer',['b','a'])),true);
 assert.equal(catalog.variantConflict(v('Chest press','hammer',['a']),v('Chest press','hammer')),false);
 assert.equal(catalog.variantConflict({name:'Chest press',brand:{id:'hammer'},focusTags:[{id:'a'}]},v('Chest press','hammer',['a'])),true);
 assert.equal(catalog.variantConflict(v('Chest press'),v('Incline press')),false);
});
test('variantLabels add tags only where names collide',()=>{
 assert.deepEqual(catalog.variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Lateral raise',brand:'Hammer'}]),['Chest press','Lateral raise']);
 assert.deepEqual(catalog.variantLabels([{name:'Chest press',brand:'Hammer',focusTags:['Stretch']},{name:'chest press',brand:{name:'Technogym'}},{name:'Chest press'}]),['Chest press · Hammer · Stretch','chest press · Technogym','Chest press']);
 assert.deepEqual(catalog.variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Technogym'}]),['Chest press · Hammer','Chest press · Hammer','Chest press · Technogym']);
 assert.deepEqual(catalog.variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Hammer'}]),['Chest press','Chest press']);
});
test('compareVariants keeps same-name variants together',()=>{
 const e=(id,name,brand=null,focus=[])=>({id,name,brand:brand&&{name:brand},focusTags:focus.map(name=>({name}))});
 const list=[e('4','Chest press','Technogym'),e('2','Chest press','Hammer',['Stretch']),e('1','Chest press'),e('5','Arm curl'),e('3','Chest press','Hammer')];
 assert.deepEqual(list.sort(catalog.compareVariants).map(x=>x.id),['5','1','3','2','4']);
});
