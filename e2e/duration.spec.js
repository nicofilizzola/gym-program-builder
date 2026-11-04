import {answerNextConfirmation} from './confirmation-helper.js';
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
test('compact duration trigger preserves estimate and accessible action',async({page})=>{
 await fixture(page);const toggle=page.locator('.duration-toggle');
 await expect(toggle).not.toContainText('Estimated duration');
 for(const icon of ['clock','chevron'])await expect(toggle.locator('.duration-'+icon)).toHaveAttribute('aria-hidden','true');
 await expect(toggle).toHaveAccessibleDescription('~27 min');
 await toggle.hover();await expect(page.getByRole('tooltip')).toHaveText('Show duration details');
 await page.mouse.move(0,0);await toggle.focus();await expect(page.getByRole('tooltip')).toHaveText('Show duration details');
 await toggle.press('Enter');await expect(toggle).toHaveAccessibleName('Hide duration details');
 await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('duration disclosure animates both directions and reverses in place',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 const details=page.locator('.duration-details'),toggle=page.locator('.duration-toggle');
 const sample=()=>page.evaluate(async()=>{
  const b=document.querySelector('.duration-toggle'),d=document.querySelector('.duration-details'),next=document.querySelector('#exercises');
  const measure=()=>({height:d.getBoundingClientRect().height,top:next.getBoundingClientRect().top});
  const before=measure();b.click();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  await new Promise(resolve=>setTimeout(resolve,65));return {before,middle:measure()};
 });
 await page.evaluate(()=>window.durationSlider=document.querySelector('[data-allowance]'));
 const opening=await sample();await expect(details).toHaveCSS('transition-duration','0.2s, 0.2s');
 await expect(details).toHaveCSS('transition-timing-function','ease-out, ease-out');
 await expect.poll(()=>details.evaluate(d=>d.getAnimations().length)).toBe(0);
 const full=await details.evaluate(d=>d.getBoundingClientRect().height);
 expect(opening.middle.height).toBeGreaterThan(0);expect(opening.middle.height).toBeLessThan(full);
 expect(opening.middle.top).toBeGreaterThan(opening.before.top);
 await expect(toggle.locator('.duration-clock')).toHaveCSS('transform','none');
 await expect(toggle.locator('.duration-chevron')).toHaveCSS('transform','matrix(-1, 0, 0, -1, 0, 0)');
 const closing=await sample();expect(closing.middle.height).toBeGreaterThan(0);expect(closing.middle.height).toBeLessThan(full);
 expect(closing.middle.top).toBeLessThan(closing.before.top);
 await expect.poll(()=>details.evaluate(d=>d.getBoundingClientRect().height)).toBe(0);
 const closedSpacing=await details.evaluate(d=>{
  const header=d.closest('.editor-heading'),before=header.getBoundingClientRect().height;
  d.style.display='none';const without=header.getBoundingClientRect().height;d.style.removeProperty('display');return {before,without};
 });
 expect(closedSpacing.before).toBe(closedSpacing.without);
 await toggle.evaluate(async b=>{b.click();await new Promise(requestAnimationFrame);b.click();await new Promise(requestAnimationFrame);b.click();});
 await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(details).not.toHaveAttribute('inert','');
 expect(await page.evaluate(()=>window.durationSlider===document.querySelector('[data-allowance]'))).toBe(true);
});

test('closing duration details restores focus and excludes sliders during exit',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 const toggle=page.locator('.duration-toggle'),details=page.locator('.duration-details');
 await toggle.press('Enter');await page.getByRole('slider',{name:'Extra time',exact:true}).focus();
 await toggle.evaluate(b=>b.click());await expect(toggle).toBeFocused();
 await expect(details).toHaveAttribute('inert','');await expect(details).toHaveAttribute('aria-hidden','true');
 await page.keyboard.press('Tab');expect(await details.evaluate(d=>d.contains(document.activeElement))).toBe(false);
 await toggle.focus();await toggle.press('Space');await expect(details).toHaveAttribute('aria-hidden','false');
 await page.keyboard.press('Tab');await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toBeFocused();
});

