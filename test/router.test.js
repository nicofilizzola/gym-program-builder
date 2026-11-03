import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute} from '../src/router.js';
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
