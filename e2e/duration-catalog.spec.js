import {test,expect} from '@playwright/test';
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();}
async function select(page,name){const input=page.getByRole('combobox',{name:'Exercise',exact:true}).last();await input.fill(name);await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toBeVisible();await input.press('ArrowDown');await input.press('Enter');}
test('reference defaults initialize once and replacement, linking and later edits preserve overrides',async({page})=>{
 await login(page);
 const suffix=crypto.randomUUID(),headers={origin:'http://127.0.0.1:3199'},refs=[];
 for(const [type,label,muscle] of [['compound','Press','Chest'],['isolation','Curl','Biceps']]) {
  const ref={equipment:'Barbell',id:crypto.randomUUID(),name:label+' '+suffix,exerciseType:type};
  const r=await page.request.post('/api/catalog/references',{headers,data:ref});expect(r.ok()).toBeTruthy();
  const entry={name:label+' '+suffix,equipment:'Barbell',primaryMuscles:[muscle],secondaryMuscles:[]};
  const created=await page.request.post('/api/catalog',{headers,data:{id:crypto.randomUUID(),familyId:ref.id,entry}});
  expect(created.ok()).toBeTruthy();refs.push({...ref,entry:(await created.json()).entry});
 }
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await select(page,refs[0].entry.name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('180');
 await page.getByRole('slider',{name:'Rest per set',exact:true}).fill('45');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 const current=(await (await page.request.get('/api/catalog/references/'+refs[0].id)).json()).reference;
 const updated=await page.request.put('/api/catalog/references/'+current.id,{headers,data:{revision:current.revision,name:current.name,exerciseType:'isolation'}});expect(updated.ok()).toBeTruthy();
 await page.reload();await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'Replace exercise',exact:true}).click();
 page.once('dialog',d=>d.accept());await select(page,refs[1].entry.name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await select(page,refs[1].entry.name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true}).last()).toHaveValue('90');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await select(page,refs[0].entry.name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true}).last()).toHaveValue('90');
 const portable={version:2,kind:'template',template:{name:'Imported timing',extraMinutes:5,bufferPercent:10,goals:{},exercises:[{name:'Custom curl',sets:3,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:['Biceps'],secondaryMuscles:[]}]}};
 page.once('dialog',d=>d.accept());
 await page.locator('#import-file').setInputFiles({name:'timing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});
 await expect(page.getByLabel('Session template name',{exact:true})).toHaveValue('Imported timing');
 await expect(page.locator('.card-name')).toHaveText('Custom curl');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByRole('button',{name:'Link to catalog',exact:true}).click();
 page.once('dialog',d=>d.accept());await select(page,refs[1].entry.name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'Create variant',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Variant name',{exact:true}).fill('Custom timing variant '+suffix);
 await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
});
test('reference form requires classification and exposes editable defaults',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
 const dialog=page.getByRole('dialog'),name='Timing reference '+crypto.randomUUID();
 await dialog.getByLabel('Reference exercise name',{exact:true}).fill(name);
 await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).click();
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('Choose');
 await dialog.getByLabel('Exercise type',{exact:true}).selectOption('compound');await dialog.getByRole('radio',{name:'Barbell',exact:true}).check();
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,844]]) {
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'.superpowers/sdd/2026-10-25-workout-duration/reference-type-'+width+'.png'});
 }
 await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).click();
 const group=page.locator('.reference-group').filter({has:page.getByText(name,{exact:true})});
 await expect(group).toContainText('Compound');
 await group.getByRole('button',{name:'Edit reference exercise '+name,exact:true}).click();
 await dialog.getByLabel('Exercise type',{exact:true}).selectOption('isolation');await dialog.getByRole('radio',{name:'Barbell',exact:true}).check();
 await dialog.getByRole('button',{name:'Save reference exercise',exact:true}).click();
 await expect(group).toContainText('Isolation');
});
test('lost inline creation response cannot silently accept a changed reference type',async({page})=>{
 test.setTimeout(60000);
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByRole('button',{name:'New variant',exact:true}).click();
 const dialog=page.getByRole('dialog'),name='Lost timing creation '+crypto.randomUUID();
 await dialog.getByLabel('Variant name',{exact:true}).fill(name);
 await dialog.getByLabel('New reference exercise name',{exact:true}).fill(name+' reference');
 await dialog.getByLabel('Exercise type',{exact:true}).selectOption('compound');await dialog.getByRole('radio',{name:'Barbell',exact:true}).check();
 await dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true}).check();
 let first=true,familyId;
 await page.route('**/api/catalog',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  familyId=route.request().postDataJSON().familyId;
  if(first){first=false;await route.fetch();return route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Lost creation response'}}});}
  await route.continue();
 });
 await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toContainText('Lost creation response');
 await dialog.getByLabel('Exercise type',{exact:true}).selectOption('isolation');await dialog.getByRole('radio',{name:'Barbell',exact:true}).check();
 await dialog.getByRole('button',{name:'Save variant',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('different reference exercise');
 const saved=(await (await page.request.get('/api/catalog/references/'+familyId)).json()).reference;
 expect(saved.exerciseType).toBe('compound');
 await dialog.getByLabel('Exercise type',{exact:true}).selectOption('compound');await dialog.getByRole('radio',{name:'Barbell',exact:true}).check();
 await dialog.getByRole('button',{name:'Save variant',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(page.locator('.card-name')).toHaveText(name);
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('180');
});
