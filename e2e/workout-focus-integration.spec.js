import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';
import {dragDestination} from './mobile-swipe-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function start(page){await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Focus integration');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();const log=createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();return log;}
test('mobile active uses Focus with four destinations and desktop uses compact',async({page})=>{
 const log=await start(page);await expect(page.locator('nav[aria-label="Main"] a:visible')).toHaveCount(4);await expect(page.getByRole('link',{name:'History',exact:true})).toHaveAttribute('aria-current','page');await expect(page.locator('.workout-bar:visible')).toHaveCount(0);
 const feed=page.locator('.focus-feed');await expect(feed).toHaveCSS('scroll-snap-type','y mandatory');const box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox(),nav=await page.getByRole('link',{name:'History',exact:true}).boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(toolbar.y+1);expect(toolbar.y+toolbar.height).toBeLessThanOrEqual(nav.y+1);
 await page.setViewportSize({width:761,height:844});await expect(page.locator('.workout-focus')).toBeHidden();await expect(page.getByLabel(`Set 1 reps, ${log.exercises[0].name}`,{exact:true})).toBeVisible();await page.setViewportSize({width:760,height:844});await expect(page.locator('.workout-focus')).toBeVisible();
});
test('breakpoint preserves invalid drafts and the exact focused input and caret',async({page})=>{
 const log=await start(page),input=page.getByLabel(`Set 1 weight, ${log.exercises[0].name}`,{exact:true});await input.fill('82.3');await input.evaluate(n=>{window.testInput=n;n.setSelectionRange(1,3);});await page.setViewportSize({width:761,height:844});await expect(input).toBeFocused();await expect(input).toHaveValue('82.3');await page.setViewportSize({width:760,height:844});await expect(input).toBeFocused();expect(await input.evaluate(n=>({same:n===window.testInput,start:n.selectionStart,end:n.selectionEnd}))).toEqual({same:true,start:1,end:3});
});
test('breakpoint retains a composing exercise note and shared workout note',async({page})=>{
 const log=await start(page);await page.getByRole('button',{name:`Add exercise note, ${log.exercises[0].name}`,exact:true}).first().click();const note=page.getByRole('textbox',{name:`Note, ${log.exercises[0].name}`,exact:true});await note.fill('Slow descent');await note.evaluate(n=>{window.testNote=n;n.setSelectionRange(2,5);n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});await page.setViewportSize({width:761,height:844});await expect(note).toBeFocused();await page.setViewportSize({width:760,height:844});await expect(note).toBeFocused();expect(await note.evaluate(n=>({same:n===window.testNote,start:n.selectionStart,end:n.selectionEnd}))).toEqual({same:true,start:2,end:5});await page.getByRole('button',{name:'Workout actions',exact:true}).click();await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeVisible();
});
test('Auto-next off survives route reentry without changing the saved log',async({page})=>{
 const log=await start(page);await page.getByLabel('Auto-next',{exact:true}).uncheck();await page.getByRole('link',{name:'History',exact:true}).click();await page.evaluate(id=>{location.hash='/workouts/'+id;},log.id);await expect(page.getByLabel('Auto-next',{exact:true})).not.toBeChecked();const {record}=await (await page.request.get('/api/workouts/'+log.id)).json();expect(record.log).not.toHaveProperty('autoNext');
});
test('feed re-measures without losing the viewed set',async({page})=>{
 await start(page);const feed=page.locator('.focus-feed');const anchored=()=>feed.evaluate(f=>{const rows=[...f.querySelectorAll(':scope>.log-set')];return {index:rows.findIndex(r=>Math.abs(r.offsetTop-f.scrollTop)<2),snapped:!f.classList.contains('is-unsnapped')};});
 await feed.evaluate(f=>{const row=f.querySelectorAll(':scope>.log-set')[2];f.scrollTo({top:row.offsetTop,behavior:'instant'});});await expect.poll(anchored).toEqual({index:2,snapped:true});
 await page.setViewportSize({width:390,height:700});await expect.poll(anchored).toEqual({index:2,snapped:true});
 // The logger re-measures on the next frame after a resize; wait for it instead of reading once.
 await expect.poll(async()=>{const box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox(),nav=await page.getByRole('link',{name:'History',exact:true}).boundingBox();return box.y+box.height<=toolbar.y+1&&toolbar.y+toolbar.height<=nav.y+1;}).toBe(true);
 await page.setViewportSize({width:761,height:700});await page.setViewportSize({width:760,height:700});await expect.poll(anchored).toEqual({index:2,snapped:true});
});
test('a long workout note leaves the feed the space under the sticky header',async({page})=>{
 const log=await start(page);const initial=(await page.locator('.focus-feed').boundingBox()).height;await page.getByRole('button',{name:'Workout actions',exact:true}).click();await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 // In Focus the note only occupies the page while it is being edited.
 const note=page.getByRole('textbox',{name:'Workout note',exact:true});await note.fill('Long workout context with line breaks.\n'.repeat(45));
 const feed=page.locator('.focus-feed');await expect.poll(async()=>(await feed.boundingBox()).height).toBeGreaterThan(400);
 // Scrolling the page brings the whole feed and toolbar on screen below the sticky header, above the tab bar.
 await page.locator('.focus-toolbar').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,10000));
 const header=await page.locator('.logger-header').boundingBox(),box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox(),nav=await page.getByRole('link',{name:'History',exact:true}).boundingBox();
 expect(box.y).toBeGreaterThanOrEqual(header.y+header.height-1);expect(toolbar.y+toolbar.height).toBeLessThanOrEqual(nav.y+1);
 const before=box.height;await page.evaluate(()=>scrollTo(0,0));await page.setViewportSize({width:390,height:845});await page.setViewportSize({width:390,height:844});
 await expect.poll(async()=>(await feed.boundingBox()).height).toBe(before);
 await note.blur();await expect(note).toHaveCount(0);await expect.poll(async()=>(await feed.boundingBox()).height).toBe(initial);
});
test('Focus moves the workout note into the header menu',async({page})=>{
 await start(page);
 await expect(page.locator('.logger-note')).toBeHidden();
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Workout note',exact:true});
 await expect(note).toBeFocused();await note.fill('Felt strong');await note.blur();
 await expect(note).toHaveCount(0);await expect(page.locator('.logger-note')).toBeHidden();
 const indicator=page.getByRole('button',{name:'Edit workout note',exact:true});
 await expect(indicator).toBeVisible();await indicator.click();
 await expect(note).toBeFocused();await expect(note).toHaveValue('Felt strong');await note.blur();
 await page.setViewportSize({width:761,height:844});
 await expect(page.locator('.logger-note')).toBeVisible();await expect(page.locator('.logger-note-indicator')).toBeHidden();
});
test('Workout actions sets the weight step for every ruler',async({page})=>{
 const log=await start(page),more=page.getByRole('button',{name:'Workout actions',exact:true});
 await more.click();const items=page.locator('.reorder-menu button');await expect(items.nth(0)).toHaveText('Add workout note');await expect(items.nth(1)).toHaveText('Weight steps · 2.5 kg');
 await items.nth(1).click();await expect(items).toHaveText(['0.25 kg','1 kg','2.5 kg ✓','5 kg']);
 const current=page.getByRole('button',{name:'2.5 kg',exact:true});await expect(current).toHaveAttribute('aria-current','true');await expect(current).toBeFocused();
 await page.getByRole('button',{name:'5 kg',exact:true}).click();await expect(page.getByRole('group',{name:'Workout actions'})).toBeHidden();await expect(more).toBeFocused();
 const weight=page.getByLabel(`Set 1 weight, ${log.exercises[0].name}`,{exact:true});await weight.fill('80');
 const slider=page.getByRole('slider',{name:`Adjust Set 1 weight, ${log.exercises[0].name}`,exact:true});await slider.focus();await slider.press('ArrowRight');await expect(weight).toHaveValue('85');
 await more.click();await expect(page.getByRole('button',{name:'Weight steps · 5 kg',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.setViewportSize({width:761,height:844});await more.click();await expect(page.getByRole('button',{name:/^Weight steps/})).toHaveCount(0);
});
test('Focus chrome leaves no reserve gap and no note row above the feed',async({page})=>{
 await start(page);
 const header=await page.locator('.logger-header').boundingBox(),progress=await page.locator('.focus-progress').boundingBox();
 expect(progress.y-(header.y+header.height)).toBeLessThanOrEqual(9);
 const toolbar=await page.locator('.focus-toolbar').boundingBox(),nav=await page.locator('nav[aria-label="Main"]').boundingBox();
 expect(nav.y-(toolbar.y+toolbar.height)).toBeLessThanOrEqual(2);
});
test('horizontal swipes on the logger never change root destinations',async({page})=>{
 const log=await start(page);const url=page.url();
 for(const direction of ['next','previous']){await dragDestination(page,{direction});await page.waitForTimeout(300);expect(page.url()).toBe(url);}
 await expect(page.locator('.workout-focus')).toBeVisible();await expect(page.getByRole('link',{name:'History',exact:true})).toHaveAttribute('aria-current','page');
});
test('logging out clears Focus memory',async({page})=>{
 const log=await start(page);await page.getByLabel('Auto-next',{exact:true}).uncheck();
 await page.getByRole('link',{name:'User',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
 await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#shell')).toBeVisible();
 await page.evaluate(id=>{location.hash='/workouts/'+id;},log.id);await expect(page.locator('.workout-focus')).toBeVisible();await expect(page.getByLabel('Auto-next',{exact:true})).toBeChecked();
});
test('closing the overview keeps a Focus card exercise note in that card',async({page})=>{
 const log=await start(page),name=log.exercises[0].name;
 await page.getByRole('button',{name:`Add exercise note, ${name}`,exact:true}).first().click();
 const note=page.getByRole('textbox',{name:`Note, ${name}`,exact:true});await note.fill('Brace first ');
 await page.getByRole('button',{name:'Workout overview',exact:true}).click();
 await page.getByRole('dialog',{name:'Workout overview'}).getByRole('button',{name:'Close overview',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Workout overview'})).toHaveCount(0);
 // Opening the dialog ends editing (blur trims and saves); the saved note must stay in the visible Focus card.
 const saved=page.locator('.focus-exercise-editor').getByRole('button',{name:`Edit note, ${name}: Brace first`,exact:true});
 await expect(saved).toBeVisible();await expect(note).toHaveCount(0);
});
test.describe('with motion',()=>{
 test.use({reducedMotion:'no-preference'});
 // iOS Safari has no scroll anchoring; without it Chromium shows the same drift instead of compensating for it.
 const noAnchoring=page=>page.addStyleTag({content:'.focus-feed{overflow-anchor:none}'});
 const anchor=page=>page.locator('.focus-feed').evaluate(f=>{const rows=[...f.querySelectorAll(':scope>.log-set')];return rows.findIndex(r=>Math.abs(r.offsetTop-f.scrollTop)<2);});
 // Typing turns snapping off, so the browser cannot mask drift while the keyboard shrinks the viewport.
 test('a height change while typing re-anchors the viewed set after card transitions settle',async({page})=>{
  // A tall phone so card height comes from min-height rather than content.
  await page.setViewportSize({width:390,height:1100});await start(page);await noAnchoring(page);
  await page.locator('.focus-feed').evaluate(f=>{const row=f.querySelectorAll(':scope>.log-set')[2];f.scrollTo({top:row.offsetTop,behavior:'instant'});});await expect.poll(()=>anchor(page)).toBe(2);
  await page.locator('.focus-feed>.log-set').nth(2).locator('[data-field="reps"]').click();await expect(page.locator('.focus-feed')).toHaveClass(/is-unsnapped/);
  await page.setViewportSize({width:390,height:900});
  await expect.poll(()=>anchor(page)).toBe(2);
 });
 test('an overview warm-up added before the viewed set keeps that set in view',async({page})=>{
  await page.setViewportSize({width:390,height:1100});await start(page);await noAnchoring(page);
  const ids=await page.locator('.focus-feed>.log-set').evaluateAll(rows=>rows.map(r=>r.dataset.setId));
  await page.locator('.focus-feed').evaluate(f=>{const row=f.querySelectorAll(':scope>.log-set')[1];f.scrollTo({top:row.offsetTop,behavior:'instant'});});await expect.poll(()=>anchor(page)).toBe(1);
  await page.getByRole('button',{name:'Workout overview',exact:true}).click();
  const d=page.getByRole('dialog',{name:'Workout overview'});await d.getByRole('button',{name:/^Add warm-up/}).first().click();
  await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(d).toHaveCount(0);await page.waitForTimeout(500);
  const shown=await page.locator('.focus-feed').evaluate(f=>{const rows=[...f.querySelectorAll(':scope>.log-set')];return rows.find(r=>Math.abs(r.offsetTop-f.scrollTop)<2)?.dataset.setId;});
  expect(shown).toBe(ids[1]);
 });
});
test('tapping a set input while the workout note is open moves focus to that input',async({page})=>{
 const log=await start(page);
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 await page.getByRole('textbox',{name:'Workout note',exact:true}).fill('Quick note');
 const reps=page.getByLabel(`Set 1 reps, ${log.exercises[0].name}`,{exact:true});await reps.click();
 await expect(reps).toBeFocused();await page.waitForTimeout(100);await expect(reps).toBeFocused();
});
// Input.synthesizeScrollGesture with touch dispatches no touchmove in headless Chromium here, so the swipe is raw CDP touch events.
test('a swipe that starts on a ruler never scrolls the feed',async({page})=>{
 const log=await start(page),fields=()=>Promise.all(['weight','reps'].map(f=>page.getByLabel(`Set 1 ${f}, ${log.exercises[0].name}`,{exact:true}).inputValue()));const feed=page.locator('.focus-feed'),card=feed.locator(':scope>.log-set').first(),cdp=await page.context().newCDPSession(page);
 await feed.evaluate(f=>f.addEventListener('scroll',()=>{window.maxTop=Math.max(window.maxTop,f.scrollTop);}));
 const swipe=async locator=>{await page.evaluate(()=>{window.maxTop=0;});const b=await locator.boundingBox(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});await page.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
  return page.evaluate(()=>window.maxTop);}; // snapping returns a short swipe to the same card, so read the furthest scroll
 const before=await fields();expect(await swipe(card.locator('.workout-ruler').first())).toBe(0);expect(await fields()).toEqual(before); // and never nudges
 expect(await swipe(card.locator('.focus-exercise-title'))).toBeGreaterThan(50);
});
test('a diagonal touch drag on a ruler holds until release',async({page})=>{
 const log=await start(page),weight=page.getByLabel(`Set 1 weight, ${log.exercises[0].name}`,{exact:true});await weight.fill('80');
 const b=await page.locator('.focus-feed>.log-set').first().locator('.workout-ruler').first().boundingBox(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 // 120px left with 100px of vertical drift (well outside the strip) is +4 steps of 2.5kg on the ruler
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*12,y:y+i*10}]});await page.waitForTimeout(16);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(weight).toHaveValue('90');expect(await page.locator('.focus-feed').evaluate(f=>f.scrollTop)).toBe(0);
});
