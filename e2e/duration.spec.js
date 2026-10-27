import {test,expect} from '@playwright/test';

async function signIn(page) {
 await page.goto('/');
 await page.waitForFunction(()=>!document.querySelector('#shell').hidden||document.querySelector('input[name="password"]'));
 if(await page.getByLabel('Password',{exact:true}).isVisible()) {
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
 }
 await expect(page.locator('#shell')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
}
async function fixture(page,empty=false) {
 await signIn(page);
 await page.evaluate(async empty=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  const ex=(name,restSeconds,muscle)=>({name,sets:3,restSeconds,repRange:{min:8,max:12},primaryMuscles:[muscle],secondaryMuscles:[]});
  window.timingView=mountSessionEditor(document.querySelector('#app'),{workout:{name:'Upper',goals:{},exercises:empty?[]:[ex('Bench',180,'Chest'),ex('Curl',90,'Biceps')],extraMinutes:5,bufferPercent:10},onChange:w=>window.timingChanged=w});
  await document.fonts.ready;
 },empty);
}
test('duration details and sliders update live without replacing focused controls',async({page})=>{
 await fixture(page);
 await expect(page.locator('[data-duration-total]')).toHaveText('~27 min');
 const toggle=page.locator('.duration-toggle');
 await expect(toggle).toHaveAccessibleDescription('~27 min');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('[data-duration-part="executionSeconds"]')).toHaveText('6 min');
 await expect(page.locator('[data-duration-part="restSeconds"]')).toHaveText('13 min 30 sec');
 await expect(page.locator('[data-duration-part="bufferSeconds"]')).toHaveText('2 min 27 sec');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 const rest=page.getByRole('slider',{name:'Rest per set',exact:true}).first();
 await expect(rest).toHaveAttribute('min','0');await expect(rest).toHaveAttribute('max','300');await expect(rest).toHaveAttribute('step','15');
 await rest.focus();await page.keyboard.press('Home');
 await expect(rest).toBeFocused();await expect(rest).toHaveValue('0');
 await expect(page.locator('[data-duration-total]')).toHaveText('~18 min');
 const extra=page.getByRole('slider',{name:'Extra time',exact:true}),buffer=page.getByRole('slider',{name:'Buffer',exact:true});
 await expect(extra).toHaveAttribute('max','60');await expect(extra).toHaveAttribute('step','1');
 await expect(buffer).toHaveAttribute('max','50');await expect(buffer).toHaveAttribute('step','5');
 await extra.fill('0');await buffer.focus();await page.keyboard.press('Home');
 await expect(buffer).toBeFocused();await expect(page.locator('[data-duration-total]')).toHaveText('~11 min');
 await page.getByRole('slider',{name:'Sets',exact:true}).first().fill('4');
 await expect(page.locator('[data-duration-total]')).toHaveText('~12 min');
 await rest.focus();await page.keyboard.press('ArrowRight');await expect(rest).toHaveValue('15');
 await expect(rest).toHaveAttribute('aria-valuetext','15 sec');
 await page.keyboard.press('End');await expect(rest).toHaveValue('300');
 await expect(page.locator('[data-duration-total]')).toHaveText('~32 min');
 await page.getByRole('button',{name:'Collapse all',exact:true}).click();
 await expect(page.locator('[data-summary]').first()).toContainText('Rest 5 min');
 await page.getByRole('button',{name:'Hide duration details',exact:true}).click();
 await expect(page.getByRole('button',{name:'Show duration details',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>window.timingChanged.exercises[0].restSeconds)).toBe(300);
});
test('empty workout stores allowances and unfinished exercises count immediately',async({page})=>{
 await fixture(page,true);
 await expect(page.locator('[data-duration-total]')).toHaveText('~0 min');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await page.getByRole('slider',{name:'Extra time',exact:true}).fill('10');
 await expect(page.locator('[data-duration-total]')).toHaveText('~0 min');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await expect(page.locator('[data-duration-total]')).toHaveText('~21 min');
 await expect(page.getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('120');
});

test('populated duration controls reflow at desktop, tablet, mobile and enlarged text',async({page})=>{
 test.setTimeout(90000);
 await fixture(page);
 await page.getByRole('button',{name:'Show duration details'}).click();
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByLabel('Session template name').fill('Upper body with a deliberately long training session name');
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[900,900],[760,900],[390,844]]) {
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const sliders=page.getByRole('slider',{name:'Rest per set',exact:true});
  for(const slider of await sliders.all()) {
   expect((await slider.boundingBox()).height).toBeGreaterThanOrEqual(44);
   expect(await slider.locator('..').locator('..').locator('.slider-head').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  if(width>=1100)for(const body of await page.locator('#body-map svg').all())expect((await body.boundingBox()).height).toBeGreaterThanOrEqual(180);
  await page.screenshot({path:'.superpowers/sdd/2026-10-25-workout-duration/session-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
 await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toBeVisible();
 for(const readout of await page.locator('[data-value="restSeconds"]').all()) {
  expect(await readout.evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)+1)).toBe(true);
 }
 await page.screenshot({path:'.superpowers/sdd/2026-10-25-workout-duration/session-200pct.png',fullPage:true});
});

test('duration controls retain touch targets on coarse and hybrid desktops',async({browser})=>{
 for(const hybrid of [false,true]) {
  const instance=hybrid?await browser.browserType().launch({args:['--blink-settings=availablePointerTypes=6,primaryPointerType=4']}):browser;
  const context=await instance.newContext({hasTouch:!hybrid,viewport:{width:1366,height:768},reducedMotion:'reduce'});
  try {
   const page=await context.newPage();await fixture(page);
   if(hybrid)expect(await page.evaluate(()=>matchMedia('(pointer:fine)').matches&&matchMedia('(any-pointer:coarse)').matches)).toBe(true);
   const toggle=page.locator('.duration-toggle'),box=await toggle.boundingBox();
   expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   await toggle.click();await page.getByRole('button',{name:'Expand all',exact:true}).click();
   for(const slider of await page.getByRole('slider').all())expect((await slider.boundingBox()).height).toBeGreaterThanOrEqual(44);
  } finally {await context.close();if(hybrid)await instance.close();}
 }
});

test('program durations survive independent copies, editing, schedule moves and file round trips',async({page})=>{
 test.setTimeout(90000);
 await signIn(page);
 const name='Timed source '+crypto.randomUUID();
 const source={name,extraMinutes:5,bufferPercent:10,goals:{},exercises:[
  {name:'Bench',sets:3,restSeconds:180,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]},
  {name:'Curl',sets:3,restSeconds:90,repRange:{min:8,max:12},primaryMuscles:['Biceps'],secondaryMuscles:[]},
 ]};
 const created=await page.request.post('/api/documents',{headers:{origin:'http://127.0.0.1:3199'},data:{id:crypto.randomUUID(),kind:'template',document:source}});
 expect(created.ok()).toBeTruthy();const sourceId=(await created.json()).record.id;
 await page.getByRole('button',{name:'New program',exact:true}).click();
 await page.getByLabel('Program name',{exact:true}).fill('Timed week');
 await page.getByLabel('Session template to copy').selectOption({label:name});
 await page.getByRole('button',{name:'Add template',exact:true}).click();
 const card=title=>page.locator('.workout-item').filter({has:page.getByRole('heading',{name:title,exact:true,level:3})});
 await expect(card(name).locator('[data-workout-duration]')).toHaveText('Estimated duration ~27 min');
 await card(name).getByRole('button',{name:'Edit '+name,exact:true}).click();
 await page.getByLabel('Session template name').fill('Original timed workout');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByRole('slider',{name:'Rest per set',exact:true}).first().fill('0');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await page.getByRole('slider',{name:'Extra time',exact:true}).fill('0');
 await page.getByRole('slider',{name:'Buffer',exact:true}).fill('0');
 await page.getByRole('button',{name:'Back to program',exact:true}).click();
 await expect(card('Original timed workout').locator('[data-workout-duration]')).toContainText('~11 min');
 await card('Original timed workout').getByRole('button',{name:'Duplicate Original timed workout',exact:true}).click();
 await page.getByRole('button',{name:'Edit Original timed workout',exact:true}).last().click();
 await page.getByLabel('Session template name').fill('Duplicate timed workout');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByRole('slider',{name:'Rest per set',exact:true}).first().fill('300');
 await page.getByRole('button',{name:'Back to program',exact:true}).click();
 await expect(card('Duplicate timed workout').locator('[data-workout-duration]')).toContainText('~26 min');
 await expect(card('Original timed workout').locator('[data-workout-duration]')).toContainText('~11 min');
 await card('Duplicate timed workout').getByRole('button',{name:'Reorder Duplicate timed workout',exact:true}).focus();await page.keyboard.press('ArrowUp');
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await card('Original timed workout').getByRole('button',{name:'Reorder Original timed workout',exact:true}).click();await page.getByRole('button',{name:'Move to Monday',exact:true}).click();
 await card('Duplicate timed workout').getByRole('button',{name:'Reorder Duplicate timed workout',exact:true}).click();await page.getByRole('button',{name:'Move to Sunday',exact:true}).click();
 await card('Duplicate timed workout').getByRole('button',{name:'Reorder Duplicate timed workout',exact:true}).click();await page.getByRole('button',{name:'Move to Unscheduled',exact:true}).click();
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(card('Duplicate timed workout').locator('[data-workout-duration]')).toContainText('~26 min');
 await expect(page.locator('[data-sort-group="0"] h3')).toHaveText('Original timed workout');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();
 await expect(card('Original timed workout').locator('[data-workout-duration]')).toContainText('~11 min');
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[900,900],[390,844]]) {
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'.superpowers/sdd/2026-10-25-workout-duration/program-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export program',exact:true}).click();
 let text='';for await(const chunk of await (await download).createReadStream())text+=chunk;
 const portable=JSON.parse(text),original=portable.program.workouts.find(w=>w.name==='Original timed workout');
 expect(original.extraMinutes).toBe(0);expect(original.bufferPercent).toBe(0);expect(original.exercises[0].restSeconds).toBe(0);
 expect(portable.program.workouts.find(w=>w.name==='Duplicate timed workout').exercises[0].restSeconds).toBe(300);
 page.once('dialog',d=>d.accept());
 await page.locator('[data-file]').setInputFiles({name:'timed-week.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(card('Duplicate timed workout').locator('[data-workout-duration]')).toContainText('~26 min');
 const unchanged=(await (await page.request.get('/api/documents/'+sourceId)).json()).record.document;
 expect(unchanged).toEqual(source);
});
