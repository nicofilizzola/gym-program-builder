import {test,expect} from '@playwright/test';
import {programFixture,frames,report} from './program-analysis-helper.js';
test('whole-program analysis includes current context, reuses its report and marks changed inputs',async({page})=>{
 let calls=0,sent;await page.route('**/api/analysis/program',route=>{calls++;sent=route.request().postDataJSON();return route.fulfill({contentType:'text/event-stream',body:frames(report)});});
 await programFixture(page);await page.getByRole('button',{name:'Program context',exact:true}).click();await page.getByLabel('Goals and priorities',{exact:true}).fill('Prioritize delts');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Analyze program',exact:true}).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 expect(sent.snapshot.context.goalsAndPriorities).toBe('Prioritize delts');expect(sent.snapshot.workouts).toHaveLength(2);expect(sent.snapshot.templates).toHaveLength(1);expect(calls).toBe(1);
 await expect(page.locator('.analysis-report h3')).toHaveText(['Assessment','Strengths','Improvements','Limits']);
 await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);await page.getByLabel('Goals and priorities',{exact:true}).fill('Maintain');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'View analysis',exact:true}).click();await expect(page.locator('.analysis-stale')).toBeVisible();expect(calls).toBe(1);
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await expect(page.locator('.analysis-stale')).toBeHidden();expect(calls).toBe(2);
});
test('invalid sessions block provider access and link to the actual occurrence editor',async({page})=>{
 let calls=0;await page.route('**/api/analysis/program',route=>{calls++;return route.abort();});const {program}=await programFixture(page,{emptySession:true});
 await page.getByRole('button',{name:'Analyze program',exact:true}).click();const link=page.locator('[data-program-error] a');await expect(link).toHaveAttribute('href',`#/programs/${program.id}/workouts/first`);expect(calls).toBe(0);
 await link.click();await expect(page).toHaveURL(/workouts\/first/);await expect(page.getByLabel('Session template name')).toHaveValue('Upper');
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();await expect(page.getByRole('button',{name:'Analyze program',exact:true})).toBeVisible();
});
test('template refresh and save acknowledgements preserve focused context and existing analysis nodes',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));const {program,template}=await programFixture(page);
 await page.getByRole('button',{name:'Analyze program',exact:true}).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 await page.evaluate(()=>window.originalReport=document.querySelector('.analysis-report'));
 await page.getByRole('button',{name:'Program context',exact:true}).click();const field=page.getByLabel('Goals and priorities',{exact:true});
 let release;const gate=new Promise(resolve=>release=resolve);let saving=false;
 await page.route('**/api/documents/'+program.id,async route=>{if(route.request().method()==='PUT'){saving=true;await gate;}await route.continue();});
 await field.fill('Unsaved local priorities');await field.evaluate(el=>{window.originalContextField=el;el.setSelectionRange(7,7);});await expect.poll(()=>saving).toBe(true);
 await page.evaluate(async template=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().update({id:template.id,revision:template.revision,document:{...template.document,name:'Updated shared'}});},template);
 release();await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.workout-item h3')).toHaveText(['Updated shared','Updated shared']);
 expect(await field.evaluate(el=>el===window.originalContextField&&el.selectionStart===7)).toBe(true);await expect(field).toBeFocused();await expect(field).toHaveValue('Unsaved local priorities');
 expect(await page.evaluate(()=>window.originalReport===document.querySelector('.analysis-report'))).toBe(true);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'View analysis',exact:true}).click();await expect(page.locator('.analysis-stale')).toBeVisible();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Empty workout',exact:true}).click();await expect(page.locator('.workout-item')).toHaveCount(3);expect(await page.evaluate(()=>window.originalReport===document.querySelector('.analysis-report'))).toBe(true);
});
test('disabled analysis still allows saved program context',async({page})=>{
 await page.route('**/api/analysis',route=>route.fulfill({json:{enabled:false}}));await programFixture(page);await expect(page.getByRole('button',{name:'Analyze program',exact:true})).toHaveAttribute('aria-disabled','true');
 await page.getByRole('button',{name:'Program context',exact:true}).click();await page.getByLabel('Constraints and preferences',{exact:true}).fill('45 minutes');await page.keyboard.press('Escape');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();await page.getByRole('button',{name:'Program context',exact:true}).click();await expect(page.getByLabel('Constraints and preferences',{exact:true})).toHaveValue('45 minutes');
});
