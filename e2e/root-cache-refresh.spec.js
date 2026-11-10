import {test,expect} from '@playwright/test';
import {login,headers,resetWorkouts} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const nav=(page,name)=>page.getByRole('navigation',{name:'Main'}).getByRole('link',{name,exact:true});
test('cached rows remain usable during a held refresh and changed rows preserve focus',async({page})=>{
 await login(page);
 const id=crypto.randomUUID(),name='Cached '+id.slice(0,6);
 await page.request.post('/api/documents',{headers,data:{id,kind:'program',document:{name,mode:'schedule',goals:{},workouts:[]}}});
 await nav(page,'Library').click();await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
 await nav(page,'User').click();let release;const held=new Promise(r=>release=r);
 await page.route('**/api/documents?kind=program',async route=>{await held;await route.fulfill({json:{records:[{id,revision:2,name:name+' refreshed'}]}});});
 try{
  await nav(page,'Library').click();await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Export '+name,exact:true}).focus();release();
  await expect(page.getByRole('link',{name:name+' refreshed',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Export '+name+' refreshed',exact:true})).toBeFocused();
 }finally{release();}
});
test('auth expiry during Catalog refresh closes its draft before showing sign-in',async({page})=>{
 await login(page);await nav(page,'Library').click();await page.getByRole('link',{name:'Exercises',exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'Search catalog'})).toBeVisible();
 await nav(page,'User').click();let release;const held=new Promise(r=>release=r);
 await page.route('**/api/catalog',async route=>{await held;await route.fulfill({status:401,json:{error:{message:'Sign in'}}});});
 try{
  await nav(page,'Library').click();await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
  await page.getByRole('textbox',{name:'Reference exercise name',exact:true}).fill('Draft');
  release();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }finally{release();}
});
test('refresh failure retains cached rows and Retry can publish a successful empty',async({page})=>{
 await login(page);await nav(page,'Library').click();await expect(page.locator('.library')).toBeVisible();
 await nav(page,'User').click();
 await page.route('**/api/documents?kind=program',route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));
 await nav(page,'Library').click();
 await expect(page.getByText("Couldn't refresh. Showing previously loaded data.",{exact:true})).toBeVisible();
 await page.unroute('**/api/documents?kind=program');
 await page.route('**/api/documents?kind=program',route=>route.fulfill({json:{records:[]}}));
 await page.locator('.root-page-feedback').getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.library-item')).toHaveCount(0);
 await expect(page.locator('[data-empty]')).toContainText('No programs yet');
});

test('outgoing Catalog refresh waits while a finger is dragging and applies on cancellation',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await login(page);await nav(page,'Library').click();await page.getByRole('link',{name:'Exercises',exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'Search catalog'})).toBeVisible();
 const data=await (await page.request.get('/api/catalog')).json();data.families[0].name+=' refreshed';
 await nav(page,'User').click();let release;const held=new Promise(r=>release=r);
 await page.route('**/api/catalog',async route=>{await held;await route.fulfill({json:data});});
 const client=await page.context().newCDPSession(page);
 try{
  await nav(page,'Library').click();await expect(page.getByRole('searchbox',{name:'Search catalog'})).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  const x=330,y=await page.evaluate(x=>{for(let y=100;y<700;y+=12){const el=document.elementFromPoint(x,y);if(el?.closest('#app')&&!el.closest('a,button,input,textarea,select'))return y;}throw Error('No neutral point');},x);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:230,y:y+2}]});
  await expect(page.locator('#mobile-page-stage')).toBeVisible();
  await page.evaluate(()=>{window.dragMutations=0;window.dragObserver=new MutationObserver(records=>window.dragMutations+=records.length);window.dragObserver.observe(document.querySelector('#app .catalog-list'),{childList:true,subtree:true});});
  release();await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.dragMutations)).toBe(0);
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('#mobile-page-stage')).toBeHidden();
  await expect(page.locator('#app .reference-name').filter({hasText:data.families[0].name})).toHaveCount(1);
 }finally{release();await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});await client.detach();}
});

test('cold loading heading keeps the page gutter and lines up with the loaded heading',async({page})=>{
 await login(page);let release;const held=new Promise(r=>release=r);
 await page.route('**/api/documents?kind=program',async route=>{await held;await route.continue().catch(()=>{});});
 try{
  await nav(page,'Library').click();await expect(page.locator('[data-root-state]')).toHaveAttribute('data-root-state','loading');
  const loading=await page.getByRole('heading',{name:'Programs',exact:true}).boundingBox();
  release();await expect(page.locator('section.library .library-heading h1')).toBeVisible();
  const loaded=await page.locator('section.library .library-heading h1').boundingBox();
  expect(loading.x).toBeGreaterThanOrEqual(12);
  expect(Math.abs(loading.x-loaded.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(loading.y-loaded.y)).toBeLessThanOrEqual(2);
 }finally{release();}
});

async function expectFeedbackAboveBars(page){
 const feedback=page.locator('.root-page-feedback');
 await expect(feedback.getByText("Couldn't refresh. Showing previously loaded data.",{exact:true})).toBeVisible();
 const box=await feedback.boundingBox(),nav=await page.getByRole('navigation',{name:'Main'}).boundingBox();
 const bar=page.getByRole('region',{name:'Active workout'}),barBox=await bar.isVisible()?await bar.boundingBox():null;
 expect(box.y).toBeGreaterThanOrEqual(0);
 expect(box.y+box.height).toBeLessThanOrEqual((barBox??nav).y+0.5);
 const retry=await feedback.getByRole('button',{name:'Retry',exact:true}).boundingBox();
 expect(retry.height).toBeGreaterThanOrEqual(44);
}
test('refresh failure on a long list stays in view above the tab bar and the active workout bar',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#app h1').first()).toBeVisible();
 for(let i=0;i<10;i++)await page.request.post('/api/documents',{headers,data:{id:crypto.randomUUID(),kind:'program',document:{name:'Long list '+i,mode:'schedule',goals:{},workouts:[]}}});
 await nav(page,'Library').click();await expect(page.locator('.library-item').nth(9)).toBeVisible();
 await nav(page,'User').click();
 await page.route('**/api/documents?kind=program',route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));
 await nav(page,'Library').click();await expectFeedbackAboveBars(page);
 await page.unroute('**/api/documents?kind=program');
 await nav(page,'History').click();await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Blank workout',exact:true}).click();
 await expect(page.locator('.logger-title')).toBeVisible();
 await nav(page,'Library').click();await expect(page.getByRole('region',{name:'Active workout'})).toBeVisible();
 await nav(page,'User').click();
 await page.route('**/api/documents?kind=program',route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));
 await nav(page,'Library').click();await expectFeedbackAboveBars(page);
 await resetWorkouts(page);
});

test('cold Catalog loading heading matches the loaded Catalog heading',async({page})=>{
 await login(page);let release;const held=new Promise(r=>release=r);
 await page.route('**/api/catalog',async route=>{await held;await route.continue().catch(()=>{});});
 try{
  await nav(page,'Library').click();await page.getByRole('link',{name:'Exercises',exact:true}).click();
  await expect(page.locator('[data-root-state]')).toHaveAttribute('data-root-state','loading');
  const loading=await page.locator('.root-page-placeholder h1').boundingBox();
  release();await expect(page.locator('.catalog-page .catalog-header h1')).toBeVisible();
  const loaded=await page.locator('.catalog-page .catalog-header h1').boundingBox();
  expect(Math.abs(loading.x-loaded.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(loading.height-loaded.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(loading.y-loaded.y)).toBeLessThanOrEqual(1);
 }finally{release();}
});
