import {test,expect} from '@playwright/test';
async function start(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await expect(page.getByLabel('Session template name')).toBeVisible();}
test('recovery controls are visible only for their matching save state',async({page})=>{
 await start(page);await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeHidden();await expect(page.getByRole('button',{name:'Save as copy',exact:true})).toBeHidden();
 await page.route('**/api/documents/*',route=>route.request().method()==='PUT'?route.fulfill({status:409,contentType:'application/json',body:'{"error":{"code":"CONFLICT","message":"Newer"}}'}):route.continue());
 await page.getByLabel('Session template name').fill('Conflict edit');await expect(page.getByTestId('save-status')).toHaveText('Conflict');await page.getByLabel('Session template name').fill('Still recoverable');await expect(page.getByRole('button',{name:'Reload saved version',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeHidden();
});
test('late file reads cannot overwrite the document opened after import started',async({page})=>{
 await start(page);const first=page.url();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await page.getByLabel('Session template name').fill('Target stays');await expect(page.getByTestId('save-status')).toHaveText('Saved');const second=page.url();
 await page.goto(first);await expect(page.getByLabel('Session template name')).toBeVisible();
 await page.evaluate(()=>{window.originalFileText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.releaseImport=()=>resolve('{"version":2,"kind":"template","template":{"name":"Wrong import","exercises":[],"goals":{}}}');});};});
 await page.locator('#import-file').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await page.evaluate(hash=>{location.hash=hash;},new URL(second).hash);await expect(page.getByLabel('Session template name')).toHaveValue('Target stays');await page.evaluate(()=>window.releaseImport());await page.waitForTimeout(700);await page.reload();await expect(page.getByLabel('Session template name')).toHaveValue('Target stays');
});
test('navigation locks the old editor before a delayed document load',async({page})=>{
 await start(page);const original=page.url();const created=await page.request.post('/api/documents',{headers:{origin:'http://127.0.0.1:3199'},data:{id:crypto.randomUUID(),kind:'template',document:{name:'Next document',exercises:[],goals:{}}}});const next=(await created.json()).record;
 let release;const held=new Promise(resolve=>{release=resolve;});await page.route(`**/api/documents/${next.id}`,async route=>{await held;await route.continue();});
 await page.evaluate(hash=>{location.hash=hash;},`#/templates/${next.id}`);
 await expect(page.getByLabel('Session template name')).toBeVisible();await expect.poll(()=>page.locator('#app').evaluate(el=>el.inert)).toBe(true);release();await expect(page.getByLabel('Session template name')).toHaveValue('Next document');await page.goto(original);await expect(page.getByLabel('Session template name')).toHaveValue('Untitled template');
});
test('creation retry reuses its ID after the server commits but the response is lost',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.getByRole('heading',{name:'Session templates',exact:true})).toBeVisible();
 let firstId,attempt=0;await page.route('**/api/documents',async route=>{if(route.request().method()!=='POST')return route.continue();attempt++;const body=route.request().postDataJSON();if(!firstId)firstId=body.id;else expect(body.id).toBe(firstId);const response=await route.fetch();if(attempt===1)return route.abort('failed');return route.fulfill({response});});
 await page.getByRole('button',{name:'New session template',exact:true}).click();await page.getByRole('button',{name:'Retry creation',exact:true}).click();await expect(page.getByLabel('Session template name')).toBeVisible();const list=await page.request.get('/api/documents?kind=template');expect((await list.json()).records.filter(r=>r.id===firstId)).toHaveLength(1);expect(attempt).toBe(2);
});
test('browser back during a delayed load opens the newest requested route',async({page})=>{
 await start(page);const first=new URL(page.url()).hash;
 const created=await page.request.post('/api/documents',{headers:{origin:'http://127.0.0.1:3199'},data:{id:crypto.randomUUID(),kind:'template',document:{name:'Delayed destination',exercises:[],goals:{}}}});const next=(await created.json()).record;
 let release;const held=new Promise(resolve=>{release=resolve;});await page.route(`**/api/documents/${next.id}`,async route=>{await held;await route.continue();});
 await page.evaluate(hash=>{location.hash=hash;},`#/templates/${next.id}`);await expect(page.getByLabel('Session template name')).toBeVisible();await expect.poll(()=>page.locator('#app').evaluate(el=>el.inert)).toBe(true);await page.evaluate(()=>history.back());release();await expect(page.getByLabel('Session template name')).toHaveValue('Untitled template');expect(new URL(page.url()).hash).toBe(first);
});
