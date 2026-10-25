import {test,expect} from '@playwright/test';
async function start(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await expect(page.getByLabel('Session template name')).toBeVisible();}

test('timing survives failed saves and copies while reload adopts saved timing',async({page})=>{
 test.setTimeout(60000);await start(page);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByLabel('Exercise name',{exact:true}).fill('Curl');
 await page.locator('.primary').getByRole('checkbox',{name:'Biceps',exact:true}).check();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.route('**/api/documents/*',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"UNAVAILABLE","message":"Retry"}}'}):route.continue());
 await page.getByRole('slider',{name:'Rest per set',exact:true}).fill('45');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await page.getByRole('slider',{name:'Extra time',exact:true}).fill('15');
 await page.getByRole('slider',{name:'Buffer',exact:true}).fill('25');
 await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');
 await page.unroute('**/api/documents/*');await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toHaveValue('15');
 await expect(page.getByRole('slider',{name:'Buffer',exact:true})).toHaveValue('25');
 async function externalRest(restSeconds) {
  const id=page.url().split('/').at(-1),record=(await (await page.request.get('/api/documents/'+id)).json()).record;
  const document={...record.document,exercises:record.document.exercises.map(e=>({...e,restSeconds}))};
  const result=await page.request.put('/api/documents/'+id,{headers:{origin:'http://127.0.0.1:3199'},data:{revision:record.revision,document}});
  expect(result.ok()).toBeTruthy();
 }
 await externalRest(90);
 await page.getByRole('slider',{name:'Rest per set',exact:true}).fill('60');
 await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await page.getByRole('button',{name:'Save as copy',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('60');
 await externalRest(30);
 await page.getByRole('slider',{name:'Rest per set',exact:true}).fill('120');
 await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Reload saved version',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('30');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toHaveValue('15');
 await expect(page.getByRole('slider',{name:'Buffer',exact:true})).toHaveValue('25');
});
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
