import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSwipeGesture} from '../src/swipe-gesture.js';
const point=(x,y=200,time=0)=>({x,y,time});
const gesture=()=>createSwipeGesture({width:400,canPrevious:true,canNext:true});
test('movement and axis thresholds preserve pending and vertical scroll',()=>{
 const g=gesture();assert.equal(g.start(point(200)),true);
 assert.equal(g.move(point(189,200,20)).phase,'pending');
 assert.equal(g.move(point(187,210,30)).phase,'pending');
 assert.equal(g.move(point(184,210,40)).phase,'dragging');
 g.cancel();g.start(point(200));assert.equal(g.move(point(198,220,30)).phase,'vertical');
 assert.equal(g.move(point(100,222,50)).phase,'vertical');assert.equal(g.end(point(50,222,100)).commit,false);
});
test('distance and recent release velocity decide commits',()=>{
 for(const [distance,commit] of [[99,false],[100,true]]){
  const g=gesture();g.start(point(200));g.move(point(200-distance,200,300));assert.equal(g.end(point(200-distance,200,500)).commit,commit);
 }
 for(const [distance,commit] of [[23,false],[24,true]]){
  const g=gesture();g.start(point(200));g.move(point(200-distance,200,48));assert.equal(g.end(point(200-distance,200,48)).commit,commit);
 }
 const paused=gesture();paused.start(point(200));paused.move(point(160,200,40));assert.equal(paused.end(point(160,200,300)).commit,false);
});
test('boundaries edge strips cancellation and reversal never navigate',()=>{
 const g=gesture();for(const x of [0,23,377,399])assert.equal(g.start(point(x)),false);
 const end=createSwipeGesture({width:400,canPrevious:true,canNext:false});end.start(point(200));assert.notEqual(end.move(point(100,200,40)).phase,'dragging');
 g.start(point(200));g.move(point(80,200,50));g.move(point(170,200,90));assert.equal(g.end(point(175,200,100)).commit,false);
 g.start(point(200));g.move(point(80,200,50));g.cancel();assert.equal(g.end(point(80,200,60)).commit,false);
});
