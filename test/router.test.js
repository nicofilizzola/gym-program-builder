import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,resolveEntryHash} from '../src/router.js';

test('mobile Workouts entry opens the History section of Home',()=>{
 assert.equal(resolveEntryHash('#/workouts',{mobile:true}),'#/home?section=history');
 assert.equal(resolveEntryHash('#/workouts'),'#/workouts');assert.equal(resolveEntryHash('#/workouts/w',{mobile:true}),'#/workouts/w');
 assert.deepEqual(parseRoute('#/home?section=history'),{view:'home',section:'history'});
 for(const hash of ['#/home','#/home?section=unknown','#/home?other=history'])assert.deepEqual(parseRoute(hash),{view:'home'});
});
test('empty entry chooses device home without changing explicit deep links',()=>{
 for(const hash of ['','#','/','#/']){
  assert.equal(resolveEntryHash(hash,{mobile:true}),'#/home');
  assert.equal(resolveEntryHash(hash,{mobile:false}),'#/programs');
 }
 for(const hash of ['#/templates/t','#/programs','#/workouts/w'])assert.equal(resolveEntryHash(hash,{mobile:true}),hash);
 assert.deepEqual(parseRoute('#/home'),{view:'home'});
});
test('nested routes preserve stable program catalog and tag context',()=>{
 assert.deepEqual(parseRoute('#/programs/p/workouts/w'),{view:'program-workout',id:'p',occurrenceId:'w'});
 assert.deepEqual(parseRoute('#/catalog/references/r'),{view:'catalog-reference',referenceId:'r'});
 assert.deepEqual(parseRoute('#/catalog/references/r/variants/v'),{view:'catalog-variant',referenceId:'r',variantId:'v'});
 assert.deepEqual(parseRoute('#/catalog/tags?kind=focus&q=upper+chest'),{view:'catalog-tags',kind:'focus',query:'upper chest'});
 for(const value of ['#/catalog/references/%ZZ','#/catalog/references/','#/catalog/tags?kind=unknown'])assert.equal(parseRoute(value).view,'not-found');
});
test('profile route parses without an id',()=>{
 assert.deepEqual(parseRoute('#/profile'),{view:'profile'});
 assert.equal(parseRoute('#/profile/x').view,'not-found');
});
test('workouts routes parse history and detail',()=>{
 assert.deepEqual(parseRoute('#/workouts'),{view:'workouts'});
 assert.deepEqual(parseRoute('#/workouts/abc-1'),{view:'workout',id:'abc-1'});
 for(const value of ['#/workouts/','#/workouts/a%20b','#/workouts/a/b','#/workouts/a.b'])assert.equal(parseRoute(value).view,'not-found',value);
});
