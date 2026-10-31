import {test,expect} from '@playwright/test';
import {programFixture} from './program-analysis-helper.js';
import {answerNextConfirmation} from './confirmation-helper.js';
const bundle=context=>({version:3,kind:'program',templates:[],program:{name:'Imported context',mode:'schedule',goals:{},workouts:[],context}});
const file=data=>({name:'program.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
test('context-only program imports confirm replacement and reject malformed context atomically',async({page})=>{
 const {program}=await programFixture(page,{contextOnly:true});
 expect(program.document.workouts).toEqual([]);expect(program.document.goals).toEqual({});expect(program.document.sequence??[]).toEqual([]);
 await answerNextConfirmation(page,false);await page.locator('[data-file]').setInputFiles(file(bundle({goalsAndPriorities:'Replace me'})));await expect(page.getByRole('dialog',{name:'Replace program?',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Build muscle');await page.keyboard.press('Escape');
 expect((await (await page.request.get('/api/documents/'+program.id)).json()).record.document.context).toEqual(program.document.context);
 await page.locator('[data-file]').setInputFiles(file(bundle({goalsAndPriorities:5})));await expect(page.locator('[data-program-error]')).toContainText('context');
 expect((await (await page.request.get('/api/documents/'+program.id)).json()).record.document.context).toEqual(program.document.context);
 await answerNextConfirmation(page,true);await page.locator('[data-file]').setInputFiles(file(bundle({goalsAndPriorities:'Replace me'})));await expect(page.getByLabel('Program name')).toHaveValue('Imported context');
 await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Replace me');
 const saved=(await (await page.request.get('/api/documents/'+program.id)).json()).record;expect(saved.document.context.goalsAndPriorities).toBe('Replace me');
});
test('program exports retain context and duplicate notes remain independent',async({page})=>{
 const {program}=await programFixture(page,{contextOnly:true});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export program',exact:true}).click();const download=await downloadPromise;
 const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);const exported=JSON.parse(Buffer.concat(chunks).toString());expect(exported.program.context.goalsAndPriorities).toBe('Build muscle');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();await page.getByRole('button',{name:'Duplicate '+program.document.name,exact:true}).click();
 await page.getByRole('link',{name:program.document.name+' 1',exact:true}).click();
 await expect(page.getByLabel('Program name')).toBeVisible();await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Build muscle');await page.getByLabel('Goals and priorities',{exact:true}).fill('Maintain');await page.keyboard.press('Escape');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 const original=(await (await page.request.get('/api/documents/'+program.id)).json()).record;expect(original.document.context.goalsAndPriorities).toBe('Build muscle');
});
test('a context save conflict preserves the draft and Save as copy keeps the original untouched',async({page})=>{
 const {program}=await programFixture(page,{contextOnly:true});await page.getByRole('button',{name:'Program context',exact:true}).click();
 await page.evaluate(async program=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().update({id:program.id,revision:program.revision,document:{...program.document,context:{goalsAndPriorities:'Remote priorities'}}});},program);
 await page.getByLabel('Goals and priorities',{exact:true}).fill('Local priorities');await expect(page.getByTestId('save-status')).toHaveText('Conflict');await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Local priorities');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Save as copy',exact:true}).click();await expect(page).not.toHaveURL('/#/programs/'+program.id);await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Local priorities');
 const original=(await (await page.request.get('/api/documents/'+program.id)).json()).record;expect(original.document.context.goalsAndPriorities).toBe('Remote priorities');
});
