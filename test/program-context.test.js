import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgramContext,normalizeContextText,hasProgramContext,PROGRAM_CONTEXT_FIELDS} from '../src/program-context.js';
import {validateDocument} from '../src/document-validation.js';
import {serializeDocumentBundle,parseDocumentBundle} from '../src/document-bundle.js';
import {duplicateProgram} from '../src/program.js';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createDocumentCommands} from '../server/document-commands.js';

const empty={goalsAndPriorities:'',constraintsAndPreferences:''};
const context={...empty,goalsAndPriorities:'Grow delts',constraintsAndPreferences:'60 minutes'};
const program={name:'Week',mode:'schedule',goals:{},workouts:[],context};

test('context normalizes missing fields and line endings without changing meaningful prose',()=>{
 assert.deepEqual(normalizeProgramContext(),empty);
 const source={goalsAndPriorities:'  a\r\nb\rc  ',constraintsAndPreferences:' \n '};
 assert.deepEqual(normalizeProgramContext(source),{...empty,goalsAndPriorities:'  a\nb\nc  '});
 assert.equal(source.goalsAndPriorities,'  a\r\nb\rc  ');
 assert.equal(hasProgramContext({context:{goalsAndPriorities:' \n '}}),false);
 assert.equal(hasProgramContext(program),true);
});
test('context rejects invalid types and excessive UTF-16 length without truncation',()=>{
 for(const value of [null,[],3,'notes',{goalsAndPriorities:null},{constraintsAndPreferences:3}])assert.throws(()=>normalizeProgramContext(value));
 assert.equal(normalizeProgramContext({goalsAndPriorities:'💪'.repeat(1000)}).goalsAndPriorities.length,2000);
 assert.throws(()=>normalizeProgramContext({goalsAndPriorities:'💪'.repeat(1001)}),/2,?000/);
 assert.equal(normalizeProgramContext({goalsAndPriorities:'\r\n'.repeat(1000)+'a'}).goalsAndPriorities.length,1001);
});
test('program validation preserves context in drafts and exports and omits empty defaults',()=>{
 for(const draft of [true,false])assert.deepEqual(validateDocument('program',program,{draft}).document.context,context);
 const old={...program};delete old.context;
 assert.equal(Object.hasOwn(validateDocument('program',old).document,'context'),false);
 assert.equal(Object.hasOwn(validateDocument('program',{...old,context:empty}).document,'context'),false);
 assert.match(validateDocument('program',{...program,context:{goalsAndPriorities:false}}).error,/context|priorities/i);
});
test('portable program context round trips and copies remain independent',()=>{
 const text=serializeDocumentBundle({record:{kind:'program',document:program}});
 assert.deepEqual(parseDocumentBundle(text).bundle.program.context,context);
 const copy=duplicateProgram(program,()=> 'new');copy.context.goalsAndPriorities='Maintain';
 assert.equal(program.context.goalsAndPriorities,'Grow delts');
 const bad=JSON.parse(text);bad.program.context.goalsAndPriorities='x'.repeat(2001);
 assert.match(parseDocumentBundle(JSON.stringify(bad)).error,/2,?000/);
});
test('revisioned saves and atomic imports retain context without backfilling old documents',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const repository=createRepository(db),commands=createDocumentCommands(db);
 const saved=await repository.create({id:'p',kind:'program',document:program});
 assert.deepEqual((await repository.get('p')).document.context,context);
 await repository.update({id:'p',revision:saved.revision,document:{...program,context:{...context,goalsAndPriorities:'Maintain'}}});
 await assert.rejects(repository.update({id:'p',revision:saved.revision,document:program}),{code:'CONFLICT'});
 assert.equal((await repository.get('p')).document.context.goalsAndPriorities,'Maintain');
 const bundle=JSON.parse(serializeDocumentBundle({record:{kind:'program',document:program}}));
 const imported=await commands.importDocument({operationId:'import',bundle});
 assert.deepEqual(imported.record.document.context,context);
 bundle.program.context.goalsAndPriorities=4;
 await assert.rejects(commands.importDocument({operationId:'bad',bundle}),{code:'INVALID'});
 assert.equal((await repository.list('program')).length,2);
 const old={...program};delete old.context;
 const record=await repository.create({id:'old',kind:'program',document:old});
 assert.equal((await repository.get('old')).revision,record.revision);
 assert.equal(Object.hasOwn((await repository.get('old')).document,'context'),false);
 const attached=await commands.createAndAttach({operationId:'attach',programId:'p',revision:2,templateId:'t',occurrenceId:'o',template:{name:'Empty',exercises:[],goals:{}}});
 assert.equal(attached.record.document.context.goalsAndPriorities,'Maintain');
});

test('training background is no longer program context: legacy values are dropped everywhere',async t=>{
 assert.deepEqual(PROGRAM_CONTEXT_FIELDS,['goalsAndPriorities','constraintsAndPreferences']);
 assert.equal(normalizeContextText(' a\r\n','goalsAndPriorities'),' a\n');assert.equal(normalizeContextText(' \n','goalsAndPriorities'),'');
 assert.throws(()=>normalizeContextText(3,'goalsAndPriorities'),/^Error: Invalid program context goalsAndPriorities\.$/);
 assert.throws(()=>normalizeContextText('x'.repeat(2001),'goalsAndPriorities'),/^Error: Program context fields must be at most 2,000 characters\.$/);
 const legacy={trainingBackgroundAndApproach:'Five years'};
 assert.deepEqual(normalizeProgramContext(legacy),empty);
 assert.equal(hasProgramContext({context:legacy}),false);
 assert.equal(Object.hasOwn(validateDocument('program',{...program,context:legacy}).document,'context'),false);
 assert.deepEqual(validateDocument('program',{...program,context:{...context,trainingBackgroundAndApproach:'Five years'}}).document.context,context);
 const bundle=JSON.parse(serializeDocumentBundle({record:{kind:'program',document:program}}));bundle.program.context=legacy;
 const parsed=parseDocumentBundle(JSON.stringify(bundle));assert.equal(parsed.error,undefined);assert.equal(Object.hasOwn(parsed.bundle.program,'context'),false);
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const imported=await createDocumentCommands(db).importDocument({operationId:'legacy',bundle});
 assert.equal(Object.hasOwn(imported.record.document,'context'),false);assert.equal(JSON.stringify(imported.record.document).includes('Five years'),false);
});
