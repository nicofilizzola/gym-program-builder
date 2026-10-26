import {test,expect} from '@playwright/test';
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('link',{name:'Exercise catalog',exact:true})).toBeVisible();}
const group=(page,name)=>page.locator('.reference-group').filter({has:page.getByText(name,{exact:true})});
test('touch activation explains unavailable catalog actions without changing data',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();
 try{
  await login(page);const ref=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),r=await api.createReference({id:crypto.randomUUID(),name:'Touch restriction '+crypto.randomUUID()});await api.createCatalog({id:crypto.randomUUID(),familyId:r.id,entry:{name:'Restricted child',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});await api.archiveReference({id:r.id,revision:2,archived:true});return r;});
  await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByLabel('Show archived',{exact:true}).check();await page.getByLabel('Search catalog',{exact:true}).fill(ref.name);const section=group(page,ref.name);
  await section.locator('.reference-toggle').click();await expect(section.locator('.reference-toggle')).toHaveAttribute('aria-expanded','false');
  let writes=0;page.on('request',r=>{if(r.url().includes('/api/catalog')&&r.method()!=='GET')writes++;});
  const tap=async button=>{await button.scrollIntoViewIfNeeded();const r=await button.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await expect(page.getByRole('tooltip')).toContainText('Restore the reference exercise');await expect(button).toHaveAttribute('aria-describedby',/^action-tooltip-/);await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();};
  await tap(section.locator('[data-catalog-action=add]'));await tap(section.locator('[data-catalog-action=add]'));
  await section.locator('.reference-toggle').click();await tap(section.locator('[data-catalog-action=create]'));await tap(section.locator('.catalog-row [data-catalog-action=archive]'));expect(writes).toBe(0);await expect(page.getByRole('dialog')).toHaveCount(0);
 }finally{await context.close();}
});
test('catalog mutation focus remains visible across moves reference reordering and search fallback',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await login(page);
 const fixture=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),suffix=crypto.randomUUID(),source=await api.createReference({id:crypto.randomUUID(),name:'A focus '+suffix}),target=await api.createReference({id:crypto.randomUUID(),name:'Z focus '+suffix});for(let i=0;i<24;i++)await api.createReference({id:crypto.randomUUID(),name:'Focus middle '+i+' '+suffix});const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:source.id,entry:{name:'Movable child '+suffix,equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});return {source,target,entry,suffix};});
 await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();const source=group(page,fixture.source.name);await source.locator('.reference-toggle').click();await source.locator('[data-catalog-action=move]').click();await page.getByLabel('Destination reference exercise',{exact:true}).selectOption(fixture.target.id);await page.getByRole('dialog').getByRole('button',{name:'Move variant',exact:true}).click();
 const targetById=page.locator('.reference-group').filter({has:page.getByRole('button',{name:'Move variant '+fixture.entry.name+' to reference exercise',exact:true})});await expect(targetById.locator('[data-catalog-action=move]')).toBeFocused();await expect(targetById.locator('[data-catalog-action=move]')).toBeInViewport({ratio:1});
 const rename=async name=>{await targetById.locator('[data-catalog-action=rename]').click();await page.getByLabel('Reference exercise name',{exact:true}).fill(name);await page.getByRole('dialog').getByRole('button',{name:'Save reference exercise',exact:true}).click();};
 await rename('A renamed focus '+fixture.suffix);await expect(targetById.locator('[data-catalog-action=rename]')).toBeFocused();await expect(targetById.locator('[data-catalog-action=rename]')).toBeInViewport({ratio:1});
 await rename('Z renamed focus '+fixture.suffix);await expect(targetById.locator('[data-catalog-action=rename]')).toBeInViewport({ratio:1});
 const search=page.getByLabel('Search catalog',{exact:true});await search.fill('focus');await rename('Hidden result '+fixture.suffix);await expect(search).toBeFocused();await expect(search).toBeInViewport({ratio:1});
 const visible=page.locator('.reference-header [data-catalog-action=rename]').first();await visible.click();const before=await page.evaluate(()=>scrollY);await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(visible).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(before);
});
test('manual reference disclosure animates in place and reverses without stale state',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const ref=group(page,'Bench press');await expect(ref).toBeVisible();
 const sample=await ref.evaluate(async section=>{
  const toggle=section.querySelector('.reference-toggle'),body=section.querySelector('.reference-variants'),child=section.querySelector('.catalog-row'),next=section.nextElementSibling;
  window.catalogMotionChild=child;const before=next.getBoundingClientRect().top;toggle.click();
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const start=performance.now();let middle;
  do{await new Promise(requestAnimationFrame);middle=next.getBoundingClientRect().top;}while(performance.now()-start<65);
  return {same:section.isConnected&&window.catalogMotionChild===section.querySelector('.catalog-row'),before,middle,duration:getComputedStyle(body).transitionDuration,timing:getComputedStyle(body).transitionTimingFunction};
 });
 expect(sample.same).toBe(true);expect(sample.duration).toBe('0.2s, 0.2s');expect(sample.timing).toBe('ease-out, ease-out');
 await expect.poll(()=>ref.locator('.reference-variants').evaluate(b=>b.getAnimations().length)).toBe(0);
 const after=await ref.evaluate(s=>s.nextElementSibling.getBoundingClientRect().top);expect(sample.middle).toBeGreaterThan(sample.before);expect(sample.middle).toBeLessThan(after);
 const edit=ref.locator('[data-catalog-action=edit]').first();await edit.focus();
 await ref.evaluate(s=>s.querySelector('.reference-toggle').click());await expect(ref.locator('.reference-toggle')).toBeFocused();await expect(ref.locator('.reference-variants')).toHaveAttribute('inert','');await expect(ref.locator('.reference-variants')).toHaveAttribute('aria-hidden','true');
 await ref.locator('.reference-toggle').press('Tab');expect(await edit.evaluate(b=>b===document.activeElement)).toBe(false);
 await ref.evaluate(async s=>{const b=s.querySelector('.reference-toggle');b.click();await new Promise(requestAnimationFrame);b.click();await new Promise(requestAnimationFrame);b.click();});
 await expect(ref.locator('.reference-toggle')).toHaveAttribute('aria-expanded','true');await expect(ref.locator('.reference-variants')).not.toHaveAttribute('inert','');
 await expect.poll(()=>ref.locator('.reference-variants').evaluate(b=>b.getAnimations().length)).toBe(0);await expect(edit).toBeVisible();expect(await ref.locator('.catalog-row').first().evaluate(b=>b===window.catalogMotionChild)).toBe(true);
});
test('reference disclosure respects reduced motion and search expansion across reloads',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await login(page);await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();const ref=group(page,'Bench press'),toggle=ref.locator('.reference-toggle');
 await toggle.click();await expect(ref.locator('.reference-variants')).toHaveCSS('transition-duration','0s');await expect(toggle.locator('svg')).toHaveCSS('transition-duration','0s');
 const search=page.getByLabel('Search catalog',{exact:true});await search.fill('Row');await search.clear();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await toggle.click();await search.fill('Bench press');await expect(toggle).toHaveAttribute('aria-expanded','true');await toggle.click();await search.clear();await expect(toggle).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'New reference exercise',exact:true}).click();const name='Empty motion '+Date.now();await page.getByLabel('Reference exercise name',{exact:true}).fill(name);await page.getByRole('dialog').getByRole('button',{name:'Create reference exercise',exact:true}).click();
 const empty=group(page,name);await empty.locator('.reference-toggle').click();await expect(empty.getByText('No variants yet.',{exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'no-preference'});await search.fill('Bench press');
 let release;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/api/catalog',async route=>{if(route.request().method()==='GET')await gate;await route.continue();});
 const pending=page.waitForRequest(r=>r.url().endsWith('/api/catalog')&&r.method()==='GET');await ref.locator('.catalog-row [data-catalog-action=archive]').last().evaluate(b=>b.click());await pending;
 await toggle.evaluate(b=>b.click());const loaded=page.waitForResponse(r=>r.url().endsWith('/api/catalog')&&r.request().method()==='GET');release();await loaded;
 await expect(toggle).toHaveAttribute('aria-expanded','false');await expect.poll(()=>ref.locator('.reference-variants').evaluate(b=>b.getAnimations().length)).toBe(0);
 await search.clear();await expect(toggle).toHaveAttribute('aria-expanded','false');
});
test('direct icon actions expose every catalog operation with accessible tooltips and exact cancel focus',async({page})=>{
 await login(page);await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByLabel('Search catalog',{exact:true}).fill('Bench press');
 const ref=group(page,'Bench press'),row=ref.locator('.catalog-row').filter({has:page.getByText('Barbell bench press',{exact:true})});
 for(const [scope,keys]of [[ref.locator('.reference-header-actions'),['add','rename','archive']],[row.locator('.catalog-row-actions'),['edit','create','move','archive']]]){
  await expect(scope.locator('button')).toHaveCount(keys.length);
  expect(await scope.locator('button').evaluateAll(buttons=>buttons.map(b=>b.dataset.catalogAction))).toEqual(keys);
  for(const b of await scope.locator('button').all()){await expect(b.locator('svg')).toHaveCount(1);expect(await b.innerText()).toBe('');expect(await b.getAttribute('aria-label')).toBeTruthy();}
 }
 await expect(page.getByRole('button',{name:/^(Reference|Variant) actions/})).toHaveCount(0);
 const edit=row.getByRole('button',{name:'Edit variant Barbell bench press',exact:true});await edit.focus();await expect(page.getByRole('tooltip')).toHaveText('Edit variant');await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();
 for(const b of [edit,ref.getByRole('button',{name:'Rename reference exercise Bench press',exact:true}),ref.getByRole('button',{name:'Add variant to Bench press',exact:true}),row.getByRole('button',{name:'Create variant from Barbell bench press',exact:true}),row.getByRole('button',{name:'Move variant Barbell bench press to reference exercise',exact:true})]){
  await b.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('tooltip')).toBeHidden();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(b).toBeFocused();
 }
});
test('reference CRUD creates empty groups and preserves separate child archives on restore',async({page})=>{
 await login(page);await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const name='Managed reference '+Date.now(),variant='Managed variant '+Date.now();
 await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Reference exercise name',{exact:true}).fill(name);
 await page.getByRole('dialog').getByRole('button',{name:'Create reference exercise',exact:true}).click();
 const ref=group(page,name);await expect(ref.getByRole('button',{name:'Expand reference exercise '+name,exact:true})).toHaveAttribute('aria-expanded','false');
 await ref.getByRole('button',{name:'Expand reference exercise '+name,exact:true}).click();await expect(ref).toContainText('No variants yet.');
 await ref.getByRole('button',{name:/^Add variant to /,exact:false}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByText('Reference exercise: '+name,{exact:true})).toBeVisible();await expect(dialog.getByLabel('Equipment',{exact:true})).toBeVisible();
 await dialog.getByLabel('Variant name',{exact:true}).fill(variant);await dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true}).check();await dialog.getByRole('button',{name:'Save variant',exact:true}).click();
 await expect(ref.locator('.catalog-row')).toHaveCount(1);
 await page.evaluate(async({name,variant})=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),data=await api.catalog(),r=data.families.find(r=>r.name===name);const e=await api.createCatalog({id:crypto.randomUUID(),familyId:r.id,entry:{name:variant+' old',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});await api.archiveCatalog({id:e.id,revision:e.revision,archived:true});},{name,variant});
 await page.reload();await page.getByLabel('Search catalog',{exact:true}).fill(name);
 await ref.getByRole('button',{name:'Archive reference exercise '+name,exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Archive reference exercise',exact:true}).click();await expect(ref).toHaveCount(0);
 await page.getByLabel('Show archived',{exact:true}).check();await ref.getByRole('button',{name:'Restore reference exercise '+name,exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Restore reference exercise',exact:true}).click();
 const states=await page.evaluate(async name=>{const {entries}=await (await fetch('/api/catalog')).json();return entries.filter(e=>e.name.startsWith(name)).map(e=>[e.name,e.archived]);},variant);
 expect(states).toEqual([[variant,false],[variant+' old',true]]);
 await ref.getByRole('button',{name:'Rename reference exercise '+name,exact:true}).click();
 await page.getByRole('dialog').getByLabel('Reference exercise name',{exact:true}).fill(name+' renamed');await page.getByRole('dialog').getByRole('button',{name:'Save reference exercise',exact:true}).click();
 await page.getByLabel('Search catalog',{exact:true}).fill(name+' renamed');await expect(group(page,name+' renamed')).toHaveCount(1);
});
for(const mode of ['add','clone']){
 test('stale '+mode+' variant drafts refresh their reference without losing fields',async({page})=>{
  await login(page);
  const fixture=await page.evaluate(async()=>{
   const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),reference=await api.createReference({id:crypto.randomUUID(),name:'Refresh target '+crypto.randomUUID()});
   const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Original '+crypto.randomUUID(),equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
   return {reference,entry};
  });
  await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByLabel('Search catalog',{exact:true}).fill(fixture.reference.name);
  const ref=group(page,fixture.reference.name);
  if(mode==='add')await ref.getByRole('button',{name:/^Add variant to /,exact:false}).click();
  else await ref.getByRole('button',{name:'Create variant from '+fixture.entry.name,exact:true}).click();
  const name='Preserved '+mode+' '+Date.now(),dialog=page.getByRole('dialog');
  await dialog.getByLabel('Variant name',{exact:true}).fill(name);await dialog.getByLabel('Equipment',{exact:true}).selectOption('Dumbbell');
  await dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true}).check();await dialog.getByRole('group',{name:'Secondary muscles',exact:true}).getByLabel('Triceps',{exact:true}).check();
  await page.evaluate(async id=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().createCatalog({id:crypto.randomUUID(),familyId:id,entry:{name:'Another '+crypto.randomUUID(),equipment:'Cable',primaryMuscles:['Lats'],secondaryMuscles:[]}});},fixture.reference.id);
  const createdIds=[];page.on('request',r=>{if(r.url().endsWith('/api/catalog')&&r.method()==='POST')createdIds.push(r.postDataJSON().id);});
  await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toContainText('changed');
  await dialog.getByRole('button',{name:'Refresh reference exercise',exact:true}).click();
  await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue(name);await expect(dialog.getByLabel('Equipment',{exact:true})).toHaveValue('Dumbbell');await expect(dialog.getByRole('group',{name:'Secondary muscles',exact:true}).getByLabel('Triceps',{exact:true})).toBeChecked();
  if(mode==='add'){
   const changeArchive=async archived=>page.evaluate(async({id,archived})=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),r=await api.getReference(id);await api.archiveReference({id,revision:r.revision,archived});},{id:fixture.reference.id,archived});
   await changeArchive(true);await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toContainText('Restore the reference exercise first.');
   await dialog.getByRole('button',{name:'Refresh reference exercise',exact:true}).click();await expect(dialog.getByRole('button',{name:'Save variant',exact:true})).toBeDisabled();
   await changeArchive(false);await dialog.getByRole('button',{name:'Refresh reference exercise',exact:true}).click();await expect(dialog.getByRole('button',{name:'Save variant',exact:true})).toBeEnabled();await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue(name);
  }
  await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(createdIds.length).toBe(mode==='add'?3:2);expect(new Set(createdIds).size).toBe(1);await expect(ref.getByText(name,{exact:true})).toBeVisible();
 });
}
test('move collisions preserve the destination and lost move responses retry once',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),suffix=crypto.randomUUID(),source=await api.createReference({id:crypto.randomUUID(),name:'Move source '+suffix}),target=await api.createReference({id:crypto.randomUUID(),name:'Move target '+suffix}),definition={name:'Movable '+suffix,equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]};
  const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:source.id,entry:definition}),collision=await api.createCatalog({id:crypto.randomUUID(),familyId:target.id,entry:definition});return {source,target,entry,collision};
 });
 await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByLabel('Search catalog',{exact:true}).fill(fixture.entry.name);
 const source=group(page,fixture.source.name),invoker=source.getByRole('button',{name:'Move variant '+fixture.entry.name+' to reference exercise',exact:true});
 const open=async()=>{await invoker.click();await page.getByRole('dialog').getByLabel('Destination reference exercise',{exact:true}).selectOption(fixture.target.id);};
 await open();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Move variant',exact:true}).click();await expect(dialog).toContainText('already exists');await expect(dialog.getByLabel('Destination reference exercise',{exact:true})).toHaveValue(fixture.target.id);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(invoker).toBeFocused();
 await page.evaluate(async entry=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();await api.updateCatalog({id:entry.id,revision:1,entry:{...entry,name:entry.name+' other'},impact:await api.catalogImpact(entry.id)});},fixture.collision);
 await open();let lost=false;await page.route('**/api/catalog/*/reference',async route=>{if(!lost){lost=true;await route.fetch();await route.fulfill({status:503,json:{error:{message:'Move response lost'}}});}else await route.continue();});
 await dialog.getByRole('button',{name:'Move variant',exact:true}).click();await expect(dialog).toContainText('Move response lost');await dialog.getByRole('button',{name:'Retry',exact:true}).click();await expect(dialog).toHaveCount(0);
 const state=await page.evaluate(async id=>{const data=await (await fetch('/api/catalog')).json();return {entry:data.entries.find(e=>e.id===id),count:data.entries.length,refs:data.families};},fixture.entry.id);
 expect(state.entry.familyId).toBe(fixture.target.id);expect(state.entry.revision).toBe(2);expect(state.refs.find(r=>r.id===fixture.source.id).revision).toBe(3);expect(state.refs.find(r=>r.id===fixture.target.id).revision).toBe(3);
});
test('archived references disable new variants in the catalog and linked session menu',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),r=await api.createReference({id:crypto.randomUUID(),name:'Archived reference '+crypto.randomUUID()}),e=await api.createCatalog({id:crypto.randomUUID(),familyId:r.id,entry:{name:'Archived source '+crypto.randomUUID(),equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const record=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Archived workout',goals:{},exercises:[{name:e.name,equipment:e.equipment,catalogId:e.id,familyId:r.id,catalogRevision:e.revision,primaryMuscles:e.primaryMuscles,secondaryMuscles:[],sets:3,repRange:{min:8,max:12}}]}});
  await api.archiveReference({id:r.id,revision:2,archived:true});return {r,e,record};
 });
 await page.goto('/#/templates/'+fixture.record.id);await page.getByRole('button',{name:'Expand exercise',exact:true}).click();await page.getByRole('button',{name:'Exercise actions',exact:true}).click();await expect(page.getByRole('button',{name:'Create variant',exact:true})).toBeDisabled();await expect(page.getByText('Restore the reference exercise before creating a variant.',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByLabel('Show archived',{exact:true}).check();await page.getByLabel('Search catalog',{exact:true}).fill(fixture.r.name);
 await expect(group(page,fixture.r.name).getByRole('button',{name:/^Add variant to /,exact:false})).toBeDisabled();
 let writes=0;page.on('request',r=>{if(r.url().includes('/api/catalog')&&r.method()!=='GET')writes++;});
 const ref=group(page,fixture.r.name);
 for(const button of [ref.locator('[data-catalog-action=add]'),ref.locator('[data-catalog-action=create]'),ref.locator('.catalog-row [data-catalog-action=archive]')]){
  await expect(button).toHaveAttribute('aria-disabled','true');await button.focus();await expect(button).toBeFocused();await expect(page.getByRole('tooltip')).toContainText('Restore the reference exercise');
  await button.evaluate(b=>b.click());await button.press('Enter');await button.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 expect(writes).toBe(0);
});
test('grouped autocomplete skips reference headings and preserves or clears the active variant on refresh',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),suffix='grouped'+crypto.randomUUID();
  const a=await api.createReference({id:crypto.randomUUID(),name:'A reference '+suffix}),b=await api.createReference({id:crypto.randomUUID(),name:'B reference '+suffix});
  const make=(r,name)=>api.createCatalog({id:crypto.randomUUID(),familyId:r.id,entry:{name,equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const first=await make(a,'Flat '+suffix),second=await make(a,'Incline '+suffix),third=await make(b,'Row '+suffix);return {a,b,first,second,third,suffix};
 });
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 const input=page.getByRole('combobox',{name:'Exercise',exact:true}),list=page.getByRole('listbox',{name:'Exercise suggestions'});await input.fill(fixture.suffix);
 await expect(list.getByRole('group',{name:fixture.a.name,exact:true}).getByRole('option')).toHaveCount(2);await expect(list.getByRole('group',{name:fixture.b.name,exact:true}).getByRole('option')).toHaveCount(1);
 await input.press('ArrowDown');await input.press('ArrowDown');const active=await input.getAttribute('aria-activedescendant');expect(active).toBeTruthy();
 const refresh=async()=>{const loaded=page.waitForResponse(r=>r.url().endsWith('/api/catalog')&&r.request().method()==='GET');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await loaded;};
 await refresh();await expect(input).toHaveAttribute('aria-activedescendant',active);
 await page.evaluate(async id=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().archiveCatalog({id,revision:1,archived:true});},fixture.second.id);
 await refresh();await expect(list.getByRole('option')).toHaveCount(2);await expect(input).not.toHaveAttribute('aria-activedescendant');
 await input.press('ArrowUp');await input.press('Enter');await expect(page.locator('.linked-exercise-name')).toHaveText(fixture.third.name);
});
test('reference create retries a lost response without duplicating the reference',async({page})=>{
 await login(page);await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
 const name='Retry reference '+Date.now(),dialog=page.getByRole('dialog');await dialog.getByLabel('Reference exercise name',{exact:true}).fill(name);let lost=false;
 await page.route('**/api/catalog/references',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.fulfill({status:503,json:{error:{message:'Reference response lost'}}});}else await route.continue();});
 await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).click();await expect(dialog).toContainText('Reference response lost');await expect(dialog.getByLabel('Reference exercise name',{exact:true})).toHaveValue(name);
 await dialog.getByRole('button',{name:'Retry',exact:true}).click();await expect(group(page,name)).toHaveCount(1);
 const matches=await page.evaluate(async name=>(await (await fetch('/api/catalog')).json()).families.filter(r=>r.name===name).length,name);expect(matches).toBe(1);
});
test('reference archive preview conflicts after a child is created and reloads its new count',async({page})=>{
 await login(page);
 const reference=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');return createApiClient().createReference({id:crypto.randomUUID(),name:'Concurrent reference '+Date.now()});});
 await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const ref=group(page,reference.name);await ref.getByRole('button',{name:'Archive reference exercise '+reference.name,exact:true}).click();
 const dialog=page.getByRole('dialog');
 await page.evaluate(async reference=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'New concurrent variant',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});},reference);
 await dialog.getByRole('button',{name:'Archive reference exercise',exact:true}).click();await expect(dialog).toContainText('changed');
 await dialog.getByRole('button',{name:'Reload saved version',exact:true}).click();await expect(dialog).toContainText('1 active variant');
 await dialog.getByRole('button',{name:'Archive reference exercise',exact:true}).click();await expect(dialog).toHaveCount(0);
});
test('nested catalog searches expand matches and move retains variant identity',async({page})=>{
 await login(page);
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),suffix=crypto.randomUUID(),source=await api.createReference({id:crypto.randomUUID(),name:'Source '+suffix}),target=await api.createReference({id:crypto.randomUUID(),name:'Target '+suffix});
  const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:source.id,entry:{name:'Flat '+suffix,equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  await api.createCatalog({id:crypto.randomUUID(),familyId:source.id,entry:{name:'Incline '+suffix,equipment:'Dumbbell',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  return {source,target,entry};
 });
 await page.getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const source=group(page,fixture.source.name);await expect(source.getByRole('button',{name:'Expand reference exercise '+fixture.source.name,exact:true})).toHaveAttribute('aria-expanded','false');
 await page.getByLabel('Search catalog',{exact:true}).fill(fixture.source.name);await expect(source.locator('.catalog-row:visible')).toHaveCount(2);
 await page.getByLabel('Search catalog',{exact:true}).fill(fixture.entry.name);await expect(source.locator('.catalog-row:visible')).toHaveCount(1);
 await source.getByRole('button',{name:'Move variant '+fixture.entry.name+' to reference exercise',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Destination reference exercise',{exact:true}).selectOption(fixture.target.id);await dialog.getByRole('button',{name:'Move variant',exact:true}).click();
 await expect(group(page,fixture.target.name).getByText(fixture.entry.name,{exact:true})).toBeVisible();
 const moved=await page.evaluate(async id=>(await (await fetch('/api/catalog')).json()).entries.find(e=>e.id===id),fixture.entry.id);
 expect(moved.familyId).toBe(fixture.target.id);expect(moved.primaryMuscles).toEqual(['Chest']);
});
