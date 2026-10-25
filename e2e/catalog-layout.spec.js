import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const directory='.superpowers/sdd/2026-10-25-exercise-catalog/screens';
async function populated(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('link',{name:'Exercise catalog',exact:true})).toBeVisible();
 const id=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),{entries}=await api.catalog();
  const names=['Barbell bench press','Pull-up','Dumbbell lateral raise','Leg press'];
  const exercises=names.map(name=>{const e=entries.find(e=>e.name===name);return {name:e.name,sets:4,repRange:{min:8,max:12},primaryMuscles:e.primaryMuscles,secondaryMuscles:e.secondaryMuscles,catalogId:e.id,catalogRevision:e.revision,familyId:e.familyId,equipment:e.equipment};});
  return (await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Upper and lower strength',exercises,goals:{Chest:6,Lats:6,Quads:6}}})).id;
 });await page.goto('/#/templates/'+id);await page.getByRole('button',{name:'Expand all',exact:true}).click();await page.evaluate(()=>document.fonts.ready);
}
for(const size of [{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080},{width:768,height:1024},{width:390,height:844}]){
 test('populated catalog picker and form fit '+size.width,async({page})=>{
  await page.setViewportSize(size);await mkdir(directory,{recursive:true});await populated(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await expect(page.locator('.exercise-menu').first()).toBeHidden();
  if(size.width>=1100)for(const body of await page.locator('#body-map svg').all()){const box=await body.boundingBox();expect(box.height).toBeGreaterThanOrEqual(180);}
  await page.screenshot({path:directory+'/editor-'+size.width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Exercise actions',exact:true}).first().click();await page.getByRole('button',{name:'Replace exercise',exact:true}).click();
  const input=page.getByRole('combobox',{name:'Exercise',exact:true});await input.fill('press');
  await expect(page.getByRole('listbox',{name:'Exercise suggestions'})).toBeVisible();
  const popup=page.locator('.exercise-options:popover-open');const box=await popup.boundingBox();expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(size.width-7);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
  const controls=await page.locator('.exercise-picker').first().boundingBox();expect(box.y>=controls.y+controls.height||box.y+box.height<=controls.y).toBe(true);
  await page.screenshot({path:directory+'/picker-'+size.width+'.png'});
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Exercise actions',exact:true}).first().click();await page.getByRole('button',{name:'Create variant',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).scrollIntoViewIfNeeded();
  const colors=await page.getByRole('dialog').getByRole('group',{name:'Primary muscles',exact:true}).evaluate(group=>({selected:getComputedStyle(group.querySelector('input:checked+span')).backgroundColor,unselected:getComputedStyle(group.querySelector('input:not(:checked)+span')).backgroundColor}));
  expect(colors.selected).not.toBe(colors.unselected);
  expect((await page.getByRole('dialog').getByLabel('Exercise name',{exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(size.width>=1100?32:44);
  await page.screenshot({path:directory+'/form-'+size.width+'.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 });
}
test('hybrid input and enlarged text preserve catalog controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 try{
  await populated(page);await page.addStyleTag({content:'html {font-size:200%}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  const action=page.getByRole('button',{name:'Exercise actions',exact:true}).first();expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await action.click();await page.getByRole('button',{name:'Create variant',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Save variant',exact:true}).scrollIntoViewIfNeeded();
  const button=await dialog.getByRole('button',{name:'Save variant',exact:true}).boundingBox();expect(button.height).toBeGreaterThanOrEqual(44);expect(button.y+button.height).toBeLessThanOrEqual(768);
  await page.screenshot({path:directory+'/hybrid-text-200.png',fullPage:true});
 }finally{await context.close();}
});
