import {test,expect} from '@playwright/test';

async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();}

test('delayed empty-workout acknowledgement cannot erase a newer program name',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();const name=page.getByLabel('Program name',{exact:true});await name.fill('Before acknowledgement');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 let release,arrived;const gate=new Promise(r=>release=r),ready=new Promise(r=>arrived=r);
 await page.route('**/api/document-commands/attach',async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response});});
 try{await page.getByRole('button',{name:'Empty workout',exact:true}).click();await ready;const locked=await name.evaluate(input=>Boolean(input.closest('[inert]')));if(!locked)await name.fill('Keep newer name');release();await expect(page.locator('.workout-item')).toHaveCount(1);await expect(name).toHaveValue(locked?'Before acknowledgement':'Keep newer name');await expect(page.getByTestId('save-status')).toHaveText('Saved');}finally{release();}
});

test('pending empty-workout attachment protects program edits and replays a lost response once',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();
 const name=page.getByLabel('Program name',{exact:true});await name.fill('Before attachment');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 let release,arrived;const gate=new Promise(r=>release=r),ready=new Promise(r=>arrived=r),requests=[];
 await page.route('**/api/document-commands/attach',async route=>{requests.push(route.request().postDataJSON());const response=await route.fetch();if(requests.length===1){arrived();await gate;await route.abort('failed');}else await route.fulfill({response});});
 try{
  await page.getByRole('button',{name:'Empty workout',exact:true}).click();await ready;
  const locked=await name.evaluate(input=>Boolean(input.closest('[inert]')));
  if(!locked)await name.fill('Intervening edit');
  release();await expect(page.locator('[data-program-error]')).not.toBeEmpty();
  await page.getByRole('button',{name:'Empty workout',exact:true}).click();await expect(page.locator('.workout-item')).toHaveCount(1);
  await expect(name).toHaveValue(locked?'Before attachment':'Intervening edit');
  expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);
  const programId=(await page.url()).split('/').at(-1),bundle=(await(await page.request.get('/api/documents/'+programId+'/bundle')).json());expect(bundle.record.document.workouts).toHaveLength(1);expect(bundle.templates).toHaveLength(1);
 }finally{release();}
});

test('tag creation accepts a corrected name after a definitive duplicate rejection',async({page})=>{
 await login(page);const suffix=crypto.randomUUID(),existing='Existing '+suffix,corrected='Corrected '+suffix;
 await page.evaluate(async name=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().createTag({id:crypto.randomUUID(),kind:'brand',name});},existing);
 await page.goto('/#/catalog/tags?kind=brand');await page.getByLabel('New Brand tag',{exact:true}).fill(existing);await page.getByRole('button',{name:'Create Brand',exact:true}).click();await expect(page.locator('[data-error]')).toContainText('already exists');
 await page.getByLabel('New Brand tag',{exact:true}).fill(corrected);await page.getByRole('button',{name:'Create Brand',exact:true}).click();await expect(page.locator('.tag-row').filter({hasText:corrected})).toHaveCount(1);
});

test('ambiguous tag creation retries its exact envelope without creating a second tag',async({page})=>{
 await login(page);await page.goto('/#/catalog/tags?kind=focus');const name='Replay '+crypto.randomUUID(),requests=[];
 await page.route('**/api/catalog/tags',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}requests.push(route.request().postDataJSON());const response=await route.fetch();if(requests.length===1)await route.abort('failed');else await route.fulfill({response});});
 await page.getByLabel('New Focus tag',{exact:true}).fill(name);await page.getByRole('button',{name:'Create Focus',exact:true}).click();await expect(page.locator('[data-retry]')).toBeVisible();await page.locator('[data-retry]').click();await expect(page.locator('.tag-row').filter({hasText:name})).toHaveCount(1);expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);
});

test('edit variant refreshes newly archived tag eligibility without losing the draft',async({page})=>{
 await login(page);const fixture=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js'),api=createApiClient(),suffix=crypto.randomUUID();const ref=await api.createReference({id:crypto.randomUUID(),name:'Recovery reference '+suffix,exerciseType:'compound',equipment:'Machine'}),tag=await api.createTag({id:crypto.randomUUID(),kind:'brand',name:'Recovery Brand '+suffix}),variant=await api.createCatalog({id:crypto.randomUUID(),familyId:ref.id,entry:{name:'Recovery variant '+suffix,primaryMuscles:['Chest'],secondaryMuscles:[]}});return {ref,tag,variant};});
 await page.goto('/#/catalog/references/'+fixture.ref.id+'/variants/'+fixture.variant.id);await page.getByRole('button',{name:'Edit variant '+fixture.variant.name,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.locator('input[type=radio][name=brandId][value="'+fixture.tag.id+'"]').check();const edited=fixture.variant.name+' edited';await dialog.getByLabel('Variant name',{exact:true}).fill(edited);await dialog.getByRole('textbox',{name:'Variant description (optional)',exact:true}).fill('Keep this draft');
 await page.evaluate(async tag=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().archiveTag({id:tag.id,revision:tag.revision,archived:true});},fixture.tag);
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog.locator('[data-error]')).toContainText('Archived tags');await dialog.getByRole('button',{name:'Refresh catalog',exact:true}).click();await expect(dialog.getByRole('group',{name:'Brand',exact:true}).locator('label').filter({has:page.locator('input:checked')})).toContainText('(Archived)');await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue(edited);await expect(dialog.getByRole('textbox',{name:'Variant description (optional)',exact:true})).toHaveValue('Keep this draft');await dialog.getByRole('radio',{name:'No Brand',exact:true}).check();await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);
 const saved=(await(await page.request.get('/api/catalog')).json()).entries.find(v=>v.id===fixture.variant.id);expect(saved.name).toBe(edited);expect(saved.description).toBe('Keep this draft');expect(saved.brand).toBeNull();
});
