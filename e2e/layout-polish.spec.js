import {test,expect} from '@playwright/test';

async function fixture(page) {
 await page.goto('/');await page.evaluate(async()=>{
  const {mountProgramView}=await import('/src/program-view.js');document.body.innerHTML='<div id="fixture"></div>';
  mountProgramView(document.querySelector('#fixture'),{templates:[],program:{name:'Week',mode:'simple',goals:{},workouts:['Press','Long workout '.repeat(15)].map((name,i)=>({id:'w'+i,name,day:null,goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Front delts']}]}))},onExport:()=>{}});
 });await page.evaluate(()=>document.fonts.ready);
}
test('workout highlight never changes geometry',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 const cards=page.locator('.workout-item'),bounds=()=>cards.evaluateAll(els=>els.map(el=>({y:el.offsetTop,height:el.offsetHeight})));
 const original=await bounds();
 for(const muscle of ['Chest','Front delts']){
  await page.locator(`.volume-row[data-muscle="${muscle}"]`).hover();
  await expect(cards.first().locator('[data-muscle-match]')).toHaveText(`Trains ${muscle}`);expect(await bounds()).toEqual(original);
 }
 await page.mouse.move(0,0);await expect(cards.first()).not.toHaveClass(/is-muscle-match/);expect(await bounds()).toEqual(original);
 await expect(cards.first()).toHaveCSS('transition-duration','0.15s, 0.15s');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(cards.first()).toHaveCSS('transition-duration','0s');
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
 await empty.click();await expect(page.locator('.workout-item')).toHaveCount(3);
});
test('session editor fits 320px with 200 percent text and bulk controls',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<div id="fixture"></div>';mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}});});
 await page.evaluate(()=>document.fonts.ready);await page.setViewportSize({width:320,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 for(const name of ['Expand all','Collapse all','Set goals']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);}
});
