import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,upNextProgram,upNextOccurrence,occurrenceLabels,sessionOrder} from '../src/workout-up-next.js';
import {toLocalIso} from '../src/workout-log.js';

// Local dates so the rules are checked in whatever timezone the tests run in. 2026-11-02 is a Monday.
const at=(day,hour=10,minute=0)=>new Date(2026,10,day,hour,minute);
const log=(occurrenceId,iso,programId='p')=>({source:{kind:'program',programId,occurrenceId,templateId:'t',programName:'',templateName:''},startedAt:iso});
const logAt=(occurrenceId,date,programId)=>log(occurrenceId,toLocalIso(date),programId);
/** The same instant written with another UTC offset, e.g. a log saved while travelling. */
function isoWithOffset(date,minutes){
 const shifted=new Date(date.getTime()+minutes*60000),pad=n=>String(n).padStart(2,'0'),abs=Math.abs(minutes);
 return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth()+1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00.000${minutes<0?'-':'+'}${pad(Math.floor(abs/60))}:${pad(abs%60)}`;
}
const ppl=()=>({id:'p',mode:'schedule',workouts:[{id:'push',day:0},{id:'pull',day:1},{id:'legs',day:3},{id:'arms',day:null}]});
const cycle=()=>({id:'p',mode:'simple',workouts:[{id:'a'},{id:'b'},{id:'c'}],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'},{type:'workout',workoutId:'c'}]});

test('weekStart is local Monday 00:00 of the week',()=>{
 for(const now of [at(4),at(2,0),at(8,23,59)])assert.equal(weekStart(now).getTime(),at(2,0).getTime());
});

test('week: nothing logged suggests today or later, never missed days',()=>{
 assert.deepEqual(upNextOccurrence(ppl(),[],at(4)),{occurrenceId:'legs',label:'Thu'});
});
test('week: earlier days logged',()=>{
 assert.equal(upNextOccurrence(ppl(),[logAt('pull',at(3)),logAt('push',at(2))],at(4)).occurrenceId,'legs');
});
test('week: today pending',()=>{
 assert.equal(upNextOccurrence(ppl(),[],at(5)).occurrenceId,'legs');
});
test('week: week done wraps to next Monday',()=>{
 assert.deepEqual(upNextOccurrence(ppl(),[logAt('legs',at(5,8))],at(5)),{occurrenceId:'push',label:'Mon'});
 assert.equal(upNextOccurrence(ppl(),[logAt('legs',at(4,8))],at(4)).occurrenceId,'push');
});
test('week: same-day program order',()=>{
 const program={id:'p',mode:'schedule',workouts:[{id:'push',day:0},{id:'push2',day:0}]};
 assert.equal(upNextOccurrence(program,[logAt('push',at(2,8))],at(2)).occurrenceId,'push2');
});
test('week: Sunday with all logged wraps',()=>{
 const logs=[logAt('legs',at(5)),logAt('pull',at(3)),logAt('push',at(2))];
 assert.equal(upNextOccurrence(ppl(),logs,at(8)).occurrenceId,'push');
});
test("week: last week's log does not count",()=>{
 assert.equal(upNextOccurrence(ppl(),[log('legs',toLocalIso(new Date(2026,9,29,10)))],at(4)).occurrenceId,'legs');
});
test('week: log at exactly Monday 00:00 counts this week',()=>{
 assert.equal(upNextOccurrence(ppl(),[logAt('push',at(2,0))],at(2,9)).occurrenceId,'pull');
});
test('week: unscheduled only is null',()=>{
 assert.equal(upNextOccurrence({id:'p',mode:'schedule',workouts:[{id:'arms',day:null}]},[],at(4)),null);
});
test('empty program is null in both modes',()=>{
 assert.equal(upNextOccurrence({id:'p',mode:'schedule',workouts:[]},[],at(4)),null);
 assert.equal(upNextOccurrence({id:'p',mode:'simple',workouts:[],sequence:[]},[],at(4)),null);
});
test("week: other programs' logs are ignored",()=>{
 assert.equal(upNextOccurrence(ppl(),[logAt('legs',at(4,8),'other')],at(4)).occurrenceId,'legs');
});
test('offset in startedAt counts by absolute time',()=>{
 assert.equal(upNextOccurrence(ppl(),[log('legs',isoWithOffset(at(4,8),14*60))],at(4)).occurrenceId,'push');
});

test('sequence: no logs suggests the first entry',()=>{
 assert.deepEqual(upNextOccurrence(cycle(),[],at(4)),{occurrenceId:'a',label:'Day 1'});
});
test('sequence: next after the last log, skipping rests',()=>{
 assert.deepEqual(upNextOccurrence(cycle(),[logAt('b',at(3))],at(4)),{occurrenceId:'c',label:'Day 3'});
});
test('sequence: wraps to the first entry',()=>{
 assert.equal(upNextOccurrence(cycle(),[logAt('c',at(3))],at(4)).occurrenceId,'a');
});
test('sequence: newest log still in the sequence wins',()=>{
 assert.equal(upNextOccurrence(cycle(),[logAt('x',at(4,8)),logAt('b',at(3))],at(4)).occurrenceId,'c');
});

test('upNextProgram follows the newest program log',()=>{
 const programs=[{id:'y'},{id:'x'}];
 const blank={source:{kind:'blank'},startedAt:toLocalIso(at(4,9))},template={source:{kind:'template',templateId:'t',templateName:''},startedAt:toLocalIso(at(4,8))};
 assert.equal(upNextProgram(programs,[blank,template,logAt('push',at(3),'x'),logAt('push',at(2),'y')]),'x');
 assert.equal(upNextProgram(programs,[logAt('push',at(3),'gone'),logAt('push',at(2),'x')]),'x');
 assert.equal(upNextProgram(programs,[blank]),'y');
 assert.equal(upNextProgram([],[logAt('push',at(3),'x')]),null);
});

test('labels and session order',()=>{
 assert.deepEqual(sessionOrder(ppl()),['push','pull','legs','arms']);
 const labels=occurrenceLabels(ppl());
 assert.deepEqual(labels.get('push'),{short:'Mon',long:'Monday'});
 assert.deepEqual(labels.get('legs'),{short:'Thu',long:'Thursday'});
 assert.deepEqual(labels.get('arms'),{short:'Unscheduled',long:'Unscheduled'});
 assert.deepEqual(sessionOrder(cycle()),['a','b','c']);
 assert.deepEqual(occurrenceLabels(cycle()).get('c'),{short:'Day 3',long:'Day 3'});
 const unordered={mode:'schedule',workouts:[{id:'late',day:5},{id:'loose',day:null},{id:'early',day:1}]};
 assert.deepEqual(sessionOrder(unordered),['early','late','loose']);
});
