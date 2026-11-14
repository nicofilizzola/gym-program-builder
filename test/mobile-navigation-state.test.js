import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute} from '../src/router.js';
import {destinationFor,isSwipeRoot,adjacentDestination,createMobileNavigationState,MOBILE_DESTINATIONS} from '../src/mobile-navigation-state.js';

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
