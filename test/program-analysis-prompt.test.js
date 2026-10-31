import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareProgramAnalysisSnapshot} from '../src/program-analysis-input.js';
import {computeProgramAnalysisFacts,buildProgramAnalysisMessages} from '../server/program-analysis-prompt.js';
import {MUSCLE_GROUPS} from '../src/muscles.js';
import {programAnalysisFixtures as fixtures} from './fixtures/analysis-programs.js';
test('server facts count repeated and Unscheduled sessions and preserve timing assumptions',()=>{
 const snapshot=prepareProgramAnalysisSnapshot(fixtures['repeated-template']),facts=computeProgramAnalysisFacts(snapshot);
 assert.equal(facts.volume.Chest.direct,6);assert.equal(facts.volume.Triceps.indirect,3);assert.equal(facts.volume.Glutes.direct,3);
 assert.equal(facts.occurrenceCounts.Chest,2);assert.equal(facts.sessions.length,3);assert.equal(facts.unscheduledCount,1);assert.deepEqual(facts.scheduledDays,[0,4]);
 assert.deepEqual(Object.keys(facts.volume),MUSCLE_GROUPS);
 assert.deepEqual(facts.sessions[0].duration,{executionSeconds:180,restSeconds:360,extraSeconds:300,bufferSeconds:84,totalSeconds:924,displayMinutes:16});
});
test('scheduled days count unique weekdays while Sequence retains unknown cadence',()=>{
 const p=structuredClone(fixtures['repeated-template']);p.workouts[1].day=0;p.workouts[2].day=6;
 assert.deepEqual(computeProgramAnalysisFacts(prepareProgramAnalysisSnapshot(p)).scheduledDays,[0,6]);
 const seq=prepareProgramAnalysisSnapshot(fixtures['sequence-unknown-cadence']);assert.equal(computeProgramAnalysisFacts(seq).sessions.length,3);
 const messages=buildProgramAnalysisMessages(seq),data=JSON.parse(messages[1].content);
 assert.equal(data.program.mode,'simple');assert.equal(data.program.sequence[1].type,'rest');assert.equal(data.facts.volume.Chest.total,6);
});
test('program prompt has grounded review boundaries and supplies context separately as untrusted data',()=>{
 const s=prepareProgramAnalysisSnapshot(fixtures['malicious-text']),messages=buildProgramAnalysisMessages(s);
 assert.equal(messages[0].role,'system');assert.equal(messages[1].role,'user');
 assert.equal(JSON.parse(messages[1].content).program.context.goalsAndPriorities,s.context.goalsAndPriorities);
 for(const phrase of ['untrusted','Assessment','Strengths','Improvements','Limits','550','smallest','shared','Sequence','Sunday','self-report'])assert.ok(messages[0].content.includes(phrase),phrase);
});
