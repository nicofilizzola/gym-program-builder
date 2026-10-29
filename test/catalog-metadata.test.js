import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchCatalog} from '../src/catalog.js';
import {groupCatalog,flattenVariantOptions} from '../src/catalog-groups.js';
test('search joins name brand and free-form focus while excluding unconfigured selections',()=>{
 const entry={id:'v',familyId:'r',name:'Paused press',equipment:'Machine',primaryMuscles:['Chest'],secondaryMuscles:[],brand:{id:'b',name:'Pánatta',archived:true},focusTags:[{id:'f',name:'Upper chest',archived:true}]};
 assert.deepEqual(searchCatalog([entry],'panatta upper').map(e=>e.id),['v']);
 const data={families:[{id:'r',name:'Machine bench'}],entries:[entry]};
 assert.deepEqual(flattenVariantOptions(groupCatalog(data,'upper paused',{mode:'picker'})).map(e=>e.id),['v']);
 data.entries=[{...entry,equipmentConfigured:false}];assert.equal(flattenVariantOptions(groupCatalog(data,'upper',{mode:'picker'})).length,0);
 assert.equal(groupCatalog(data,'upper',{mode:'catalog'})[0].variants.length,1);
});
