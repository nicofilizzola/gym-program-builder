import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
import * as tagsModule from '../server/tag-repository.js';
async function setup(t){const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);return {db,c:createCatalogRepository(db),r:createRepository(db),tags:tagsModule.createTagRepository(db)};}
test('tag identities and kind validation preserve archived assignments but reject new ones',async t=>{
 const {c,tags}=await setup(t);await c.createReference({id:'r',name:'Press',exerciseType:'compound',equipment:'Machine'});
 await tags.create({id:'brand',kind:'brand',name:'Prime'});await tags.create({id:'focus',kind:'focus',name:'Prime'});
 await assert.rejects(tags.create({id:'dup',kind:'brand',name:'PRIME'}),{code:'CONFLICT'});
 for(const name of ['', 'x'.repeat(81)])await assert.rejects(tags.create({id:'invalid',kind:'focus',name}),{code:'INVALID'});
 const entry={name:'Paused',primaryMuscles:['Chest'],secondaryMuscles:[],brandId:'brand',focusTagIds:['focus']};
 const first=await c.create({id:'v',familyId:'r',entry});assert.equal(first.brand.name,'Prime');assert.equal(first.focusTags[0].id,'focus');
 await tags.archive({id:'brand',revision:1,archived:true});
 await assert.rejects(c.create({id:'new',familyId:'r',entry:{...entry,name:'New'}}),{code:'INVALID'});
 const clone=await c.create({id:'clone',familyId:'r',sourceVariantId:'v',entry:{...entry,name:'Cloned'}});assert.equal(clone.brand.archived,true);
 await assert.rejects(c.create({id:'wrong',familyId:'r',entry:{...entry,name:'Wrong',brandId:'focus'}}),{code:'INVALID'});
 const current=(await c.list()).entries.find(e=>e.id==='v');
 await c.update({id:'v',revision:current.revision,entry:{...entry,brandId:null},impact:await c.impact('v')});
 const removed=(await c.list()).entries.find(e=>e.id==='v');await assert.rejects(c.update({id:'v',revision:removed.revision,entry,impact:await c.impact('v')}),{code:'INVALID'});
});
test('tag rename updates all linked labels and each template revision only once',async t=>{
 const {c,r,tags}=await setup(t);await c.createReference({id:'r',name:'Press',exerciseType:'compound',equipment:'Machine'});
 await tags.create({id:'focus',kind:'focus',name:'Upper chest'});
 const entries=[];for(const id of ['a','b'])entries.push(await c.create({id,familyId:'r',entry:{name:id,primaryMuscles:['Chest'],secondaryMuscles:[],focusTagIds:['focus']}}));
 await r.create({id:'t',kind:'template',document:{name:'Push',goals:{},exercises:entries.map(e=>({name:e.name,sets:4,repRange:{min:8,max:12},restSeconds:45,primaryMuscles:e.primaryMuscles,secondaryMuscles:[],catalogId:e.id,catalogRevision:e.revision,familyId:'r',equipment:'Machine'}))}});
 await tags.update({id:'focus',revision:1,name:'Clavicular chest'});
 const saved=await r.get('t');assert.equal(saved.revision,2);assert.ok(saved.document.exercises.every(e=>e.focusTags[0]==='Clavicular chest'&&e.restSeconds===45));
});
