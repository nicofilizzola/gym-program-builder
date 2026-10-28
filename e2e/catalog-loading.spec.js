import {test,expect} from '@playwright/test';
test('search before catalog load expands arriving matches and preserves deliberate collapse on refresh',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const {mountCatalog}=await import('/src/catalog-view.js');document.body.innerHTML='<div id="fixture"></div>';
  const data={families:[{id:'r1',name:'Bench reference',revision:1,archived:false,exerciseType:'compound'}],entries:[{id:'v1',familyId:'r1',name:'Paused bench',equipment:'Barbell',primaryMuscles:['Chest'],secondaryMuscles:[],archived:false,individuallyArchived:false}]};
  const api={catalog:()=>new Promise(resolve=>window.resolveCatalog=()=>resolve(data))};window.catalogView=mountCatalog(document.querySelector('#fixture'),{api});
 });
 await page.getByLabel('Search catalog',{exact:true}).fill('Paused bench');await page.evaluate(()=>window.resolveCatalog());
 const toggle=page.locator('.reference-toggle');await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('button',{name:'Move variant Paused bench to reference exercise',exact:true})).toBeVisible();
 await toggle.click();await page.getByLabel('Show archived',{exact:true}).check();await expect(toggle).toHaveAttribute('aria-expanded','false');
});
