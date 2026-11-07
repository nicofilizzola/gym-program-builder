import {openLibrarySection} from './navigation-helper.js';
import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const directory='.superpowers/sdd/2026-10-25-catalog-compact-actions-motion/screens';
async function checkActionStrip(strip,target){
 const boxes=await strip.locator('button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 for(const [i,b]of boxes.entries()){
  expect(b.width).toBe(target);expect(b.height).toBe(target);expect(b.x).toBeGreaterThanOrEqual(4);expect(b.x+b.width).toBeLessThanOrEqual(await strip.page().evaluate(()=>innerWidth)-4);
  if(i){expect(Math.abs(b.y-boxes[0].y)).toBeLessThan(1);expect(b.x-(boxes[i-1].x+boxes[i-1].width)).toBeGreaterThanOrEqual(7.5);}
 }
}
async function populated(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:page.viewportSize().width<=760?'Library':'Exercise catalog',exact:true})).toBeVisible();
 const id=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient(),{entries}=await api.catalog();
  const names=['Barbell bench press','Pull-up','Dumbbell lateral raise','Leg press'];
  const exercises=names.map(name=>{const e=entries.find(e=>e.name===name);return {name:e.name,sets:4,repRange:{min:8,max:12},primaryMuscles:e.primaryMuscles,secondaryMuscles:e.secondaryMuscles,catalogId:e.id,catalogRevision:e.revision,familyId:e.familyId,equipment:e.equipment};});
  return (await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Upper and lower strength',exercises,goals:{Chest:6,Lats:6,Quads:6}}})).id;
 });await page.goto('/#/templates/'+id);await page.getByRole('button',{name:'Expand all',exact:true}).click();await page.evaluate(()=>document.fonts.ready);
}
for(const size of [{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080},{width:768,height:1024},{width:390,height:844}]){
 test('populated catalog picker and form fit '+size.width,async({page})=>{
  await page.setViewportSize(size);await mkdir(directory,{recursive:true});await populated(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await expect(page.locator('.exercise-definition-actions')).toHaveCount(4);
  if(size.width>=1100)for(const body of await page.locator('#body-map svg').all()){const box=await body.boundingBox();expect(box.height).toBeGreaterThanOrEqual(180);}
  await page.screenshot({path:directory+'/editor-'+size.width+'.png',fullPage:true});
  if(size.width===1440){
   const css=await readFile('style.css','utf8'),html=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>');
   await writeFile(directory+'/editor.html',html);
  }
  await page.getByRole('button',{name:'Replace exercise',exact:true}).first().click();
  const input=page.getByRole('combobox',{name:'Exercise',exact:true});await input.fill('press');
  await expect(page.getByRole('listbox',{name:'Exercise suggestions'})).toBeVisible();
  const popup=page.locator('.exercise-options:popover-open');const box=await popup.boundingBox();expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(size.width-7);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
  const controls=await page.locator('.exercise-picker').first().boundingBox();expect(box.y>=controls.y+controls.height||box.y+box.height<=controls.y).toBe(true);
  await page.screenshot({path:directory+'/picker-'+size.width+'.png'});
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Create variant',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).scrollIntoViewIfNeeded();
  const colors=await page.getByRole('dialog').getByRole('group',{name:'Primary muscles',exact:true}).evaluate(group=>({selected:getComputedStyle(group.querySelector('input:checked+span')).backgroundColor,unselected:getComputedStyle(group.querySelector('input:not(:checked)+span')).backgroundColor}));
  expect(colors.selected).not.toBe(colors.unselected);
  expect((await page.getByRole('dialog').getByLabel('Variant name',{exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(size.width>=1100?32:44);
  await page.screenshot({path:directory+'/form-'+size.width+'.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await openLibrarySection(page,'catalog');await expect(page.locator('.reference-group').first()).toBeVisible();
  await expect(page.locator('[data-count]')).toHaveText(/^\d+ reference exercises? \u00b7 \d+ variants?$/);
  expect((await page.getByLabel('Search catalog',{exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(size.width>=1100?32:44);
  await page.screenshot({path:directory+'/catalog-'+size.width+'.png'});
  await page.getByLabel('Search catalog',{exact:true}).fill('Bench press');
  await expect(page.locator('.catalog-row:visible').first()).toBeVisible();
  for(const strip of await page.locator('.reference-header-actions,.reference-variants.is-open .catalog-row-actions').all())await checkActionStrip(strip,size.width>=1100?32:44);
  if(size.width>=1100){
   const row=page.locator('.catalog-row').first(),definition=await row.locator('.catalog-definition').boundingBox(),actions=await row.locator('.catalog-row-actions').boundingBox();expect(actions.x).toBeGreaterThanOrEqual(definition.x+definition.width);expect(actions.y).toBeLessThan(definition.y+definition.height);
  }
  await page.screenshot({path:directory+'/catalog-expanded-'+size.width+'.png'});
  if(size.width===1440){const css=await readFile('style.css','utf8'),html=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>');await writeFile(directory+'/catalog.html',html);}
  const reference=page.locator('.reference-group').filter({has:page.getByText('Barbell Bench press',{exact:true})});
  await reference.getByRole('button',{name:'Edit reference exercise Barbell Bench press',exact:true}).click();
  await page.screenshot({path:directory+'/reference-form-'+size.width+'.png'});await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await reference.locator('.catalog-row:visible').first().getByRole('button',{name:/^Move variant /}).click();
  await page.getByRole('dialog').getByLabel('Destination reference exercise',{exact:true}).selectOption('seed-family-row');
  await page.getByRole('dialog').getByRole('button',{name:'Move variant',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:directory+'/move-form-'+size.width+'.png'});
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 });
}
test('hybrid input and enlarged text preserve catalog controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 try{
  await populated(page);await page.addStyleTag({content:'html {font-size:200%}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  const action=page.getByRole('button',{name:'Create variant',exact:true}).first();expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await action.click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Save variant',exact:true}).scrollIntoViewIfNeeded();
  const button=await dialog.getByRole('button',{name:'Save variant',exact:true}).boundingBox();expect(button.height).toBeGreaterThanOrEqual(44);expect(button.y+button.height).toBeLessThanOrEqual(768);
  await page.screenshot({path:directory+'/hybrid-text-200.png',fullPage:true});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  const referenceName='Long reference '+Date.now()+' '+('Press '.repeat(20));
  await page.evaluate(async name=>{const {createApiClient}=await import('/src/api-client.js');await createApiClient().createReference({equipment:'Barbell',exerciseType:'compound',id:crypto.randomUUID(),name});},referenceName);
  await openLibrarySection(page,'catalog');await page.getByLabel('Search catalog',{exact:true}).fill('Long reference');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  const reference=page.locator('.reference-group').filter({has:page.getByText(referenceName.trim(),{exact:true})});const add=reference.getByRole('button',{name:'Add variant to '+referenceName.trim(),exact:true});expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(44);await add.click();
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).scrollIntoViewIfNeeded();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
   const save=await page.getByRole('dialog').getByRole('button',{name:'Save variant',exact:true}).boundingBox();expect(save.height).toBeGreaterThanOrEqual(44);expect(save.y+save.height).toBeLessThanOrEqual(viewport.height);
   await page.screenshot({path:directory+'/reference-hybrid-text-200-'+viewport.width+'.png',fullPage:true});
  }
 }finally{await context.close();}
});

for(const config of [{width:1366,touch:false},{width:1366,touch:true},{width:390,touch:true}])test('long catalog names and 200% text retain horizontal icon strips '+config.width+' touch '+config.touch,async({browser})=>{
 const context=await browser.newContext({viewport:{width:config.width,height:900},hasTouch:config.touch,reducedMotion:'reduce'}),page=await context.newPage();
 try{
  await populated(page);await mkdir(directory,{recursive:true});
  const names=await page.evaluate(async()=>{
   const {createApiClient}=await import('/src/api-client.js'),{MUSCLE_GROUPS}=await import('/src/muscles.js');const api=createApiClient(),name=('Compact '+crypto.randomUUID()+' Press '.repeat(40)).slice(0,200),variant=('Variant '+crypto.randomUUID()+' Wide '.repeat(40)).slice(0,200),ref=await api.createReference({equipment:'Barbell',exerciseType:'compound',id:crypto.randomUUID(),name});
   await api.createCatalog({id:crypto.randomUUID(),familyId:ref.id,entry:{name:variant,equipment:'Barbell',primaryMuscles:MUSCLE_GROUPS.slice(0,6),secondaryMuscles:MUSCLE_GROUPS.slice(6)}});await api.archiveReference({id:ref.id,revision:2,archived:true});return {name,variant};
  });
  await openLibrarySection(page,'catalog');await page.getByLabel('Show archived',{exact:true}).check();await page.getByLabel('Search catalog',{exact:true}).fill(names.name.slice(0,40));await page.addStyleTag({content:'html {font-size:200%}'});
  const ref=page.locator('.reference-group').filter({has:page.getByText(names.name.trim(),{exact:true})});await expect(ref).toBeVisible();
  if(config.width===390)expect((await ref.locator('.reference-header h2').boundingBox()).width).toBeGreaterThanOrEqual((await ref.boundingBox()).width-1);
  for(const strip of await ref.locator('.reference-header-actions,.catalog-row-actions').all())await checkActionStrip(strip,config.touch||config.width<1100?44:32);
  await page.keyboard.press('Tab');
  for(const button of await ref.locator('[data-catalog-action]').all()){
   await button.focus();await button.scrollIntoViewIfNeeded();await expect(button).toBeFocused();const ring=await button.evaluate(b=>getComputedStyle(b).outlineStyle);expect(ring).not.toBe('none');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(config.width);
  await page.screenshot({path:directory+'/long-text-'+config.width+'-'+config.touch+'.png',fullPage:true});
  const restore=ref.getByRole('button',{name:'Restore reference exercise '+names.name.trim(),exact:true});await restore.focus();await expect(page.getByRole('tooltip')).toHaveText('Restore reference exercise');await page.screenshot({path:directory+'/tooltip-'+config.width+'-'+config.touch+'.png'});
 }finally{await context.close();}
});
