import {test,expect} from '@playwright/test';
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true})).toBeVisible();}

async function createVariant(page,name,equipment='Barbell'){
 await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Reference exercise name',{exact:true}).fill(name+' reference');await dialog.getByLabel('Exercise type',{exact:true}).selectOption('compound');await dialog.getByRole('radio',{name:equipment,exact:true}).check();await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.locator('.reference-group').filter({has:page.getByText(name+' reference',{exact:true})}).getByRole('button',{name:'Add variant to '+name+' reference',exact:true}).click();
 await dialog.getByLabel('Variant name',{exact:true}).fill(name);await expect(dialog.getByText('Equipment: '+equipment,{exact:true})).toBeVisible();await dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true}).check();await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toHaveCount(0);
}
test('catalog supports references, same-mapping variants, edits and archive recovery',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const name='Test press '+Date.now();await createVariant(page,name,'Dumbbell');const dialog=page.getByRole('dialog');await page.getByLabel('Search catalog',{exact:true}).fill(name);
 const row=page.locator('.catalog-row').filter({has:page.getByText(name,{exact:true})});
 await row.getByRole('button',{name:'Create variant from '+name,exact:true}).click();await dialog.getByLabel('Variant name',{exact:true}).fill(name+' variant');await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(page.locator('.catalog-row:visible')).toHaveCount(2);
 await row.getByRole('button',{name:'Edit variant '+name,exact:true}).click();await expect(dialog).toContainText('Changes apply to every workout using this exercise.');await dialog.getByLabel('Variant name',{exact:true}).fill(name+' corrected');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 const edited=page.locator('.catalog-row').filter({has:page.getByText(name+' corrected',{exact:true})});await edited.getByRole('button',{name:'Archive variant '+name+' corrected',exact:true}).click();await expect(page.locator('.catalog-row:visible')).toHaveCount(1);
 await page.getByLabel('Show archived',{exact:true}).check();await edited.getByRole('button',{name:'Restore variant '+name+' corrected',exact:true}).click();await expect(edited).not.toContainText('Archived');
});

