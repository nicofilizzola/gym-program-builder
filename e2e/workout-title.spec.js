import {test,expect} from '@playwright/test';
test.use({reducedMotion:'no-preference'});
const long='Single-arm incline dumbbell chest press';
async function mount(page,text=long){
 await page.goto('/');await page.evaluate(async text=>{
  const {mountWorkoutTitle}=await import('/src/workout-title.js');
  document.body.innerHTML='<h2 id="title" style="width:280px;font:600 28px/1.2 system-ui;margin:20px"></h2>';
  window.widget=mountWorkoutTitle(document.querySelector('h2'),{text,active:true,onInteraction:()=>{}});
 },text);
}
const transform=page=>page.locator('.workout-title-track').evaluate(el=>getComputedStyle(el).transform);
test('short title is stationary and has no extra button',async({page})=>{
 await mount(page,'Bench press');await expect(page.getByRole('heading',{name:'Bench press',exact:true})).toBeVisible();
 await expect(page.getByRole('button')).toHaveCount(0);await expect(page.locator('.titlepause')).toHaveCount(0);
 const initial=await transform(page);await page.waitForTimeout(200);expect(await transform(page)).toBe(initial);
});
test('tap pauses and resumes without a separate play button',async({page})=>{
 await mount(page);const control=page.locator('.workout-title-control'),initial=await transform(page);
 await expect.poll(()=>transform(page),{timeout:6000}).not.toBe(initial);
 await control.click();await expect(control).toHaveAttribute('aria-pressed','true');const held=await transform(page);await page.waitForTimeout(200);expect(await transform(page)).toBe(held);
 await control.press('Enter');await expect(control).toHaveAttribute('aria-pressed','false');await expect.poll(()=>transform(page)).not.toBe(held);
 expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
});
test('horizontal drag reads manually and never also toggles pause',async({page})=>{
 await mount(page);const control=page.locator('.workout-title-control');await control.click();const before=await transform(page),box=await control.boundingBox();
 await page.mouse.move(box.x+180,box.y+20);await page.mouse.down();await page.mouse.move(box.x+70,box.y+20,{steps:8});await page.mouse.up();
 expect(await transform(page)).not.toBe(before);await expect(control).toHaveAttribute('aria-pressed','true');
 await control.dispatchEvent('pointerdown',{pointerId:9,isPrimary:true,button:0,clientX:50,clientY:30});await control.dispatchEvent('pointermove',{pointerId:9,isPrimary:true,clientX:52,clientY:80});await control.dispatchEvent('pointercancel',{pointerId:9});await control.dispatchEvent('click',{detail:1});await expect(control).toHaveAttribute('aria-pressed','true');
});
test('reduced motion is static but arrow keys still reveal the title',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await mount(page);const control=page.locator('.workout-title-control');const before=await transform(page);await page.waitForTimeout(200);expect(await transform(page)).toBe(before);
 await control.focus();await control.press('ArrowRight');expect(await transform(page)).not.toBe(before);
 await control.press('Home');expect(await transform(page)).toBe(before);
});
test('suspension and visibility stop animation and cleanup preserves the heading',async({page})=>{
 await mount(page);await page.evaluate(()=>widget.update({suspended:true}));const held=await transform(page);await page.waitForTimeout(200);expect(await transform(page)).toBe(held);
 await page.evaluate(()=>widget.update({text:'<img src=x>',active:false,suspended:false}));await expect(page.locator('h2 img')).toHaveCount(0);
 await page.evaluate(()=>widget.destroy());await expect(page.locator('h2')).toHaveText('<img src=x>');await expect(page.locator('.workout-title-control')).toHaveCount(0);
});
test('fitting after resize removes interaction and long unbroken names remain readable',async({page})=>{
 await mount(page,'VeryLongUnbrokenExerciseNameThatStillNeedsToBeRead');
 await expect(page.getByRole('button')).toHaveCount(1);
 await page.evaluate(()=>document.querySelector('h2').style.width='1600px');await expect(page.getByRole('button')).toHaveCount(0);
 await page.evaluate(()=>document.querySelector('h2').style.width='280px');await expect(page.getByRole('button')).toHaveCount(1);
});
test('loop wraps continuously after a full period and inactive titles stop',async({page})=>{
 await page.clock.install();await mount(page,'Long exercise');await page.evaluate(()=>document.querySelector('h2').style.width='100px');await page.clock.runFor(32);
 const period=await page.locator('.workout-title-copy').first().evaluate(el=>el.getBoundingClientRect().width+48);
 await page.clock.runFor(1400+Math.ceil(period/22*1000)+1000);
 const x=await page.locator('.workout-title-track').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
 expect(x).toBeLessThan(-10);expect(x).toBeGreaterThan(-40);
 await page.evaluate(()=>widget.update({active:false}));const held=await transform(page);await page.clock.runFor(3000);expect(await transform(page)).toBe(held);
});
