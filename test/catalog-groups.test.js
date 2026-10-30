import test from 'node:test';
import assert from 'node:assert/strict';
import {groupCatalog,flattenVariantOptions} from '../src/catalog-groups.js';
const families=[{id:'r1',name:'Bench press',revision:1,archived:false},{id:'r2',name:'Row',revision:1,archived:false},{id:'r3',name:'Empty',revision:1,archived:false}];
const variant=(id,familyId,name,equipment='Barbell',archived=false)=>({id,familyId,name,equipment,archived,individuallyArchived:archived});
const entries=[variant('v1','r1','Flat barbell press'),variant('v2','r1','Incline dumbbell press','Dumbbell'),variant('v3','r1','Old press','Barbell',true),variant('v4','r2','Cable row','Cable')];
test('reference matching includes eligible children and variant filtering retains its heading',()=>{
 assert.deepEqual(groupCatalog({entries,families},'bench press').map(g=>[g.reference.id,g.variants.map(v=>v.id)]),[['r1',['v1','v2']]]);
 assert.deepEqual(groupCatalog({entries,families},'incline').map(g=>[g.reference.id,g.variants.map(v=>v.id)]),[['r1',['v2']]]);
 assert.deepEqual(flattenVariantOptions(groupCatalog({entries,families},'bench',{equipment:'Dumbbell'})).map(v=>v.id),['v2']);
 assert.deepEqual(groupCatalog({entries,families},'empty').map(g=>g.reference.id),['r3']);
 assert.equal(groupCatalog({entries,families},'empty',{equipment:'Dumbbell'}).length,0);
 assert.equal(groupCatalog({entries:[variant('old','r1','Old','Barbell',true)],families},'').find(g=>g.reference.id==='r1').activeCount,0);
});
test('effective archives and duplicate reference names never produce selectable parents or merged IDs',()=>{
 const refs=[{...families[0],archived:true},{...families[1],name:'Bench press'},families[2]];
 const groups=groupCatalog({entries,families:refs},'',{showArchived:true});
 assert.equal(groups.find(g=>g.reference.id==='r1').activeCount,0);assert.equal(groups.find(g=>g.reference.id==='r1').archivedCount,3);
 assert.equal(groups.filter(g=>g.reference.name==='Bench press').length,2);
 assert.deepEqual(flattenVariantOptions(groupCatalog({entries,families:refs},'',{mode:'picker'})).map(v=>v.id),['v4']);
});
test('picker caps selectable variants before grouping and returns keyboard order matching visible groups',()=>{
 const many=Array.from({length:12},(_,i)=>variant('x'+i,i%2?'r2':'r1','Press '+String(i).padStart(2,'0')));
 const groups=groupCatalog({entries:many,families},'press',{mode:'picker'});
 assert.equal(flattenVariantOptions(groups).length,8);
 assert.deepEqual(flattenVariantOptions(groups).map(v=>v.id),['x0','x2','x4','x6','x1','x3','x5','x7']);
 assert.equal(flattenVariantOptions(groupCatalog({entries:many,families},'Press 09',{mode:'picker'}))[0].id,'x9');
 assert.deepEqual(groupCatalog({entries,families},'').map(g=>g.reference.id),['r1','r3','r2']);
});

const filteredData={families:[{id:'press',name:'Press',exerciseType:'compound'},{id:'curl',name:'Curl',exerciseType:'isolation'},{id:'empty',name:'Empty',exerciseType:'compound'},{id:'unknown',name:'Unknown'}],entries:[
 {id:'bench',familyId:'press',name:'Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']},
 {id:'incline',familyId:'press',name:'Incline',equipment:'Dumbbell',primaryMuscles:['Chest'],secondaryMuscles:['Front delts']},
 {id:'curl1',familyId:'curl',name:'Curl',equipment:'Dumbbell',primaryMuscles:['Biceps'],secondaryMuscles:[]},
 {id:'old',familyId:'press',name:'Old press',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],archived:true},
 {id:'custom',familyId:'unknown',name:'Custom',primaryMuscles:['Chest'],secondaryMuscles:[]}
]};
const matches=options=>flattenVariantOptions(groupCatalog(filteredData,'',options)).map(v=>v.id);
test('catalog filters combine actual muscle roles, reference type and equipment',()=>{
 assert.deepEqual(matches({primaryMuscle:'Chest',secondaryMuscle:'Triceps',exerciseType:'compound',equipment:'Barbell'}),['bench']);
 assert.deepEqual(matches({primaryMuscle:'Triceps'}),[]);
 assert.deepEqual(matches({secondaryMuscle:'Chest'}),[]);
 assert.deepEqual(matches({exerciseType:'isolation'}),['curl1']);
 assert.deepEqual(matches({primaryMuscle:'Chest',showArchived:true,exerciseType:'compound'}),['bench','incline','old']);
 assert.deepEqual(matches({primaryMuscle:'Chest',exerciseType:'compound'}),['bench','incline']);
 assert.ok(matches({primaryMuscle:'Chest'}).includes('custom'));
});
test('empty references and reference search cannot bypass variant-role filters',()=>{
 assert.deepEqual(groupCatalog(filteredData,'empty',{primaryMuscle:'Chest'}),[]);
 assert.deepEqual(groupCatalog(filteredData,'empty',{exerciseType:'isolation'}),[]);
 assert.deepEqual(groupCatalog(filteredData,'empty',{exerciseType:'compound'}).map(g=>g.reference.id),['empty']);
 assert.deepEqual(groupCatalog(filteredData,'press',{primaryMuscle:'Biceps'}),[]);
 const data=structuredClone(filteredData);data.families.find(f=>f.id==='empty').defaultPrimaryMuscles=['Chest'];
 assert.ok(!groupCatalog(data,'',{primaryMuscle:'Chest'}).some(g=>g.reference.id==='empty'));
});
