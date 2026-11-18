import test from 'node:test';
import assert from 'node:assert/strict';
import {fitGroup,fitPair,stackHeight} from '../src/workout-focus-fit.js';

test('stackHeight sums seven sections',()=>{
 assert.equal(stackHeight([40,50,60,30,44,44,48],8,0),40+50+60+30+44+44+48+48);
});
test('stackHeight adds gaps between items and padding',()=>{
 assert.equal(stackHeight([40,50,60],10,12),40+50+60+20+12);
 assert.equal(stackHeight([40],10,0),40);
 assert.equal(stackHeight([],10,8),8);
});
test('fitGroup fills the space under the whole pinned block, with no peek',()=>{
 assert.deepEqual(fitGroup({feedHeight:600,nameHeight:50,detailsHeight:70,contentHeights:[300,350]}),
  {nameOnly:false,pinned:120,rows:[{offset:120,minHeight:480},{offset:120,minHeight:480}]});
 // Content that exactly fills the space keeps the whole block pinned.
 assert.deepEqual(fitGroup({feedHeight:600,nameHeight:50,detailsHeight:70,contentHeights:[480]}),{nameOnly:false,pinned:120,rows:[{offset:120,minHeight:480}]});
});
test('fitGroup falls back to the name: row 0 under the whole block, later rows under the name',()=>{
 const tight={feedHeight:420,nameHeight:50,detailsHeight:120,contentHeights:[200,300]};
 assert.deepEqual(fitGroup(tight),{nameOnly:true,pinned:50,rows:[{offset:170,minHeight:250},{offset:50,minHeight:370}]});
 // An open exercise-note editor keeps the whole block pinned.
 assert.deepEqual(fitGroup({...tight,editing:true}),{nameOnly:false,pinned:170,rows:[{offset:170,minHeight:250},{offset:170,minHeight:250}]});
 assert.equal(fitGroup({feedHeight:420,nameHeight:50,detailsHeight:70,contentHeights:[300]}).nameOnly,false);
 assert.equal(fitGroup({feedHeight:420,nameHeight:50,detailsHeight:70,contentHeights:[301]}).nameOnly,true);
});
test('fitPair compacts before controls are crowded and reserves the larger member',()=>{
 assert.deepEqual(fitPair({feedHeight:600,headerHeight:100,fullHeights:[420,550],compactHeights:[360,430]}),{compact:true,minHeight:600,paneMinHeight:500});
});
test('fitPair grows an oversized round naturally',()=>{
 assert.deepEqual(fitPair({feedHeight:420,headerHeight:100,fullHeights:[600],compactHeights:[540]}),{compact:true,minHeight:640,paneMinHeight:540});
});
test('fitPair keeps the full layout at an exact fit and fills the page',()=>{
 assert.deepEqual(fitPair({feedHeight:600,headerHeight:100,fullHeights:[500,380],compactHeights:[440,320]}),{compact:false,minHeight:600,paneMinHeight:500});
 assert.deepEqual(fitPair({feedHeight:600,headerHeight:100,fullHeights:[300,380],compactHeights:[240,320]}),{compact:false,minHeight:600,paneMinHeight:500});
});
test('fitPair decides with the full header and lays a compact round out under its tighter header',()=>{
 assert.deepEqual(fitPair({feedHeight:431,headerHeight:104,compactHeaderHeight:94,fullHeights:[370],compactHeights:[330]}),{compact:true,minHeight:431,paneMinHeight:337});
 // The full layout is chosen only when it fits under the full header.
 assert.deepEqual(fitPair({feedHeight:431,headerHeight:104,compactHeaderHeight:94,fullHeights:[327],compactHeights:[300]}),{compact:false,minHeight:431,paneMinHeight:327});
 assert.equal(fitPair({feedHeight:431,headerHeight:104,compactHeaderHeight:94,fullHeights:[328],compactHeights:[300]}).compact,true);
});
test('fitPair reserves the taller of asymmetric members in either order',()=>{
 const one=fitPair({feedHeight:560,headerHeight:110,fullHeights:[300,520],compactHeights:[250,470]}),two=fitPair({feedHeight:560,headerHeight:110,fullHeights:[520,300],compactHeights:[470,250]});
 assert.deepEqual(one,{compact:true,minHeight:580,paneMinHeight:470});assert.deepEqual(two,one);
 // An absent member is simply not measured.
 assert.deepEqual(fitPair({feedHeight:560,headerHeight:110,fullHeights:[300],compactHeights:[250]}),{compact:false,minHeight:560,paneMinHeight:450});
});
test('fitPair fills the feed exactly under a fractional header and grows an oversized round to whole pixels',()=>{
 // A round 1px taller than the feed lets the feed rest 1px past its snap point.
 assert.deepEqual(fitPair({feedHeight:614,headerHeight:108.390625,fullHeights:[400],compactHeights:[380]}),{compact:false,minHeight:614,paneMinHeight:505.609375});
 assert.deepEqual(fitPair({feedHeight:600,headerHeight:100.25,fullHeights:[550.5],compactHeights:[520.5]}),{compact:true,minHeight:621,paneMinHeight:520.75});
});
