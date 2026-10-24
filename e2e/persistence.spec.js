import {test,expect} from '@playwright/test';
async function login(page){await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
test('two devices detect stale writes and preserve local data as an independent copy',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();const p=await a.newPage(),q=await b.newPage();
 try{
  await p.goto('/');await login(p);await p.getByRole('link',{name:'Session templates',exact:true}).click();await p.getByRole('button',{name:'New session template',exact:true}).click();await p.getByLabel('Session template name').fill('Shared initial');await expect(p.getByTestId('save-status')).toHaveText('Saved');
  await q.goto(p.url());await login(q);await expect(q.getByLabel('Session template name')).toHaveValue('Shared initial');
  await p.getByLabel('Session template name').fill('Device A');await expect(p.getByTestId('save-status')).toHaveText('Saved');
  await q.getByLabel('Session template name').fill('Device B unsaved');await expect(q.getByTestId('save-status')).toHaveText('Conflict');await expect(q.getByLabel('Session template name')).toHaveValue('Device B unsaved');
  await q.getByRole('button',{name:'Save as copy',exact:true}).click();await expect(q.getByTestId('save-status')).toHaveText('Saved');await expect(q.getByLabel('Session template name')).toHaveValue('Device B unsaved');expect(q.url()).not.toBe(p.url());
  await p.reload();await expect(p.getByLabel('Session template name')).toHaveValue('Device A');
 }finally{await a.close();await b.close();}
});
test('failed saves retry and expired login retains the draft',async({page})=>{
 await page.goto('/');await login(page);await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.route('**/api/documents/*',async route=>{if(route.request().method()==='PUT'){await route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"UNAVAILABLE","message":"Temporarily unavailable"}}'});}else await route.continue();});
 await page.getByLabel('Session template name').fill('Keep draft');await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');await expect(page.getByLabel('Session template name')).toHaveValue('Keep draft');
 await page.unroute('**/api/documents/*');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.request.post('/api/auth/logout',{headers:{origin:'http://127.0.0.1:3199'},data:{}});
 await page.getByLabel('Session template name').fill('After expiry');await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await login(page);await expect(page.getByLabel('Session template name')).toHaveValue('After expiry');await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();await expect(page.getByLabel('Session template name')).toHaveValue('After expiry');
});
test('mobile schedule controls and template name do not overflow narrow screens',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('/');await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByRole('button',{name:'Add empty workout',exact:true}).click();await page.getByRole('radio',{name:'Monday–Sunday',exact:true}).check();await expect(page.getByLabel('Day for Untitled workout')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
