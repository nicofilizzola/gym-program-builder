import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
async function load(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient(),suffix=crypto.randomUUID();
  const ref=await api.createReference({id:crypto.randomUUID(),name:'Info reference '+suffix,exerciseType:'compound',equipment:'Barbell',description:'Reference notes <img onerror="bad">'});
  const brand=await api.createTag({id:crypto.randomUUID(),kind:'brand',name:'Brand '+suffix});const focusTags=[];
  for(let i=0;i<6;i++)focusTags.push(await api.createTag({id:crypto.randomUUID(),kind:'focus',name:'Long upper chest focus '+i+' '+suffix}));
  const variants=[];for(let i=0;i<2;i++)variants.push(await api.createCatalog({id:crypto.randomUUID(),familyId:ref.id,entry:{name:'Info press '+i+' '+suffix,primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],description:i?'Different technique':'Pause and breathe '+('Longdescription '.repeat(110)),brandId:brand.id,focusTagIds:focusTags.map(t=>t.id)}}));
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Information session',goals:{},exercises:variants.map(v=>({name:v.name,sets:4,restSeconds:45,repRange:{min:8,max:12},primaryMuscles:v.primaryMuscles,secondaryMuscles:v.secondaryMuscles,catalogId:v.id,catalogRevision:v.revision,familyId:ref.id,equipment:v.equipment}))}});
  return {template,variants};
 });
 await page.goto('/#/templates/'+fixture.template.id);await page.getByRole('button',{name:'Expand all',exact:true}).click();return fixture;
}
test('exercise info supports focus pin outside Escape and rapid reversal without stale content',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});const fixture=await load(page),first=page.getByRole('button',{name:'About '+fixture.variants[0].name,exact:true}),second=page.getByRole('button',{name:'About '+fixture.variants[1].name,exact:true});
 await first.focus();const tip=page.getByRole('tooltip').filter({hasText:'Pause and breathe'});await expect(tip).toBeVisible();await expect(first).toHaveAttribute('aria-expanded','true');await expect(tip).toContainText('Reference notes <img onerror="bad">');await expect(page.locator('img')).toHaveCount(0);
 await first.click();await page.getByLabel('Session template name').evaluate(el=>el.focus({preventScroll:true}));await expect(tip).toBeVisible();await page.keyboard.press('Escape');await expect(tip).toBeHidden();
 await first.click();await first.evaluate(b=>{b.click();b.click();});await expect(first).toHaveAttribute('aria-expanded','true');await expect(tip).toBeVisible();
 await second.hover();await expect(page.getByRole('tooltip')).toHaveCount(1);await expect(page.getByRole('tooltip')).toContainText('Different technique');
 await page.getByRole('heading',{name:'Session template',exact:true}).click();await expect(page.getByRole('tooltip')).toBeHidden();
 await page.emulateMedia({reducedMotion:'reduce'});await first.click();await page.keyboard.press('Escape');await expect(first).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'Collapse all',exact:true}).click();await expect(first).toBeVisible();await expect(page.locator('.exercise').first().locator('[data-variant-metadata]')).toContainText('Focus: Long upper chest');
});
test('long descriptions and tags fit populated desktop mobile text and touch layouts',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
 try{const fixture=await load(page);for(const [width,height]of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,600]]){
  await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const info=page.getByRole('button',{name:'About '+fixture.variants[0].name,exact:true});const box=await info.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  if(width>=1100){const figures=page.locator('#body-map svg');await expect(figures).toHaveCount(2);for(const figure of await figures.all()){const b=await figure.boundingBox();expect(b.height).toBeGreaterThanOrEqual(180);}}
  if(width===1440){
   const html=await page.evaluate(()=>{const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script,link[rel=stylesheet][href="style.css"]').forEach(node=>node.remove());const original=[...document.querySelectorAll('input,textarea,select')];clone.querySelectorAll('input,textarea,select').forEach((node,i)=>{const value=original[i];if(node.tagName==='TEXTAREA')node.textContent=value.value;else if(node.tagName==='SELECT')for(const option of node.options)option.toggleAttribute('selected',option.value===value.value);else{node.setAttribute('value',value.value);node.toggleAttribute('checked',value.checked);}});clone.querySelector('#auth')?.remove();return '<!doctype html>'+clone.outerHTML;});
   const directory='.superpowers/sdd/2026-10-29-catalog-metadata-navigation/inspection';await mkdir(directory,{recursive:true});await writeFile(directory+'/populated-session.html',html.replace('</head>','<style>'+await readFile('style.css','utf8')+'</style></head>'));
  }
  await page.screenshot({path:'.superpowers/sdd/2026-10-29-catalog-metadata-navigation/screens/metadata-'+width+'.png',fullPage:true});
 }
 const info=page.getByRole('button',{name:'About '+fixture.variants[0].name,exact:true});await info.tap();const tip=page.getByRole('tooltip');await expect(tip).toBeVisible();const box=await tip.boundingBox();expect(box.x).toBeGreaterThanOrEqual(8);expect(box.y).toBeGreaterThanOrEqual(8);expect(box.y+box.height).toBeLessThanOrEqual(592);
 await tip.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(tip).toBeVisible();await page.keyboard.press('Escape');
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 }finally{await context.close();}
});
