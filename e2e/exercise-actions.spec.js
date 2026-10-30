import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const screens='.superpowers/sdd/2026-10-26-inline-exercise-actions/screens';

async function setup(page,kind='template'){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async kind=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();
  const reference=await api.createReference({equipment:'Barbell',id:crypto.randomUUID(),name:'Inline reference '+crypto.randomUUID(),exerciseType:'compound'});
  const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Long named barbell bench press with a deliberate pause and controlled eccentric '+crypto.randomUUID(),equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}});
  const workout={name:'Inline workout',goals:{},extraMinutes:5,bufferPercent:10,exercises:[{name:entry.name,equipment:entry.equipment,catalogId:entry.id,catalogRevision:entry.revision,familyId:entry.familyId,sets:4,repRange:{min:6,max:10},restSeconds:45,primaryMuscles:entry.primaryMuscles,secondaryMuscles:entry.secondaryMuscles}]};
  const template=kind==='program'?await api.create({id:crypto.randomUUID(),kind:'template',document:workout}):null;
  const record=await api.create({id:crypto.randomUUID(),kind,document:kind==='template'?workout:{name:'Inline program',mode:'simple',goals:{},workouts:[{templateId:template.id,id:crypto.randomUUID(),day:null}]}});
  return {record,entry,reference};
 },kind);
 await page.goto('/#/'+(kind==='template'?'templates':'programs')+'/'+fixture.record.id);
 if(kind==='program')await page.getByRole('button',{name:'Edit Inline workout',exact:true}).click();
 await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await page.evaluate(()=>document.fonts.ready);return fixture;
}

for(const kind of ['template','program'])test(kind+' exposes direct actions and restores replacement and variant cancellation focus',async({page})=>{
 const fixture=await setup(page,kind);
 await expect(page.locator('.exercise').getByRole('heading')).toHaveAccessibleName('Exercise 1: '+fixture.entry.name);
 await expect(page.locator('.linked-exercise-name')).toBeHidden();
 await expect(page.getByText(fixture.entry.name,{exact:true}).filter({visible:true})).toHaveCount(1);
 const replace=page.getByRole('button',{name:'Replace exercise',exact:true}),variant=page.getByRole('button',{name:'Create variant',exact:true});
 await expect(replace).toBeVisible();await expect(variant).toBeVisible();await expect(page.getByRole('button',{name:'View in catalog',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Exercise actions',exact:true})).toHaveCount(0);
 await replace.click();await expect(page.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
 await page.getByRole('combobox',{name:'Exercise',exact:true}).fill('Temporary query');
 await expect(page.locator('.card-name')).toHaveText(fixture.entry.name);
 await page.getByRole('button',{name:'Cancel selection',exact:true}).click();await expect(replace).toBeFocused();
 await expect(page.locator('.card-name')).toHaveText(fixture.entry.name);
 await replace.click();const input=page.getByRole('combobox',{name:'Exercise',exact:true});await input.press('Escape');await input.press('Escape');await expect(replace).toBeFocused();
 await replace.click();await input.fill('Dumbbell lateral raise');await expect(page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first()).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());await input.press('ArrowDown');await input.press('Enter');await expect(input).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await input.press('Enter');await expect(page.locator('.card-name')).toHaveText('Dumbbell lateral raise');
 await variant.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(variant).toBeFocused();
 await expect(page.getByRole('slider',{name:'Sets',exact:true})).toHaveValue('4');await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'View in catalog',exact:true}).click();await expect(page.getByRole('heading',{name:'Exercise catalog',exact:true})).toBeVisible();
 await expect(page.locator('.action-tooltip:popover-open')).toHaveCount(0);
});

test('archived parent blocks inline variant creation and refresh updates restriction without replacing the button',async({page})=>{
 const fixture=await setup(page);const variant=page.getByRole('button',{name:'Create variant',exact:true});
 await page.evaluate(async id=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();const data=await api.catalog();const ref=data.families.find(r=>r.id===id);await api.archiveReference({id,revision:ref.revision,archived:true});},fixture.reference.id);
 await variant.focus();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(variant).toHaveAttribute('aria-disabled','true');await expect(variant).toBeFocused();
 let mutations=0;page.on('request',request=>{if(request.url().includes('/api/catalog')&&request.method()!=='GET')mutations++;});
 await variant.click({force:true});await expect(page.getByRole('tooltip')).toHaveText('Restore the reference exercise before creating a variant.');await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(mutations).toBe(0);
 await page.getByRole('button',{name:/^Collapse exercise: /}).click();await expect(page.locator('.action-tooltip:popover-open')).toHaveCount(0);
 await page.getByRole('button',{name:/^Expand exercise: /}).click();
 await page.evaluate(async id=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();const data=await api.catalog();const ref=data.families.find(r=>r.id===id);await api.archiveReference({id,revision:ref.revision,archived:false});},fixture.reference.id);
 await variant.focus();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(variant).toHaveAttribute('aria-disabled','false');await expect(variant).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
});

