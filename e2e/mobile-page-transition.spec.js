import {test,expect} from '@playwright/test';
test.use({viewport:{width:400,height:844},hasTouch:true,reducedMotion:'no-preference'});
async function mount(page){
 await page.goto('/');await page.evaluate(async()=>{
  document.body.innerHTML='<div id="fixture-app"><h1>Source</h1><input id="source" value="unchanged"><span id="live" role="status" aria-live="polite" data-testid="live">Saved</span></div><div id="mobile-page-stage" class="mobile-page-stage" inert aria-hidden="true" hidden></div>';
  const {createMobilePageTransition}=await import('/src/mobile-page-transition.js');
  window.source=document.querySelector('#source');window.moves=[];
  window.pager=createMobilePageTransition({app:document.querySelector('#fixture-app'),stage:document.querySelector('#mobile-page-stage'),navigation:{preview:v=>window.moves.push(v),resetPreview:()=>{}},media:matchMedia('(max-width:760px)'),reduced:matchMedia('(prefers-reduced-motion:reduce)')});
  window.pager.begin({fromHash:'#/home',toHash:'#/programs',direction:'next',width:innerWidth});
 });
}
test('progress moves inert content previews without semantic duplicates and rollback keeps source',async({page})=>{
 await mount(page);await page.evaluate(()=>window.pager.update(-200));
 const source=page.locator('[data-page-layer=source]'),target=page.locator('[data-page-layer=target]');
 expect(await source.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(-200);
 expect(await target.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(200);
 await expect(page.locator('#mobile-page-stage [id], #mobile-page-stage [aria-live], #mobile-page-stage [data-testid]')).toHaveCount(0);
 await expect(target).toContainText('Library');await expect(target).toContainText('Loading');
 await page.evaluate(()=>window.pager.rollback());
 expect(await page.evaluate(()=>window.source===document.querySelector('#source'))).toBe(true);
 await expect(page.locator('#mobile-page-stage')).toBeHidden();
});
test('completion and cancellation guard commit focus and reduced motion',async({page})=>{
 await mount(page);
 expect(await page.evaluate(async()=>{
  let called=false;await window.pager.complete({commit:()=>called=true,restore:()=>{},focus:()=>{},isCurrent:()=>false});return called;
 })).toBe(false);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{window.pager.begin({fromHash:'#/home',toHash:'#/user',direction:'next',width:innerWidth});window.pager.update(-120);});
 await expect(page.locator('#mobile-page-stage')).toBeHidden();
 expect(await page.evaluate(async()=>{
  let committed=false;await window.pager.complete({commit:()=>committed=true,restore:()=>{},focus:()=>{},isCurrent:()=>true});return committed;
 })).toBe(true);
 expect(await page.locator('#mobile-page-stage').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
});
test('resizing inside the mobile breakpoint cancels an unfinished drag',async({page})=>{
 await mount(page);await page.evaluate(()=>window.pager.update(-100));
 await expect(page.locator('#mobile-page-stage')).toBeVisible();
 await page.setViewportSize({width:390,height:800});
 await expect(page.locator('#mobile-page-stage')).toBeHidden();
 expect(await page.evaluate(()=>window.source===document.querySelector('#source'))).toBe(true);
});