test('duration updates preserve motion and teardown removes tooltips',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 await page.evaluate(async()=>{
  window.timingView.destroy();const {mountDurationControls}=await import('/src/duration-controls.js');
  const host=document.createElement('div');document.querySelector('#app').append(host);
  window.otherTooltipIds=[...document.querySelectorAll('.action-tooltip')].map(t=>t.id);
  window.durationHost=host;window.durationWorkout={exercises:[{sets:3,restSeconds:120}],extraMinutes:5,bufferPercent:10};
  window.durationView=mountDurationControls(host,{workout:window.durationWorkout});
 });
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.duration-toggle').evaluate(b=>b.click());
 await page.evaluate(()=>{
  const slider=window.durationHost.querySelector('[data-allowance]');window.durationSlider=slider;slider.focus();
  window.durationView.update({...window.durationWorkout,extraMinutes:0});
 });
 await expect(page.locator('[data-duration-total]')).toHaveText('~10 min');
 expect(await page.evaluate(()=>window.durationSlider===document.activeElement)).toBe(true);
 await expect(page.locator('.duration-toggle')).toHaveAttribute('aria-expanded','true');
 await page.locator('.duration-toggle').evaluate(b=>b.click());await page.evaluate(()=>window.durationView.destroy());
 await expect(page.locator('.duration-toggle')).toHaveCount(0);
 expect(await page.evaluate(()=>[...document.querySelectorAll('.action-tooltip')].map(t=>t.id))).toEqual(await page.evaluate(()=>window.otherTooltipIds));
 await page.evaluate(async()=>{
  const {mountDurationControls}=await import('/src/duration-controls.js');
  const view=mountDurationControls(window.durationHost,{workout:window.durationWorkout});
  window.durationHost.querySelector('button').click();view.destroy();
 });
 expect(await page.evaluate(()=>[...document.querySelectorAll('.action-tooltip')].map(t=>t.id))).toEqual(await page.evaluate(()=>window.otherTooltipIds));
 expect(errors).toEqual([]);
});

test('duration disclosure respects reduced motion changes',async({page})=>{
 await fixture(page);const toggle=page.locator('.duration-toggle'),details=page.locator('.duration-details');
 await toggle.click();await expect(details).toHaveCSS('transition-duration','0s');
 await expect(toggle.locator('.duration-chevron')).toHaveCSS('transition-duration','0s');
 await toggle.click();expect(await details.evaluate(d=>d.getBoundingClientRect().height)).toBe(0);
 await page.emulateMedia({reducedMotion:'no-preference'});await toggle.click();
 await expect.poll(()=>details.evaluate(d=>d.getAnimations().length)).toBe(0);
 await toggle.evaluate(b=>b.click());await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>details.evaluate(d=>d.getBoundingClientRect().height)).toBe(0);
 await expect(details).toHaveAttribute('inert','');await toggle.click();
 await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toBeVisible();
});

