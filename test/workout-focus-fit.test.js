import test from 'node:test';
import assert from 'node:assert/strict';
import {focusCardFit,fitGroup,stackHeight} from '../src/workout-focus-fit.js';

test('peeks the full next header when content and header fit',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:500,peekHeight:43}),{minHeight:555,peekless:false});
});
test('exact fit still peeks',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:555,peekHeight:43}),{minHeight:555,peekless:false});
});
test('no partial peek: one pixel too tall fills the feed',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:556,peekHeight:43}),{minHeight:598,peekless:true});
});
test('no next set never peeks',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:300,peekHeight:0}),{minHeight:598,peekless:true});
});
test('fractional header rounds the min-height',()=>{
 assert.equal(focusCardFit({feedHeight:598,contentHeight:400,peekHeight:42.6}).minHeight,555);
});
test('content taller than the feed stays peekless',()=>{
 assert.deepEqual(focusCardFit({feedHeight:418,contentHeight:600,peekHeight:43}),{minHeight:418,peekless:true});
});
test('stackHeight sums seven sections',()=>{
 assert.equal(stackHeight([40,50,60,30,44,44,48],8,0),40+50+60+30+44+44+48+48);
});
test('stackHeight adds gaps between items and padding',()=>{
 assert.equal(stackHeight([40,50,60],10,12),40+50+60+20+12);
 assert.equal(stackHeight([40],10,0),40);
 assert.equal(stackHeight([],10,8),8);
});
test('fitGroup pins the block, peeks whole rows and falls back to the name',()=>{
 const base={feedHeight:600,nameHeight:50,detailsHeight:70};
 assert.deepEqual(fitGroup({...base,contentHeights:[300,350],peekHeights:[44,50]}),{nameOnly:false,pinned:120,rows:[{offset:120,minHeight:436,peekless:false},{offset:120,minHeight:430,peekless:false}]});
 assert.deepEqual(fitGroup({...base,contentHeights:[450],peekHeights:[44]}).rows[0],{offset:120,minHeight:480,peekless:true});
 assert.deepEqual(fitGroup({...base,contentHeights:[300],peekHeights:[0]}).rows[0],{offset:120,minHeight:480,peekless:true});
 const tight={feedHeight:420,nameHeight:50,detailsHeight:120,contentHeights:[200,300],peekHeights:[44,0]};
 assert.deepEqual(fitGroup(tight),{nameOnly:true,pinned:50,rows:[{offset:170,minHeight:206,peekless:false},{offset:50,minHeight:370,peekless:true}]});
 assert.deepEqual(fitGroup({...tight,editing:true}).rows[1],{offset:170,minHeight:250,peekless:true});
 assert.equal(fitGroup({feedHeight:420,nameHeight:50,detailsHeight:70,contentHeights:[300],peekHeights:[0]}).nameOnly,false);
});