for(const kind of ['template','program'])for(const viewport of [{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080},{width:390,height:844},{width:768,height:1024}])test(kind+' inline strip fits populated editor at '+viewport.width,async({page})=>{
 await page.setViewportSize(viewport);await setup(page,kind);
 const buttons=page.locator('.exercise-definition-actions button:visible');await expect(buttons).toHaveCount(3);
 const boxes=await buttons.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};}));
 for(const box of boxes){expect(box.width).toBeGreaterThanOrEqual(viewport.width>=1100?32:44);expect(box.height).toBeGreaterThanOrEqual(viewport.width>=1100?32:44);expect(box.right).toBeLessThanOrEqual(viewport.width);expect(box.y).toBe(boxes[0].y);}
 expect(Math.round(boxes[1].x-boxes[0].right)).toBe(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(viewport.width>=1100)for(const figure of await page.locator('#body-map svg').all())expect((await figure.boundingBox()).height).toBeGreaterThanOrEqual(180);
 await mkdir(screens,{recursive:true});await page.screenshot({path:screens+'/'+kind+'-'+viewport.width+'.png',fullPage:true});
 if(viewport.width<1100){
  await buttons.first().click();await expect(page.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Cancel selection',exact:true}).click();await expect(buttons.first()).toBeFocused();
  await page.screenshot({path:screens+'/'+kind+'-'+viewport.width+'-actions.png'});
 }
});


for(const hasTouch of [false,true])test('200% text and hybrid targets '+hasTouch,async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch,reducedMotion:hasTouch?'reduce':'no-preference'});const page=await context.newPage();
 try{
  await setup(page);await page.addStyleTag({content:'html {font-size:200%}'});await page.evaluate(()=>document.fonts.ready);
  const buttons=page.locator('.exercise-definition-actions button:visible');
  const geometry=await page.locator('.exercise-definition-actions').evaluate(strip=>({y:strip.getBoundingClientRect().y,buttons:[...strip.querySelectorAll('button:not([hidden])')].map(button=>{const r=button.getBoundingClientRect();return {y:r.y,width:r.width,height:r.height};})}));
  for(const b of geometry.buttons){expect(b.width).toBeGreaterThanOrEqual(hasTouch?44:32);expect(b.height).toBeGreaterThanOrEqual(hasTouch?44:32);expect(b.y).toBe(geometry.y);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await buttons.first().focus();await expect(page.getByRole('tooltip')).toHaveText('Replace exercise');await page.keyboard.press('Escape');await expect(page.locator('.action-tooltip:popover-open')).toHaveCount(0);
  await mkdir(screens,{recursive:true});await page.screenshot({path:screens+'/text-200-touch-'+hasTouch+'.png',fullPage:true});
 }finally{await context.close();}
});


