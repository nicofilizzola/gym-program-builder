import {answerNextConfirmation} from './confirmation-helper.js';
import {test,expect} from '@playwright/test';
import {login,createLinkedTemplate,saveFinishedLog,resetWorkouts,openStartSheet} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('feedback identity and focused recovery survive responsive moves',async({page})=>{
 await login(page);const {id}=await createLinkedTemplate(page,'Feedback');await page.goto('/#/templates/'+id);
 await page.route('**/api/documents/'+id,r=>r.request().method()==='PUT'?r.fulfill({status:503,json:{error:{message:'Save unavailable'}}}):r.continue());
 await page.getByLabel('Session template name',{exact:true}).fill('Keep my name');
 await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');
 await expect(page.locator('.editor-heading [data-testid=save-status]')).toBeVisible();
 await page.evaluate(()=>{window.feedbackNode=document.querySelector('[data-testid=save-status]');window.retryNode=document.querySelector('#retry-save');});
 await page.locator('#retry-save').focus();
 for(const width of [761,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>window.feedbackNode===document.querySelector('[data-testid=save-status]'))).toBe(true);
  await expect(page.locator('#retry-save')).toBeFocused();
  await expect(page.getByLabel('Session template name',{exact:true})).toHaveValue('Keep my name');
 }
});
test('mobile conflict actions wrap in the heading and Home has no feedback',async({page})=>{
 await login(page);const {id}=await createLinkedTemplate(page,'Conflict');await page.goto('/#/templates/'+id);
 await page.route('**/api/documents/'+id,r=>r.request().method()==='PUT'?r.fulfill({status:409,json:{error:{message:'Conflict'}}}):r.continue());
 await page.getByLabel('Session template name',{exact:true}).fill('Local edits');
 await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await expect(page.locator('.editor-heading #reload-saved')).toBeVisible();
 await expect(page.locator('.editor-heading #copy-saved')).toBeVisible();
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.unroute('**/api/documents/'+id);await page.locator('#retry-save').evaluate(el=>el.hidden=true);
 await answerNextConfirmation(page,true);await page.goto('/#/home');await expect(page.getByRole('heading',{name:'Your training',exact:true})).toBeVisible();await expect(page.getByTestId('save-status')).not.toBeVisible();
});
test('finished logger uses shared heading feedback and active logger keeps owned sync status',async({page})=>{
 await login(page);await resetWorkouts(page);
 const {id}=await saveFinishedLog(page,{name:'Finished feedback',startedAt:'2026-11-06T12:00:00Z'});
 await page.goto('/#/workouts/'+id);
 await expect(page.locator('.logger-header [data-testid=save-status]')).toBeVisible();
 await expect(page.locator('.logger-status')).not.toBeVisible();
 await page.goto('/#/home');await openStartSheet(page);
 await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 await expect(page.locator('.logger-status')).toBeVisible();
 await expect(page.getByTestId('save-status')).not.toBeVisible();
 await resetWorkouts(page);
});
