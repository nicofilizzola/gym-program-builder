import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MUSCLE_GROUPS,MUSCLE_INFO} from '../src/muscles.js';
import {bodySvg} from '../src/body.js';
import {computeVolume,computeVolumeSplit} from '../src/volume.js';
import {computeProgramVolume} from '../src/program-volume.js';
import {parseDocumentBundle,serializeDocumentBundle} from '../src/document-bundle.js';
import {parseSession,serializeSession} from '../src/session-file.js';
import {prepareAnalysisSnapshot} from '../src/analysis-input.js';

const exercise=(primaryMuscles,secondaryMuscles=[],sets=3)=>({name:'Hip exercise',sets,repRange:{min:8,max:12},restSeconds:90,primaryMuscles,secondaryMuscles});
const template={name:'Lower',exercises:[exercise(['Glutes']),exercise(['Hamstrings'],['Glutes'],4)],goals:{Glutes:6},extraMinutes:5,bufferPercent:10};
test('Glutes has fixed order, info and mirrored back anatomy',()=>{
 assert.equal(MUSCLE_GROUPS.length,13);assert.equal(MUSCLE_GROUPS[MUSCLE_GROUPS.indexOf('Abs')+1],'Glutes');
 assert.ok(MUSCLE_INFO.Glutes.notes);assert.match(bodySvg('back'),/data-muscle="Glutes"/);assert.doesNotMatch(bodySvg('front'),/data-muscle="Glutes"/);
});
test('Glutes counts explicit direct and indirect mappings and repeated occurrences only',()=>{
 assert.deepEqual(computeVolumeSplit(template).Glutes,{direct:3,indirect:2});
 assert.equal(computeProgramVolume({workouts:[{...template,id:'a',day:0},{...template,id:'b',day:null}]}).Glutes,10);
 assert.equal(computeVolume({exercises:[{...exercise(['Hamstrings']),name:'Glute bridge'}]}).Glutes,0);
 assert.deepEqual(prepareAnalysisSnapshot(template).exercises[0].primaryMuscles,['Glutes']);
});
test('Glutes survives legacy and portable file round trips',()=>{
 const legacy={exercises:template.exercises.map(({restSeconds,...ex})=>ex),goals:template.goals};
 assert.deepEqual(parseSession(serializeSession(legacy)).session,legacy);
 for(const version of [2,3]){
  const text=version===3?serializeDocumentBundle({record:{kind:'template',document:template}}):JSON.stringify({version:2,kind:'template',template});
  const parsed=parseDocumentBundle(text);assert.equal(parsed.error,undefined);assert.equal(parsed.bundle.template.goals.Glutes,6);
 }
});
