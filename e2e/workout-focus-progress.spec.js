import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function mount(page){
 await mountFocusFixture(page);
 await page.evaluate(async()=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');
  const overview=mountWorkoutOverview({port,onJump:ref=>focusView.jump(ref),onActivity:v=>focusView.suspend(v),onClose:()=>focusView.update(port.read())});
  activity.push=e=>{if(e.type==='overview'){overview.update(port.read(),focusView.visibleRef());overview.open(e.opener);}};
  document.addEventListener('pointerdown',e=>{window.lastPointer=e.pointerId;},true);
  focusView.jump({exerciseId:'straight',setId:'s1'});});
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);// the refit after fonts load settles the feed's scroll position
}
// Segment centres and the strip's box, in viewport coordinates.
const geometry=page=>page.evaluate(()=>({centers:[...document.querySelectorAll('.focus-progress-segment')].map(e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}),strip:document.querySelector('.focus-progress-segments').getBoundingClientRect().toJSON(),width:innerWidth}));
const snapshot=page=>page.evaluate(()=>({ref:focusView.visibleRef(),top:document.querySelector('.focus-feed').scrollTop,dialogs:document.querySelectorAll('dialog[open]').length}));
const bubble=page=>page.locator('.focus-scrub-bubble:popover-open');
async function press(page,from,to){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:Math.max(2,Math.ceil(Math.abs(to.x-from.x)/4))});}
test('the progress row is the overview button',async({page})=>{
 await mount(page);
 const row=page.getByRole('button',{name:'Workout overview, exercise 1 of 4, 0 of 5 working sets'}),dialog=page.getByRole('dialog',{name:'Workout overview'});
 await row.click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(row).toBeFocused();
 await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 const clusters=row.locator('.focus-progress-cluster');await expect(clusters).toHaveCount(2);
 const gaps=await row.evaluate(r=>{const b=[...r.querySelectorAll('.focus-progress-cluster')].map(c=>c.getBoundingClientRect()),s=[...r.querySelectorAll('.focus-progress-cluster')[0].children].map(c=>c.getBoundingClientRect());return {between:b[1].left-b[0].right,within:s[1].left-s[0].right};});
 expect(Math.abs(gaps.between-8)).toBeLessThanOrEqual(.5);expect(Math.abs(gaps.within-3)).toBeLessThanOrEqual(.5);
 expect(await row.evaluate(r=>getComputedStyle(r,'::after').height)).toBe('44px');
 const box=await row.boundingBox();expect(box.height).toBeLessThan(44);
 for(const dy of[-18,0,18])expect(await row.evaluate((r,[x,y])=>r.contains(document.elementFromPoint(x,y)),[box.x+box.width/2,box.y+box.height/2+dy])).toBe(true);
 await page.evaluate(()=>focusView.jump(null));
 await expect(page.getByRole('button',{name:'Workout overview, workout review, 0 of 5 working sets'})).toBeVisible();
});
test('dragging scrubs with a bubble and the release travels there',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(page);const {centers}=await geometry(page),before=await snapshot(page);
 await press(page,centers[0],centers[2]);
 await expect(bubble(page).locator('.focus-scrub-name')).toHaveText('Single-arm incline dumbbell chest press');await expect(bubble(page).locator('.focus-scrub-set')).toHaveText('A1 · Round 1');
 expect((await snapshot(page)).top).toBe(before.top);
 await page.mouse.up();await expect(bubble(page)).toHaveCount(0);await expect(page.locator('dialog[open]')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});
});
test('a scrub clamps at both ends and stays inside the viewport',async({page})=>{
 await mount(page);const {centers,width}=await geometry(page),y=centers[0].y;
 await press(page,centers[2],{x:0,y});
 await expect(bubble(page).locator('.focus-scrub-name')).toHaveText('Bench press');await expect(bubble(page).locator('.focus-scrub-set')).toHaveText('Working set 1 of 2');
 expect((await bubble(page).boundingBox()).x).toBeGreaterThanOrEqual(8);
 await page.mouse.move(width,y,{steps:Math.ceil(width/4)});
 await expect(bubble(page).locator('.focus-scrub-set')).toHaveText('A1 · Round 2 · No partner set this round');
 const box=await bubble(page).boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(width-8);
 await page.mouse.up();
});
test('a far release or a cancel changes nothing',async({page})=>{
 await mount(page);const {centers,strip}=await geometry(page),before=await snapshot(page);
 await press(page,centers[0],centers[3]);await expect(bubble(page)).toHaveCount(1);
 await page.mouse.move(centers[3].x,strip.bottom+60,{steps:5});await page.mouse.up();
 await expect(bubble(page)).toHaveCount(0);await page.waitForTimeout(400);expect(await snapshot(page)).toEqual(before);
 await press(page,centers[0],centers[3]);await expect(bubble(page)).toHaveCount(1);
 await page.evaluate(()=>document.querySelector('.focus-progress').dispatchEvent(new PointerEvent('pointercancel',{pointerId:lastPointer,isPrimary:true,bubbles:true})));
 await expect(bubble(page)).toHaveCount(0);await page.mouse.up();await page.waitForTimeout(400);expect(await snapshot(page)).toEqual(before);
});
test('a scrub cancels a pending Auto-next',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();await mount(page);await page.clock.pauseAt(new Date(Date.now()+60000));
 await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});
 const {centers,strip}=await geometry(page);
 await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await page.clock.runFor(200);
 await press(page,centers[0],centers[3]);await page.mouse.move(centers[3].x,strip.bottom+60,{steps:5});await page.mouse.up();
 await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});
test('lost capture hides the bubble and the next tap still opens the overview',async({page})=>{
 await mount(page);const {centers}=await geometry(page),before=await snapshot(page);
 await press(page,centers[0],centers[3]);await expect(bubble(page)).toHaveCount(1);
 await page.evaluate(()=>document.querySelector('.focus-progress').releasePointerCapture(lastPointer));
 await page.mouse.move(centers[3].x+2,centers[3].y);await expect(bubble(page)).toHaveCount(0);
 await page.mouse.up();await page.waitForTimeout(400);expect(await snapshot(page)).toEqual(before);
 await page.locator('.focus-progress').click();await expect(page.getByRole('dialog',{name:'Workout overview'})).toBeVisible();
});
test('the row does not scroll the page',async({page})=>{
 await mount(page);const row=page.locator('.focus-progress');
 expect(await row.evaluate(r=>getComputedStyle(r).touchAction)).toBe('none');expect(await row.getAttribute('role')).toBeNull();
 await row.focus();await page.keyboard.press('Space');await expect(page.getByRole('dialog',{name:'Workout overview'})).toBeVisible();
});
