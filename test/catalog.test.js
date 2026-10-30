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
