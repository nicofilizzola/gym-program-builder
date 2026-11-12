import test from 'node:test';
import assert from 'node:assert/strict';
import {focusCardFit,stackHeight} from '../src/workout-focus-fit.js';

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