test('a workout save acknowledgement preserves an open variant draft',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();const input=page.getByRole('combobox',{name:'Exercise',exact:true});await input.fill('Barbell bench press');
 await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toBeVisible();await input.press('ArrowDown');await input.press('Enter');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 const id=(await page.url()).split('/').at(-1);let committed=false,release;
 await page.route('**/api/documents/'+id,async route=>{if(route.request().method()!=='PUT')return route.continue();const response=await route.fetch();committed=true;await new Promise(resolve=>{release=resolve;});await route.fulfill({response});});
 await page.getByLabel('Sets',{exact:true}).fill('5');await expect.poll(()=>committed).toBe(true);
 await page.getByRole('button',{name:'Create variant',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Variant name',{exact:true}).fill('Keep this draft');
 release();await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue('Keep this draft');
});
test('focus refresh never mistakes an unacknowledged own save for an external conflict',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await expect(page.getByLabel('Session template name')).toBeVisible();
 const id=(await page.url()).split('/').at(-1);let committed=false,release;
 await page.route('**/api/documents/'+id,async route=>{
  if(route.request().method()!=='PUT')return route.continue();
  const response=await route.fetch();committed=true;await new Promise(resolve=>{release=resolve;});await route.fulfill({response});
 });
 await page.getByLabel('Session template name').fill('My acknowledged save');
 await expect.poll(()=>committed).toBe(true);
 const focusRead=page.waitForResponse(r=>r.url().endsWith('/api/documents/'+id)&&r.request().method()==='GET');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await focusRead;
 release();await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.unroute('**/api/documents/'+id);await page.getByLabel('Session template name').fill('Next change still saves');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
});
test('catalog mutations in the same tab revalidate a returning editor picker',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 const workout='Cache workout '+Date.now(),name='Cache exercise '+Date.now();
 await page.getByLabel('Session template name').fill(workout);await page.getByRole('button',{name:'Add exercise',exact:true}).click();await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();await createVariant(page,name);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('link',{name:workout,exact:true}).click();await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await page.getByRole('combobox',{name:'Exercise',exact:true}).fill(name);await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toContainText(name);
});
test('export refuses a catalog definition changed after the editor was opened',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),familyId=crypto.randomUUID();
  const entry=await api.createCatalog({id:crypto.randomUUID(),familyId,referenceExerciseType:'compound',familyName:'Export family',entry:{name:'Export press',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const record=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Export workout',exercises:[{name:entry.name,sets:3,repRange:{min:8,max:12},primaryMuscles:entry.primaryMuscles,secondaryMuscles:[],catalogId:entry.id,catalogRevision:1,familyId,equipment:entry.equipment}],goals:{}}});return {entry,record};
 });
 await page.goto('/#/templates/'+fixture.record.id);await expect(page.getByLabel('Session template name')).toHaveValue('Export workout');
 await page.evaluate(async entry=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();await api.updateCatalog({id:entry.id,revision:1,entry:{...entry,name:'New export press'},impact:await api.catalogImpact(entry.id)});},fixture.entry);
 let downloads=0;page.on('download',()=>downloads++);
 await page.getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveText('Conflict');expect(downloads).toBe(0);
});
test('failed usage preview blocks shared edits until the preview can be retried',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 await page.route('**/api/catalog/*/impact',route=>route.fulfill({status:503,json:{error:{message:'Usage unavailable'}}}));
 await page.locator('.reference-toggle').first().click();await page.locator('.catalog-row:visible').first().getByRole('button',{name:/^Edit variant /}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Usage unavailable');await expect(dialog.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
 await page.unroute('**/api/catalog/*/impact');await dialog.getByRole('button',{name:'Retry usage preview',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();
});
test('legacy linking previews changes and does not silently alter custom exercises',async({page})=>{
 await login(page);
 const id=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');return (await createApiClient().create({id:crypto.randomUUID(),kind:'template',document:{name:'Legacy workout',exercises:[{name:'My press',sets:6,repRange:{min:5,max:7},primaryMuscles:['Triceps'],secondaryMuscles:[]}],goals:{}}})).id;});
 await page.goto('/#/templates/'+id);await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await expect(page.getByLabel('Exercise name',{exact:true})).toHaveValue('My press');
 await page.getByRole('button',{name:'Link to catalog',exact:true}).click();
 const search=page.getByRole('combobox',{name:'Exercise',exact:true});
 await search.press('Escape');await search.press('Escape');await expect(page.getByRole('button',{name:'Link to catalog',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Link to catalog',exact:true}).click();await search.fill('Barbell bench press');await search.press('ArrowDown');
 page.once('dialog',dialog=>dialog.dismiss());await search.press('Enter');
 await expect(page.getByLabel('Exercise name',{exact:true})).toHaveValue('My press');await expect(page.locator('.volume-row[data-muscle="Triceps"] .value')).toHaveText('6');
 page.once('dialog',dialog=>dialog.accept());await search.press('Enter');
 await expect(page.locator('.card-name')).toHaveText('Barbell bench press');await expect(page.getByLabel('Sets',{exact:true})).toHaveValue('6');await expect(page.getByLabel('Reps min',{exact:true})).toHaveValue('5');
});
test('picker retry is idempotent after a committed variant response is lost',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 const input=page.getByRole('combobox',{name:'Exercise',exact:true});await input.fill('Barbell bench press');await input.press('ArrowDown');await input.press('Enter');
 await page.getByRole('button',{name:'Create variant',exact:true}).click();
 const name='Retry variant '+Date.now(),dialog=page.getByRole('dialog');await dialog.getByLabel('Variant name',{exact:true}).fill(name);
 let lost=false;
 await page.route('**/api/catalog',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.fulfill({status:503,json:{error:{message:'Response lost'}}});}else await route.continue();});
 await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toContainText('Response lost');
 await dialog.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.card-name')).toHaveText(name);
 const count=await page.evaluate(async name=>{const r=await fetch('/api/catalog');return (await r.json()).entries.filter(e=>e.name===name).length;},name);expect(count).toBe(1);
});
test('catalog edits refresh clean editors and dirty editors retain sets through conflict copy',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),id=crypto.randomUUID(),familyId=crypto.randomUUID();
  const entry=await api.createCatalog({id,familyId,referenceExerciseType:'compound',familyName:'Refresh family',entry:{name:'Refresh press',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const record=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Refresh workout',exercises:[{name:entry.name,sets:3,repRange:{min:8,max:12},primaryMuscles:entry.primaryMuscles,secondaryMuscles:[],catalogId:id,catalogRevision:1,familyId,equipment:'Barbell'}],goals:{}}});
  return {entry,record};
 });
 await page.goto('/#/templates/'+fixture.record.id);
 const change=async name=>page.evaluate(async({entry,name})=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),fresh=(await api.catalog()).entries.find(e=>e.id===entry.id);await api.updateCatalog({id:entry.id,revision:fresh.revision,entry:{...fresh,name,primaryMuscles:['Front delts']},impact:await api.catalogImpact(entry.id)});},{entry:fixture.entry,name});
 await change('Updated refresh press');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.card-name').first()).toContainText('Updated refresh press');
 await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await page.route('**/api/documents/'+fixture.record.id,route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:{message:'Try later'}}}):route.continue());
 await page.getByLabel('Sets',{exact:true}).fill('7');await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');
 await change('Newest refresh press');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByTestId('save-status')).toHaveText('Conflict');await expect(page.getByLabel('Sets',{exact:true})).toHaveValue('7');
 await page.unroute('**/api/documents/'+fixture.record.id);
 await page.getByRole('button',{name:'Save as copy',exact:true}).click();
 await expect(page.locator('.card-name').first()).toContainText('Newest refresh press');
 await page.getByRole('button',{name:/^Expand exercise: /}).click();await expect(page.getByLabel('Sets',{exact:true})).toHaveValue('7');
});
test('in-card autocomplete explicitly selects definitions and creates an independent variant',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 const search=page.getByRole('combobox',{name:'Exercise',exact:true});
 await search.fill('barbell bench press');
 await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toContainText('Barbell bench press');
 expect(await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').count()).toBeLessThanOrEqual(8);
 await expect(page.locator('.volume-row:visible')).toHaveCount(0);
 await search.press('ArrowDown');await search.press('Enter');
 await expect(page.locator('.card-name')).toHaveText('Barbell bench press');
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('3');
 await expect(page.locator('.exercise .primary input')).toHaveCount(0);
 await page.getByLabel('Sets',{exact:true}).fill('5');

 await page.getByRole('button',{name:'Create variant',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Other workouts are unchanged.');
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('.card-name')).toHaveText('Barbell bench press');
 await page.getByRole('button',{name:'Create variant',exact:true}).click();
 const variant='My bench '+Date.now();await page.getByRole('dialog').getByLabel('Variant name',{exact:true}).fill(variant);
 await page.getByRole('dialog').getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Front delts',{exact:true}).check();
 await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).click();
 await expect(page.locator('.card-name')).toHaveText(variant);await expect(page.getByLabel('Sets',{exact:true})).toHaveValue('5');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await expect(page.locator('.card-name')).toHaveText(variant);
});