test('duration details and sliders update live without replacing focused controls',async({page})=>{
 await fixture(page);
 await expect(page.locator('[data-duration-total]')).toHaveText('~27 min');
 const toggle=page.locator('.duration-toggle');
 await expect(toggle).toHaveAccessibleDescription('~27 min');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('[data-duration-part="warmupSeconds"]')).toHaveText('0 sec');
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
  await expect(page.locator('.duration-clock')).toBeVisible();
  await expect(page.locator('[data-duration-total]')).toBeVisible();
  await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toBeVisible();
  for(const name of ['Extra time','Buffer']) {
   const allowance=page.getByRole('slider',{name,exact:true});
   await allowance.scrollIntoViewIfNeeded();await allowance.click({trial:true});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const sliders=page.getByRole('slider',{name:'Rest per set',exact:true});
  for(const slider of await sliders.all()) {
   expect((await slider.boundingBox()).height).toBeGreaterThanOrEqual(44);
   expect(await slider.locator('..').locator('..').locator('.slider-head').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  if(width>=1100)for(const body of await page.locator('#body-map svg').all())expect((await body.boundingBox()).height).toBeGreaterThanOrEqual(180);
  await page.screenshot({path:'.superpowers/sdd/2026-10-27-duration-disclosure-polish/session-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
 await expect(page.getByRole('slider',{name:'Extra time',exact:true})).toBeVisible();
 for(const readout of await page.locator('[data-value="restSeconds"]').all()) {
  expect(await readout.evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)+1)).toBe(true);
 }
 await page.screenshot({path:'.superpowers/sdd/2026-10-27-duration-disclosure-polish/session-200pct.png',fullPage:true});
 await page.locator('.duration-toggle').click();
 await expect(page.locator('[data-duration-total]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
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
   await expect(toggle.locator('.duration-clock')).toBeVisible();await expect(toggle.locator('[data-duration-total]')).toBeVisible();
   await toggle.click();await page.getByRole('button',{name:'Expand all',exact:true}).click();
   for(const slider of await page.getByRole('slider').all())expect((await slider.boundingBox()).height).toBeGreaterThanOrEqual(44);
  } finally {await context.close();if(hybrid)await instance.close();}
 }
});

test('program durations survive shared occurrences, editing, schedule moves and file round trips',async({page})=>{
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
 await page.getByRole('combobox',{name:'Session template',exact:true}).selectOption({label:name});
 await page.getByRole('button',{name:'Add template',exact:true}).click();
 const card=title=>page.locator('.workout-item').filter({has:page.getByRole('heading',{name:title,exact:true,level:3})});
 await expect(card(name).locator('[data-workout-duration]')).toHaveText('Estimated duration ~27 min');
 await card(name).locator('.workout-title').click();await expect(page.locator('[data-template-name]')).toBeFocused();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const durationToggle=page.locator('.duration-toggle');
 await expect(durationToggle.locator('.duration-clock')).toBeVisible();
 await durationToggle.press('Enter');
 await expect(page.locator('.duration-details')).toHaveCSS('transition-duration','0.2s, 0.2s');
 await durationToggle.evaluate(async b=>{b.click();await new Promise(requestAnimationFrame);b.click();});
 await page.getByRole('slider',{name:'Extra time',exact:true}).focus();
 await durationToggle.evaluate(b=>b.click());await expect(durationToggle).toBeFocused();
 await expect(page.locator('.duration-details')).toHaveAttribute('inert','');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByLabel('Session template name').fill('Original timed workout');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByRole('slider',{name:'Rest per set',exact:true}).first().fill('0');
 await page.getByRole('button',{name:'Show duration details'}).click();
 await page.getByRole('slider',{name:'Extra time',exact:true}).fill('0');
 await page.getByRole('slider',{name:'Buffer',exact:true}).fill('0');
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();
 await expect(card('Original timed workout').locator('[data-workout-duration]')).toContainText('~11 min');
 await card('Original timed workout').getByRole('button',{name:'Duplicate Original timed workout',exact:true}).click();
 await page.locator('.workout-title').filter({hasText:'Original timed workout'}).last().click();
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByRole('slider',{name:'Rest per set',exact:true}).first().fill('300');
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();
 await expect(page.locator('[data-workout-duration]')).toHaveText(['Estimated duration ~26 min','Estimated duration ~26 min']);
 await page.getByRole('button',{name:'Reorder Original timed workout',exact:true}).first().click();await page.getByRole('button',{name:'Move to Monday',exact:true}).click();
 await page.getByRole('button',{name:'Reorder Original timed workout',exact:true}).last().click();await page.getByRole('button',{name:'Move to Sunday',exact:true}).click();
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(page.locator('[data-workout-duration]')).toHaveText(['Estimated duration ~26 min','Estimated duration ~26 min']);
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[900,900],[390,844]]) {
  await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'.superpowers/sdd/2026-10-29-shared-session-templates/program-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export program',exact:true}).click();
 let text='';for await(const chunk of await (await download).createReadStream())text+=chunk;
 const portable=JSON.parse(text);expect(portable.templates).toHaveLength(1);
 expect(portable.templates[0].template.extraMinutes).toBe(0);expect(portable.templates[0].template.bufferPercent).toBe(0);expect(portable.templates[0].template.exercises[0].restSeconds).toBe(300);
 await answerNextConfirmation(page,true);await page.locator('[data-file]').setInputFiles({name:'timed-week.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await expect(page.locator('[data-workout-duration]')).toHaveText(['Estimated duration ~26 min','Estimated duration ~26 min']);
 const shared=(await (await page.request.get('/api/documents/'+sourceId)).json()).record.document;
 expect(shared.name).toBe('Original timed workout');expect(shared.exercises[0].restSeconds).toBe(300);
});
