import {test,expect} from '@playwright/test';

async function fixture(page) {
 await page.goto('/');await page.evaluate(async()=>{
  const {mountProgramView}=await import('/src/program-view.js');document.body.innerHTML='<div id="fixture"></div>';
  mountProgramView(document.querySelector('#fixture'),{templates:[],program:{name:'Week',mode:'simple',goals:{},workouts:['Press','Long workout '.repeat(15),'Pull'].map((name,i)=>({id:'w'+i,name,day:null,goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:[i===2?'Lats':'Chest'],secondaryMuscles:i===2?['Upper back']:['Front delts']}]}))},onExport:()=>{}});
 });await page.evaluate(()=>document.fonts.ready);
}
test('workout highlight never changes geometry',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 const cards=page.locator('.workout-item');
 const bounds=()=>cards.evaluateAll(els=>els.flatMap(el=>[el,...el.querySelectorAll('button')].map(node=>({x:node.offsetLeft,y:node.offsetTop,width:node.offsetWidth,height:node.offsetHeight}))));
 for(const width of [1280,375,320]){
  await page.setViewportSize({width,height:1000});
  const original=await bounds();
  await page.locator('.volume-row[data-muscle="Chest"]').hover();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  for(const muscle of ['Chest','Front delts','Upper back']){
   await page.locator(`.volume-row[data-muscle="${muscle}"]`).click();
   await expect(page.locator('.workout-item.is-muscle-match [data-muscle-match]').first()).toHaveText(`Trains ${muscle}`);
   expect(await bounds()).toEqual(original);
  }
  await page.locator('.volume-row[data-muscle="Upper back"]').click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  expect(await bounds()).toEqual(original);
 }
 await expect(cards.first()).toHaveCSS('transition-duration','0.2s, 0.2s, 0.2s');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(cards.first()).toHaveCSS('transition-duration','0s');
});

test('workout surfaces, selected emphasis and badge match the exercise card',async({page})=>{
 await fixture(page);
 // A CSS reference card avoids mounting a second panel with duplicate element IDs.
 await page.evaluate(()=>{
  const reference=document.createElement('article');reference.className='exercise';reference.id='card-reference';
  reference.innerHTML='<span class="hit-tag">primary · Chest</span>';document.body.append(reference);
 });
 const card=page.locator('.workout-item').first(),reference=page.locator('#card-reference');
 const appearance=locator=>locator.evaluate(el=>{
  const css=getComputedStyle(el);return {background:css.backgroundColor,border:css.borderColor,left:css.borderLeftWidth,radius:css.borderRadius,shadow:css.boxShadow};
 });
 expect(await appearance(card)).toEqual(await appearance(reference));
 await page.locator('.volume-row[data-muscle="Chest"]').click();
 await reference.evaluate(el=>el.dataset.hit='primary');
 expect(await appearance(card)).toEqual(await appearance(reference));
 const badgeStyle=locator=>locator.evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,color:c.color,radius:c.borderRadius,fontSize:c.fontSize,padding:c.padding};});
 expect(await badgeStyle(card.locator('[data-muscle-match]'))).toEqual(await badgeStyle(reference.locator('.hit-tag')));
 await expect(page.locator('.workout-item').last()).toHaveCSS('opacity','0.45');
 await expect(card.locator('[data-muscle-match]')).toHaveAttribute('aria-hidden','false');
 await page.locator('.volume-row[data-muscle="Chest"]').click();
 await expect(page.locator('.workout-item').last()).toHaveCSS('opacity','1');
 await expect(card.locator('[data-muscle-match]')).toHaveAttribute('aria-hidden','true');
 await page.locator('#card-reference').evaluate(el=>el.remove());
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:1000});
  await page.screenshot({path:`.superpowers/sdd/2026-10-24-muscle-interaction-consistency/neutral-${width}.png`,fullPage:true});
  await page.locator('.volume-row[data-muscle="Chest"]').click();
  await page.screenshot({path:`.superpowers/sdd/2026-10-24-muscle-interaction-consistency/selected-${width}.png`,fullPage:true});
  await page.locator('.volume-row[data-muscle="Chest"]').click();
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 const localGeometry=()=>page.locator('.workout-item').evaluateAll(els=>els.map(el=>({
  height:el.getBoundingClientRect().height,
  controls:[...el.querySelectorAll('button')].map(button=>({x:button.getBoundingClientRect().x-el.getBoundingClientRect().x,y:button.getBoundingClientRect().y-el.getBoundingClientRect().y}))
 })));
 for(const width of [375,320]){
  await page.setViewportSize({width,height:1000});
  const original=await localGeometry();
  for(const muscle of ['Front delts','Upper back']){
   await page.locator(`.volume-row[data-muscle="${muscle}"]`).click();
   const badge=page.locator('.workout-item.is-muscle-match [data-muscle-match]').first();
   await expect(badge).toHaveText(`Trains ${muscle}`);
   expect(await badge.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   // The panel above may grow beyond its two reserved readout lines at enlarged text.
   expect(await localGeometry()).toEqual(original);
  }
  await page.locator('.volume-row[data-muscle="Upper back"]').click();
 }
});
test('compact add alternatives wrap without overflow or small targets',async({page})=>{
 await fixture(page);const add=page.getByRole('button',{name:'Add template',exact:true}),empty=page.getByRole('button',{name:'Empty workout',exact:true});
 await expect(add).toBeDisabled();await expect(empty).toBeEnabled();await expect(page.locator('.add-alternative')).toHaveText('or');
 for(const width of [1280,768,375,320]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for(const button of [add,empty]){const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}
  if(width===1280){const a=await add.boundingBox(),b=await empty.boundingBox();expect(Math.abs(a.y-b.y)).toBeLessThan(1);}
  if(width===1280||width===375)await page.screenshot({path:`.superpowers/sdd/2026-10-24-interaction-polish/program-${width}.png`,fullPage:true});
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 await empty.click();await expect(page.locator('.workout-item')).toHaveCount(4);
});
test('session editor fits 320px with 200 percent text and bulk controls',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<div id="fixture"></div>';mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}});});
 await page.evaluate(()=>document.fonts.ready);await page.setViewportSize({width:320,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 for(const name of ['Expand all','Collapse all','Set goals']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);}
});