test('catalog combines role/type filters and preserves them through mutation refresh',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const {mountCatalog}=await import('/src/catalog-view.js');document.body.innerHTML='<main id="fixture"></main>';
  const data={families:[{id:'r',name:'Filter Press',equipment:'Barbell',exerciseType:'compound'},{id:'i',name:'Filter Curl',equipment:'Dumbbell',exerciseType:'isolation'},{id:'empty',name:'Empty',equipment:'Barbell',exerciseType:'compound'}],entries:[{id:'bench',familyId:'r',name:'Filter Bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],individuallyArchived:false},{id:'incline',familyId:'r',name:'Filter Incline',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Front delts'],individuallyArchived:false},{id:'curl',familyId:'i',name:'Filter Curl',equipment:'Dumbbell',primaryMuscles:['Biceps'],secondaryMuscles:[],individuallyArchived:false}]};
  window.catalogView=mountCatalog(document.querySelector('main'),{initialData:data,api:{catalog:async()=>data,archiveCatalog:async({id,archived})=>{data.entries.find(v=>v.id===id).individuallyArchived=archived;}}});
 });
 await page.getByLabel('Primary muscle',{exact:true}).selectOption('Chest');await page.getByLabel('Secondary muscle',{exact:true}).selectOption('Triceps');await page.getByLabel('Exercise type',{exact:true}).selectOption('compound');
 await expect(page.locator('.catalog-row')).toHaveCount(1);await expect(page.locator('.catalog-row')).toContainText('Filter Bench');
 await page.getByLabel('Equipment',{exact:true}).selectOption('Dumbbell');await expect(page.getByText('No matching reference exercises or variants.',{exact:true})).toBeVisible();
 await page.getByLabel('Equipment',{exact:true}).selectOption('');await page.getByLabel('Show archived',{exact:true}).check();
 await page.getByRole('button',{name:'Archive variant Filter Bench',exact:true}).click();await expect(page.getByLabel('Primary muscle',{exact:true})).toHaveValue('Chest');await expect(page.locator('.catalog-row')).toContainText('Archived individually');
 await page.getByLabel('Primary muscle',{exact:true}).selectOption('');await page.getByLabel('Secondary muscle',{exact:true}).selectOption('');await page.getByLabel('Exercise type',{exact:true}).selectOption('');
 await expect(page.locator('.reference-group')).toHaveCount(3);
 for(const width of [1366,1440,1920,768,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
