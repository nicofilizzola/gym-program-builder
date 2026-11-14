import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,openStartSheet} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('History and its picker open without lists; Blank stays available',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#app h1').first()).toBeVisible();let release;const held=new Promise(r=>release=r);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true}).click();
 for(const pattern of ['**/api/documents?kind=program','**/api/documents?kind=template','**/api/settings'])await page.route(pattern,async route=>{await held;await route.continue().catch(()=>{});});
 try{
  await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Home',exact:true}).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  await openStartSheet(page);
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Loading programs...',{exact:true})).toBeVisible();
  await dialog.getByRole('searchbox',{name:'Search sessions'}).fill('keep query');
  release();await expect(dialog.getByText('Loading programs...',{exact:true})).toBeHidden();
  await expect(dialog.getByRole('searchbox',{name:'Search sessions'})).toHaveValue('keep query');
  await expect(dialog.getByRole('searchbox',{name:'Search sessions'})).toBeFocused();
  await dialog.getByRole('button',{name:'Blank workout',exact:true}).click();
  await expect(page.locator('.logger-title')).toBeVisible();
 }finally{release();await resetWorkouts(page);}
});
test('lists received during a failed template load are replayed when the picker unlocks',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#app h1').first()).toBeVisible();const name='Delayed template '+crypto.randomUUID().slice(0,6),{id}=await createLinkedTemplate(page,name);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true}).click();
 let releasePrograms,releaseTemplate,seenTemplate;
 const programs=new Promise(r=>releasePrograms=r),template=new Promise(r=>releaseTemplate=r),requested=new Promise(r=>seenTemplate=r);
 await page.route('**/api/documents?kind=program',async route=>{await programs;await route.fulfill({json:{records:[]}});});
 await page.route('**/api/documents/'+id,async route=>{seenTemplate();await template;await route.fulfill({status:503,json:{error:{message:'Template unavailable'}}});});
 try{
  await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Home',exact:true}).click();
  await openStartSheet(page);const dialog=page.getByRole('dialog');
  await dialog.getByRole('tab',{name:'Template',exact:true}).click();
  await dialog.getByRole('button',{name:'Start '+name,exact:true}).click();await requested;
  const arrived=page.waitForResponse(response=>response.url().includes('/api/documents?kind=program'));releasePrograms();await arrived;await page.waitForTimeout(50);
  releaseTemplate();await expect(dialog.getByRole('tab',{name:'Program',exact:true})).toBeEnabled();
  await dialog.getByRole('tab',{name:'Program',exact:true}).click();
  await expect(dialog.getByText('No programs yet.',{exact:false})).toBeVisible();
 }finally{releasePrograms();releaseTemplate();}
});
test('Blank starts while lists are still held and unknown history never suggests Up next',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#app h1').first()).toBeVisible();let release;const held=new Promise(r=>release=r);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true}).click();
 for(const pattern of ['**/api/documents?kind=program','**/api/documents?kind=template','**/api/settings','**/api/workouts'])await page.route(pattern,async route=>{await held;await route.continue().catch(()=>{});});
 try{
  await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Home',exact:true}).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  await openStartSheet(page);
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('.start-sheet-up-next')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Blank workout',exact:true}).click();
  await expect(page.locator('.logger-title')).toBeVisible();
 }finally{release();await resetWorkouts(page);}
});
