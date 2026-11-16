import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute} from '../src/router.js';
import {destinationFor,isSwipeRoot,mobileParentFor,adjacentDestination,createMobileNavigationState,MOBILE_DESTINATIONS} from '../src/mobile-navigation-state.js';

test('mobile parent matrix uses resolved context and owning-root fallbacks',()=>{
 const rows=[
  ['#/home','home',null],
  ['#/home?section=history','home',null],
  ['#/home?section=','home',null],
  ['#/home?section=unknown','home',null],
  ['#/programs','library',null],
  ['#/templates','library',null],
  ['#/catalog','library',null],
  ['#/user','user',null],
  ['#/workouts','home',null],
  ['#/programs/p','library',{label:'Programs',href:'#/programs'}],
  ['#/programs/p/workouts/o','library',{label:'Programs',href:'#/programs'}],
  ['#/programs/missing/workouts/o','library',{label:'Programs',href:'#/programs'}],
  ['#/templates/t','library',{label:'Templates',href:'#/templates'}],
  ['#/catalog/references/r','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/references/r/variants/v','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/tags?kind=focus&q=upper+chest','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/tags?kind=brand&q=x','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/tags?kind=focus&q=lower','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/tags?kind=&q=','library',{label:'Exercises',href:'#/catalog'}],
  ['#/catalog/tags?other=unknown','library',{label:'Exercises',href:'#/catalog'}],
  ['#/profile','user',{label:'User',href:'#/user'}],
  ['#/workouts/w','home',{label:'Home',href:'#/home'}],
  ['#/workouts/missing','home',{label:'Home',href:'#/home'}],
  ['#/unrelated/depth',null,{label:'Home',href:'#/home'}],
  ['#/catalog/tags?kind=unknown',null,{label:'Home',href:'#/home'}],
  ['#/programs/a%20b',null,{label:'Home',href:'#/home'}],
  ['#/programs/p/workouts/a.b',null,{label:'Home',href:'#/home'}],
  ['#/templates/',null,{label:'Home',href:'#/home'}],
  ['#/catalog/references/%ZZ',null,{label:'Home',href:'#/home'}],
  ['#/catalog/references/r/variants/',null,{label:'Home',href:'#/home'}],
  ['#/workouts/a/b',null,{label:'Home',href:'#/home'}]
 ];
 for(const [hash,destination,parent] of rows){
  assert.deepEqual(mobileParentFor(hash),parent,hash);
  assert.equal(destinationFor(hash),destination,hash);
  assert.equal(isSwipeRoot(hash),parent===null,hash);
 }
 assert.deepEqual(mobileParentFor('#/programs/p/workouts/o',{program:{id:'p',name:'Upper / Lower'}}),{label:'Upper / Lower',href:'#/programs/p'});
 assert.deepEqual(mobileParentFor('#/programs/old/workouts/o',{program:{id:'new',name:'Current program'}}),{label:'Current program',href:'#/programs/new'});
 assert.deepEqual(mobileParentFor('#/catalog/references/r/variants/v',{reference:{id:'r',name:'Bench press'}}),{label:'Bench press',href:'#/catalog/references/r'});
 assert.deepEqual(mobileParentFor('#/catalog/references/old/variants/v',{reference:{id:'new',name:'Current reference'}}),{label:'Current reference',href:'#/catalog/references/new'});
 assert.equal(mobileParentFor('#/catalog',{reference:{id:'r',name:'Bench press'}}),null);
});

test('groups nested routes without making them swipe roots',()=>{
 assert.deepEqual(parseRoute('#/user'),{view:'user'});
 for(const [hash,dest] of [['#/catalog/tags?kind=focus','library'],['#/programs/p/workouts/w','library'],['#/templates/t','library'],['#/profile','user'],['#/workouts/w','home']]){
  assert.equal(destinationFor(hash),dest);assert.equal(isSwipeRoot(hash),false);
 }
 for(const hash of ['#/home','#/programs','#/templates','#/catalog','#/workouts','#/user'])assert.equal(isSwipeRoot(hash),true);
 assert.equal(destinationFor('#/unknown'),null);
});
test('library changes only on commit and clears with page memory',()=>{
 const state=createMobileNavigationState();assert.equal(state.href('library'),'#/programs');
 state.commit('#/catalog/references/r');assert.equal(state.href('library'),'#/catalog');
 state.commit('#/user');assert.equal(state.href('library'),'#/catalog');
 state.commit('#/programs/p/workouts/w');assert.equal(state.href('library'),'#/programs');
 state.commit('#/templates/t');assert.equal(state.href('library'),'#/templates');
 const value={scrollY:123,state:{query:'curl',expanded:['r']}};
 state.writePage('#/catalog',value);value.state.expanded.push('other');
 assert.deepEqual(state.readPage('#/catalog').state.expanded,['r']);
 state.readPage('#/catalog').state.expanded.push('other');
 assert.deepEqual(state.readPage('#/catalog').state.expanded,['r']);
 state.writePage('#/profile',value);assert.equal(state.readPage('#/profile'),null);
 state.clear();assert.equal(state.readPage('#/catalog'),null);assert.equal(state.href('library'),'#/programs');
});
test('adjacency stops at both ends',()=>{
 assert.deepEqual(MOBILE_DESTINATIONS,['home','library','user']);assert.equal(destinationFor('#/workouts'),'home');
 assert.equal(adjacentDestination('home','previous'),null);
 assert.equal(adjacentDestination('user','next'),null);
 assert.equal(adjacentDestination('home','next'),'library');
 assert.equal(adjacentDestination('library','next'),'user');assert.equal(adjacentDestination('user','previous'),'library');
});

test('forget Home removes only its page memory',()=>{
 const state=createMobileNavigationState();state.writePage('#/home',{scrollY:800,state:{visibleCount:45}});state.writePage('#/catalog',{scrollY:100});
 state.forget('#/home');assert.equal(state.readPage('#/home'),null);assert.deepEqual(state.readPage('#/catalog'),{scrollY:100});
});
