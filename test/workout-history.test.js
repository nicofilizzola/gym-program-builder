import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupByLocalDate} from '../src/workout-history-view.js';
const at=(d,h)=>new Date(2026,10,d,h,0,0).toISOString();
test('groupByLocalDate groups same local day together, newest first',()=>{
 const items=[{id:'c',startedAt:at(4,8)},{id:'b',startedAt:at(3,21)},{id:'a',startedAt:at(3,9)}];
 const groups=groupByLocalDate(items);
 assert.deepEqual(groups.map(g=>g.date),['2026-11-04','2026-11-03']);
 assert.deepEqual(groups[1].items.map(i=>i.id),['b','a']);
 assert.equal(typeof groups[0].label,'string');assert.ok(groups[0].label.includes('2026'));
 assert.deepEqual(groupByLocalDate([]),[]);
});
