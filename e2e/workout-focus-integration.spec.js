import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers,saveFinishedLog} from './workout-helper.js';
import {createWorkoutLog,toLocalIso} from '../src/workout-log.js';
import {dragDestination} from './mobile-swipe-helper.js';
import {mountFocusFixture} from './workout-focus-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function start(page,mutate=()=>{}){await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Focus integration');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();const log=createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});mutate(log);const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();return log;}
test('mobile active uses Focus without tabs and desktop uses compact',async({page})=>{
 const log=await start(page);await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();await expect(page.locator('.workout-bar:visible')).toHaveCount(0);
 const feed=page.locator('.focus-feed');await expect(feed).toHaveCSS('scroll-snap-type','y mandatory');const box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(toolbar.y+1);expect(toolbar.y+toolbar.height).toBeLessThanOrEqual((await page.evaluate(()=>visualViewport?.height??innerHeight))+1);
 await page.setViewportSize({width:761,height:844});await expect(page.locator('.workout-focus')).toBeHidden();await expect(page.getByLabel(`Set 1 reps, ${log.exercises[0].name}`,{exact:true})).toBeVisible();await page.setViewportSize({width:760,height:844});await expect(page.locator('.workout-focus')).toBeVisible();
});
test('breakpoint preserves invalid drafts and the exact focused input and caret',async({page})=>{
 const log=await start(page),input=page.getByLabel(`Set 1 weight, ${log.exercises[0].name}`,{exact:true});await input.fill('82.3');await input.evaluate(n=>{window.testInput=n;n.setSelectionRange(1,3);});await page.setViewportSize({width:761,height:844});await expect(input).toBeFocused();await expect(input).toHaveValue('82.3');await page.setViewportSize({width:760,height:844});await expect(input).toBeFocused();expect(await input.evaluate(n=>({same:n===window.testInput,start:n.selectionStart,end:n.selectionEnd}))).toEqual({same:true,start:1,end:3});
});
test('breakpoint retains a composing exercise note and shared workout note',async({page})=>{
 const log=await start(page);await page.getByRole('button',{name:`Add exercise note, ${log.exercises[0].name}`,exact:true}).first().click();const note=page.getByRole('textbox',{name:`Note, ${log.exercises[0].name}`,exact:true});await note.fill('Slow descent');await note.evaluate(n=>{window.testNote=n;n.setSelectionRange(2,5);n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});await page.setViewportSize({width:761,height:844});await expect(note).toBeFocused();await page.setViewportSize({width:760,height:844});await expect(note).toBeFocused();expect(await note.evaluate(n=>({same:n===window.testNote,start:n.selectionStart,end:n.selectionEnd}))).toEqual({same:true,start:2,end:5});await page.getByRole('button',{name:'Workout actions',exact:true}).click();await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeVisible();
});
// Auto-next lives in Workout actions (no footer checkbox); a change closes the menu and returns focus to its trigger.
const actions=page=>page.getByRole('button',{name:'Workout actions',exact:true});
const autoBox=page=>page.getByRole('checkbox',{name:'Auto-next',exact:true});
const actionsGroup=page=>page.getByRole('group',{name:'Workout actions',exact:true});
async function setAutoNext(page,value){await actions(page).click();await (value?autoBox(page).check():autoBox(page).uncheck());await expect(actionsGroup(page)).toBeHidden();await expect(actions(page)).toBeFocused();}
async function readAutoNext(page){await actions(page).click();const value=await autoBox(page).isChecked();await page.keyboard.press('Escape');await expect(actionsGroup(page)).toBeHidden();return value;}
test('Auto-next off survives route reentry without changing the saved log',async({page})=>{
 const log=await start(page);await setAutoNext(page,false);await page.getByRole('link',{name:'Back to Home',exact:true}).click();await page.evaluate(id=>{location.hash='/workouts/'+id;},log.id);await expect(page.locator('.workout-focus')).toBeVisible();expect(await readAutoNext(page)).toBe(false);const {record}=await (await page.request.get('/api/workouts/'+log.id)).json();expect(record.log).not.toHaveProperty('autoNext');
});
test('Auto-next is a native checkbox after Weight steps that closes the menu on change',async({page})=>{
 await start(page);await expect(page.locator('.logger-title')).toBeFocused();const more=actions(page),group=actionsGroup(page),box=autoBox(page),row=page.locator('.reorder-menu-check');
 await expect(page.locator('.focus-toolbar input')).toHaveCount(0);await expect(page.locator('.focus-auto')).toHaveCount(0);
 await more.click();expect(await group.evaluate(g=>[...g.children].map(n=>n.textContent))).toEqual(['Add workout note','Weight steps · 2.5 kg','Auto-nextOn','Discard workout']);
 // Ordinary initial option focus stays on the first action; the row is a 44px label target with a visible state.
 await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeFocused();await expect(box).toBeChecked();await expect(row).toHaveText('Auto-nextOn');
 expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);await expect(row.locator('.reorder-menu-state')).toHaveAttribute('aria-hidden','true');
 // Pointer on the checkbox.
 await box.uncheck();await expect(group).toBeHidden();await expect(more).toBeFocused();
 // Keyboard: Tab reaches it after Weight steps; Space toggles natively.
 await more.press('Enter');await expect(box).not.toBeChecked();await expect(row).toHaveText('Auto-nextOff');await expect(box).toHaveAccessibleName('Auto-next');
 await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Weight steps · 2.5 kg',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(box).toBeFocused();
 await page.keyboard.press('Space');await expect(group).toBeHidden();await expect(more).toBeFocused();
 // Escape dismisses without a change.
 await more.click();await expect(box).toBeChecked();await page.keyboard.press('Escape');await expect(group).toBeHidden();await expect(more).toBeFocused();
 // Pointer on the label text toggles too.
 await more.click();await row.click({position:{x:60,y:10}});await expect(group).toBeHidden();await expect(more).toBeFocused();await more.click();await expect(box).not.toBeChecked();
 // Destructive actions are unchanged.
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Discard workout?');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.workout-focus')).toBeVisible();
 // Only editable active Focus offers it.
 await page.setViewportSize({width:761,height:844});await more.click();await expect(page.getByRole('button',{name:'Discard workout',exact:true})).toBeVisible();await expect(box).toHaveCount(0);
});
test('finished and read-only records offer no Auto-next',async({page})=>{
 await login(page);await resetWorkouts(page);const {id}=await saveFinishedLog(page,{name:'Done',startedAt:new Date(Date.now()-7200000).toISOString()});
 await page.evaluate(id=>{location.hash='/workouts/'+id;},id);await actions(page).click();await expect(page.getByRole('button',{name:'Delete workout',exact:true})).toBeVisible();await expect(autoBox(page)).toHaveCount(0);await page.keyboard.press('Escape');
 const hidden=await page.evaluate(async()=>{const {mountWorkoutLogger}=await import('/src/workout-logger-view.js');const {createWorkoutFocusSession}=await import('/src/workout-focus-session.js');
  const host=document.createElement('div');document.body.append(host);const log={id:'read-only',logVersion:2,status:'finished',name:'Done',coverId:'gym',note:'',startedAt:'2026-11-08T10:00:00.000+01:00',finishedAt:'2026-11-08T11:00:00.000+01:00',source:{kind:'blank'},exercises:[]};
  const logger=mountWorkoutLogger(host,{api:{catalog:async()=>({families:[],entries:[],tags:[]})},log,mode:'finished',readOnly:true,focusSession:createWorkoutFocusSession()});const more=host.querySelector('[aria-label="Workout actions"]');const result=[more.hidden,Boolean(host.querySelector('.workout-focus'))];logger.destroy();host.remove();return result;});
 expect(hidden).toEqual([true,false]);
});
test('feed re-measures without losing the viewed set',async({page})=>{
 await start(page);const feed=page.locator('.focus-feed');const anchored=()=>feed.evaluate(f=>{const rows=[...f.querySelectorAll('.focus-card')];return {index:rows.findIndex(r=>Math.abs(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop)<2),snapped:!f.classList.contains('is-unsnapped')};});
 await feed.evaluate(f=>{const r=f.querySelectorAll('.focus-card')[2];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});await expect.poll(anchored).toEqual({index:2,snapped:true});
 await page.setViewportSize({width:390,height:700});await expect.poll(anchored).toEqual({index:2,snapped:true});
 // The logger re-measures on the next frame after a resize; wait for it instead of reading once.
 await expect.poll(async()=>{const box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox();return box.y+box.height<=toolbar.y+1&&toolbar.y+toolbar.height<=(await page.evaluate(()=>visualViewport?.height??innerHeight))+1;}).toBe(true);
 await page.setViewportSize({width:761,height:700});await page.setViewportSize({width:760,height:700});await expect.poll(anchored).toEqual({index:2,snapped:true});
});
test('a long workout note leaves the feed the space under the sticky header',async({page})=>{
 const log=await start(page);const initial=(await page.locator('.focus-feed').boundingBox()).height;await page.getByRole('button',{name:'Workout actions',exact:true}).click();await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 // In Focus the note only occupies the page while it is being edited.
 const note=page.getByRole('textbox',{name:'Workout note',exact:true});await note.fill('Long workout context with line breaks.\n'.repeat(45));
 const feed=page.locator('.focus-feed');await expect.poll(async()=>(await feed.boundingBox()).height).toBeGreaterThan(400);
 // Scrolling the page brings the whole feed and toolbar on screen below the sticky header, within the visual viewport.
 await page.locator('.focus-toolbar').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,10000));
 const header=await page.locator('.logger-header').boundingBox(),box=await feed.boundingBox(),toolbar=await page.locator('.focus-toolbar').boundingBox();
 expect(box.y).toBeGreaterThanOrEqual(header.y+header.height-1);expect(toolbar.y+toolbar.height).toBeLessThanOrEqual((await page.evaluate(()=>visualViewport?.height??innerHeight))+1);
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
 const toolbar=await page.locator('.focus-toolbar').boundingBox();
 expect(Math.abs((await page.evaluate(()=>visualViewport?.height??innerHeight))-(toolbar.y+toolbar.height))).toBeLessThanOrEqual(2);await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();
});
test('horizontal swipes on the logger never change root destinations',async({page})=>{
 const log=await start(page);const url=page.url();
 for(const direction of ['next','previous']){await dragDestination(page,{direction});await page.waitForTimeout(300);expect(page.url()).toBe(url);}
 await expect(page.locator('.workout-focus')).toBeVisible();await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();
});
test('logging out clears Focus memory',async({page})=>{
 const log=await start(page);await setAutoNext(page,false);
 await page.getByRole('link',{name:'Back to Home',exact:true}).click();await page.getByRole('link',{name:'User',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
 await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#shell')).toBeVisible();
 await page.evaluate(id=>{location.hash='/workouts/'+id;},log.id);await expect(page.locator('.workout-focus')).toBeVisible();expect(await readAutoNext(page)).toBe(true);
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
 const anchor=page=>page.locator('.focus-feed').evaluate(f=>{const rows=[...f.querySelectorAll('.focus-card')];return rows.findIndex(r=>Math.abs(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop)<2);});
 // Typing turns snapping off, so the browser cannot mask drift while the keyboard shrinks the viewport.
 test('a height change while typing re-anchors the viewed set after card transitions settle',async({page})=>{
  // A tall phone so card height comes from min-height rather than content.
  await page.setViewportSize({width:390,height:1100});await start(page);await noAnchoring(page);
  await page.locator('.focus-feed').evaluate(f=>{const r=f.querySelectorAll('.focus-card')[2];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});await expect.poll(()=>anchor(page)).toBe(2);
  await page.locator('.focus-feed .focus-card').nth(2).locator('[data-field="reps"]').click();await expect(page.locator('.focus-feed')).toHaveClass(/is-unsnapped/);
  await page.setViewportSize({width:390,height:900});
  await expect.poll(()=>anchor(page)).toBe(2);
 });
 test('an overview warm-up added before the viewed set keeps that set in view',async({page})=>{
  await page.setViewportSize({width:390,height:1100});await start(page);await noAnchoring(page);
  const ids=await page.locator('.focus-feed .focus-card').evaluateAll(rows=>rows.map(r=>r.dataset.setId));
  await page.locator('.focus-feed').evaluate(f=>{const r=f.querySelectorAll('.focus-card')[1];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});await expect.poll(()=>anchor(page)).toBe(1);
  await page.getByRole('button',{name:'Workout overview',exact:true}).click();
  const d=page.getByRole('dialog',{name:'Workout overview'});await d.getByRole('button',{name:/^Actions, /}).first().click();await page.getByRole('button',{name:'Add warm-up',exact:true}).click();
  await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(d).toHaveCount(0);await page.waitForTimeout(500);
  const shown=await page.locator('.focus-feed').evaluate(f=>{const rows=[...f.querySelectorAll('.focus-card')];return rows.find(r=>Math.abs(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop)<2)?.dataset.setId;});
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
 const log=await start(page),fields=()=>Promise.all(['weight','reps'].map(f=>page.getByLabel(`Set 1 ${f}, ${log.exercises[0].name}`,{exact:true}).inputValue()));const feed=page.locator('.focus-feed'),card=feed.locator('.focus-card').first(),cdp=await page.context().newCDPSession(page);
 await feed.evaluate(f=>f.addEventListener('scroll',()=>{window.maxTop=Math.max(window.maxTop,f.scrollTop);}));
 const swipe=async locator=>{await page.evaluate(()=>{window.maxTop=0;});const b=await locator.boundingBox(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});await page.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
  return page.evaluate(()=>window.maxTop);}; // snapping returns a short swipe to the same card, so read the furthest scroll
 const before=await fields();expect(await swipe(card.locator('.workout-ruler').first())).toBe(0);expect(await fields()).toEqual(before); // and never nudges
 expect(await swipe(feed.locator('.focus-group').first().locator('.focus-exercise-title'))).toBeGreaterThan(50);
});
test('a diagonal touch drag on a ruler holds until release',async({page})=>{
 const log=await start(page),weight=page.getByLabel(`Set 1 weight, ${log.exercises[0].name}`,{exact:true});await weight.fill('80');
 const b=await page.locator('.focus-feed .focus-card').first().locator('.workout-ruler').first().boundingBox(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 // 120px left with 100px of vertical drift (well outside the strip) is +4 steps of 2.5kg on the ruler
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*12,y:y+i*10}]});await page.waitForTimeout(16);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(weight).toHaveValue('90');expect(await page.locator('.focus-feed').evaluate(f=>f.scrollTop)).toBe(0);
});

test('partner switching keeps the same canonical inputs through acknowledgement and the desktop breakpoint',async({page})=>{
 const log=await start(page,l=>{l.exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:90};}),[a,b]=log.exercises;
 const round=page.locator('.focus-round').first(),partners=round.locator('.focus-partner'),aWeight=page.getByLabel(`Set 1 weight, ${a.name}`,{exact:true}),bReps=page.getByLabel(`Set 1 reps, ${b.name}`,{exact:true});
 await page.evaluate(()=>{window.heldInputs=[...document.querySelectorAll('.log-stepper input')];});
 const same=()=>page.evaluate(()=>{const now=[...document.querySelectorAll('.log-stepper input')];return now.length===heldInputs.length&&now.every(n=>heldInputs.includes(n));});
 await aWeight.fill('82.3');await partners.nth(1).click();await expect(partners.nth(1)).toBeFocused();await expect(partners.nth(1)).toHaveAttribute('aria-current','step');
 await expect(aWeight).toBeHidden();await expect(bReps).toBeVisible();
 const saved=page.waitForResponse(r=>r.url().includes('/api/workouts/'+log.id)&&r.request().method()==='PUT'&&r.ok());await bReps.fill('9');await saved;
 await page.setViewportSize({width:761,height:844});await expect(aWeight).toBeVisible();await expect(aWeight).toHaveValue('82.3');
 await page.setViewportSize({width:760,height:844});await expect(partners.nth(1)).toHaveAttribute('aria-current','step');await expect(bReps).toBeVisible();await expect(bReps).toHaveValue('9');
 await expect(aWeight).toHaveValue('82.3');await expect(aWeight).toHaveAttribute('aria-invalid','true');expect(await same()).toBe(true);
 const {record}=await (await page.request.get('/api/workouts/'+log.id)).json();expect(record.log.exercises.flatMap(e=>e.sets).filter(s=>s.done)).toEqual([]);
});

// Workout actions interrupts movement from outside Focus: pending Auto-next, smooth travel and partner motion settle without a resume step.
const ready=l=>{l.exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:90};for(const e of l.exercises)for(const s of e.sets)s.reps=8;};
const cardOf=(page,setId)=>page.locator(`.focus-card[data-set-id="${setId}"]`);
const feedTop=page=>page.locator('.focus-feed').evaluate(f=>f.scrollTop);
const viewedId=page=>page.evaluate(()=>document.querySelector('.focus-card.is-viewed')?.dataset.setId??null);
const values=page=>page.evaluate(()=>[...document.querySelectorAll('.log-set')].map(r=>[r.dataset.setId,r.classList.contains('is-done'),...[...r.querySelectorAll('input[data-field]')].map(i=>i.value)]));
// The viewed card's page (its round, or itself) rests at the feed's scroll position, and nothing focused is a numeric field or inside an inert pane.
// The route's content swap focuses the workout title once it settles; interact only after it.
const startSettled=async(page,mutate)=>{const log=await start(page,mutate);await expect(page.locator('.logger-title')).toBeFocused();return log;};
const settledOnPage=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),card=f.querySelector('.focus-card.is-viewed'),el=card?.closest('.focus-round')??card,a=document.activeElement;
 return {card:Boolean(card),aligned:Boolean(el)&&Math.abs(el.offsetTop-(parseFloat(el.style.scrollMarginTop)||0)-f.scrollTop)<=2,input:a.matches('input'),inert:Boolean(a.closest('[inert]'))};});
test.describe('Workout actions and Auto-next movement',()=>{
 test.use({reducedMotion:'no-preference'});
 test('Auto-next off stops partner and vertical movement; enabling waits for a later explicit completion',async({page})=>{
  const log=await startSettled(page,ready),[a,b]=log.exercises,[a1,b1]=[a.sets[0].id,b.sets[0].id];
  await setAutoNext(page,false);const top=await feedTop(page);
  await cardOf(page,a1).locator('.log-done').click();await page.waitForTimeout(900);expect(await viewedId(page)).toBe(a1);expect(await feedTop(page)).toBe(top);
  await page.locator('.focus-round').first().locator('.focus-partner').nth(1).click();await expect.poll(()=>viewedId(page)).toBe(b1);
  await cardOf(page,b1).locator('.log-done').click();await expect(cardOf(page,b1)).toHaveClass(/is-done/);await page.waitForTimeout(900);expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(top);
  // Enabling it on an already-complete round moves nothing.
  await setAutoNext(page,true);await page.waitForTimeout(900);expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(top);
  const done=cardOf(page,b1).locator('.log-done');await done.click();await expect(cardOf(page,b1)).not.toHaveClass(/is-done/);await done.click();
  await expect.poll(()=>viewedId(page)).toBe(a.sets[1].id);expect(await feedTop(page)).toBeGreaterThan(top);
 });
 for(const how of ['actions','weight-steps','overview'])test(`opening ${how} at 649ms cancels a pending round advance`,async({page})=>{
  await page.clock.install();const log=await startSettled(page,ready),[a,b]=log.exercises,[a1,b1,a2]=[a.sets[0].id,b.sets[0].id,a.sets[1].id];
  await page.clock.pauseAt(new Date(Date.now()+60000));
  // Synthetic clicks log both partners without a pointer or key that would cancel on its own; the first switches to A2 in place.
  await page.evaluate(id=>document.querySelector(`.focus-card[data-set-id="${id}"] .log-done`).click(),a1);expect(await viewedId(page)).toBe(b1);
  if(how==='weight-steps'){await actions(page).click();await expect(actionsGroup(page)).toBeVisible();}
  await page.evaluate(id=>document.querySelector(`.focus-card[data-set-id="${id}"] .log-done`).click(),b1);
  const top=await feedTop(page),before=await values(page);await page.clock.runFor(649);
  if(how==='actions'){await actions(page).click();await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeFocused();}
  if(how==='weight-steps'){await page.getByRole('button',{name:'Weight steps · 2.5 kg',exact:true}).click();await expect(page.getByRole('button',{name:'2.5 kg',exact:true})).toBeFocused();}
  if(how==='overview')await page.locator('.focus-toolbar').getByRole('button',{name:'Workout overview',exact:true}).click();
  await page.clock.runFor(1000);
  expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(top);expect(await values(page)).toEqual(before);await expect(cardOf(page,a2).locator('.focus-context-text')).not.toBeFocused();
  if(how==='overview'){const d=page.getByRole('dialog',{name:'Workout overview'});await d.getByRole('button',{name:'Close overview',exact:true}).click();await page.clock.runFor(300);await expect(d).toHaveCount(0);}
  else{await page.keyboard.press('Escape');await expect(actionsGroup(page)).toBeHidden();await expect(actions(page)).toBeFocused();}
  // Selection and scrolling keep working with no resume call.
  await page.clock.resume();await page.locator('.focus-round').first().locator('.focus-partner').nth(0).click();await expect.poll(()=>viewedId(page)).toBe(a1);
  await page.locator('.focus-feed').evaluate(f=>{const r=f.querySelectorAll('.focus-round')[1];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});
  await expect.poll(()=>viewedId(page)).toBe(a2);
 });
 for(const motion of ['no-preference','reduce'])test(`opening Workout actions settles partner motion and travel at real pages (${motion})`,async({page})=>{
  await page.emulateMedia({reducedMotion:motion});const log=await startSettled(page,ready),[a,b]=log.exercises,before=await values(page);
  // Midway through a 200ms partner switch.
  const mid=await page.evaluate(()=>{const round=document.querySelector('.focus-round'),buttons=round.querySelectorAll('.focus-partner');buttons[1].click();document.querySelector('[aria-label="Workout actions"]').click();
   return {running:[...round.querySelectorAll('.focus-pair-pane,.focus-partner,.focus-partner-check,.focus-partner-underline')].flatMap(n=>n.getAnimations()).length,current:[...buttons].findIndex(n=>n.getAttribute('aria-current')==='step'),inert:[...round.querySelectorAll('.focus-pair-pane')].map(p=>p.inert),focused:document.activeElement.textContent};});
  expect(mid).toEqual({running:0,current:1,inert:[true,false],focused:'Add workout note'});expect(await viewedId(page)).toBe(b.sets[0].id);
  await page.keyboard.press('Escape');await expect(actions(page)).toBeFocused();
  // During a smooth cross-page travel: Back to current from the last round towards A1.
  await page.locator('.focus-feed').evaluate(f=>{const r=[...f.querySelectorAll('.focus-round')].at(-1);f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});
  const back=page.locator('.focus-toolbar').getByRole('button',{name:'Back to current',exact:true});await expect.poll(()=>viewedId(page)).toBe(a.sets[2].id);await expect(back).toBeVisible();
  // Open the menu (synthetic click: no pointerdown or key cancels on its own) once the travel has left round 3 but not reached round 1.
  const flight=await page.evaluate(async()=>{const f=document.querySelector('.focus-feed'),start=f.scrollTop;document.querySelector('.focus-current').click();
   for(let i=0;i<60&&f.scrollTop>=start-1;i++)await new Promise(requestAnimationFrame);
   const at=f.scrollTop;document.querySelector('[aria-label="Workout actions"]').click();
   return {start,at,pages:[...f.querySelectorAll('.focus-round')].map(r=>({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),ids:[...r.querySelectorAll('.focus-card')].map(c=>c.dataset.setId)}))};});
  await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeFocused();await page.waitForTimeout(400);
  if(motion==='reduce')expect(await viewedId(page)).toBe(a.sets[0].id);
  else{
   // Mid-flight when interrupted; it stops at the actual page nearest that point (one of its existing members), never at A1's page.
   expect(flight.at).toBeLessThan(flight.start);expect(flight.at).toBeGreaterThan(flight.pages[0].top+1);
   const nearest=flight.pages.reduce((n,p)=>Math.abs(p.top-flight.at)<Math.abs(n.top-flight.at)?p:n);expect(nearest).not.toBe(flight.pages[0]);
   const viewed=await viewedId(page);expect(viewed).not.toBe(a.sets[0].id);expect(nearest.ids).toContain(viewed);expect(Math.abs(await feedTop(page)-nearest.top)).toBeLessThanOrEqual(2);
  }
  expect(await settledOnPage(page)).toEqual({card:true,aligned:true,input:false,inert:false});
  await page.keyboard.press('Escape');await expect(actions(page)).toBeFocused();expect(await values(page)).toEqual(before);
  // Selection still works on the page it settled on.
  const viewed=await viewedId(page),round=page.locator('.focus-round').filter({has:page.locator('.focus-card.is-viewed')}),other=round.locator('.focus-partner:not([aria-current])');
  await other.click();await expect.poll(()=>viewedId(page)).not.toBe(viewed);
 });
});
test('the footer is a filling neutral overview button with Back to current only when needed',async({page})=>{
 await start(page);const toolbar=page.locator('.focus-toolbar'),overview=toolbar.getByRole('button',{name:'Workout overview',exact:true}),current=toolbar.getByRole('button',{name:'Back to current',exact:true});
 const token=name=>page.evaluate(name=>{const p=document.createElement('i');p.style.color=`var(${name})`;document.body.append(p);const c=getComputedStyle(p).color;p.remove();return c;},name);
 await expect(overview.locator('svg')).toHaveCount(1);await expect(overview).toHaveText('Workout overview');
 await expect(overview).toHaveCSS('background-color',await token('--surface-2'));await expect(overview).toHaveCSS('border-top-width','1px');await expect(overview).toHaveCSS('border-top-color',await token('--border'));await expect(overview).toHaveCSS('color',await token('--text'));await expect(overview).toHaveCSS('min-height','44px');
 // The row is the toolbar's padding box without the device inset (3px of its bottom padding belongs to the row).
 const row=()=>toolbar.evaluate(t=>{const s=getComputedStyle(t),o=t.querySelector('.focus-overview').getBoundingClientRect(),c=t.querySelector('.focus-current'),r=c.hidden?null:c.getBoundingClientRect();
  return {row:t.clientHeight-parseFloat(s.paddingBottom)+3,inner:t.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),left:t.getBoundingClientRect().left+parseFloat(s.paddingLeft),o:{left:o.left,width:o.width,height:o.height},c:r&&{left:r.left,right:r.right,height:r.height}};});
 await expect(current).toBeHidden();let g=await row();expect(g.row).toBe(50);expect(Math.abs(g.o.width-g.inner)).toBeLessThanOrEqual(1);
 await page.locator('.focus-feed').evaluate(f=>{const r=f.querySelectorAll('.focus-card')[2];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});
 await expect(current).toBeVisible();g=await row();expect(g.row).toBe(50);expect(Math.abs(g.c.left-(g.o.left+g.o.width)-8)).toBeLessThanOrEqual(1);expect(Math.abs(g.c.right-(g.left+g.inner))).toBeLessThanOrEqual(1);expect(g.c.height).toBeGreaterThanOrEqual(44);
 // 200% text grows the row instead of squeezing targets; nothing overlaps and the feed still ends above it.
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 await expect.poll(async()=>(await row()).row).toBeGreaterThanOrEqual(50);g=await row();expect(g.o.height).toBeGreaterThanOrEqual(44);expect(g.c.height).toBeGreaterThanOrEqual(44);expect(g.o.left+g.o.width).toBeLessThanOrEqual(g.c.left);
 await expect.poll(async()=>{const f=await page.locator('.focus-feed').boundingBox(),t=await toolbar.boundingBox();return f.y+f.height<=t.y+1;}).toBe(true);
});
test('shared menu button choices keep their behavior beside a checkable choice',async({page})=>{
 await page.goto('/');
 const out=await page.evaluate(async()=>{const {mountReorderMenu}=await import('/src/reorder-menu.js');const trigger=document.createElement('button');trigger.textContent='Menu';document.body.prepend(trigger);const menu=mountReorderMenu({label:'Test menu'}),ran=[],out={};
  const choices=()=>[{label:'Move up',disabled:true,run:()=>ran.push('up')},{label:'Move down',run:()=>ran.push(['down',document.activeElement===trigger])},{label:'2.5 kg',current:true,run:()=>ran.push('kg')},{label:'Auto-next',checked:false,run:v=>ran.push(['auto',v,document.activeElement===trigger])}];
  const popup=()=>document.querySelector('.reorder-menu');
  menu.toggle(trigger,choices());out.current=document.activeElement.textContent;menu.close();
  menu.toggle(trigger,choices(),{initialIndex:0});out.disabledIndex=document.activeElement.textContent;menu.close();
  menu.toggle(trigger,choices(),{initialIndex:1});out.index=document.activeElement.textContent;document.activeElement.click();out.afterButton=popup().matches(':popover-open');
  menu.toggle(trigger,choices(),{initialIndex:3});out.checkbox=document.activeElement.type;document.activeElement.click();out.afterCheck=popup().matches(':popover-open');
  out.ran=ran;menu.destroy();trigger.remove();return out;});
 expect(out).toEqual({current:'2.5 kg ✓',disabledIndex:'2.5 kg ✓',index:'Move down',afterButton:false,checkbox:'checkbox',afterCheck:false,ran:[['down',true],['auto',true,true]]});
});
test.describe('carried Focus cancellation and focus fixes',()=>{
 test.use({reducedMotion:'no-preference'});
 for(const key of ['Enter','Space'])test(`${key} on Complete still schedules Auto-next`,async({page})=>{
  await page.clock.install();await mountFocusFixture(page);
  await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;l.exercises[0].sets[1].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});
  await page.clock.pauseAt(new Date(Date.now()+60000));
  await page.locator('.focus-card[data-set-id="s1"] .log-done').focus();await page.keyboard.press(key);await expect(page.locator('.focus-card[data-set-id="s1"]')).toHaveClass(/is-done/);
  await page.clock.runFor(649);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
  await page.clock.runFor(1);await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
 });
 test('a superseded deferred jump never applies after a later composition',async({page})=>{
  await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
  expect(await page.evaluate(()=>{const weight=port.row({exerciseId:'a',setId:'a1'}).querySelector('[data-field="weight"]');weight.focus();weight.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
   focusView.jump({exerciseId:'b',setId:'b1'});const deferred=focusView.visibleRef().setId;
   // The composition never reports its end (the field lost focus); a newer jump proceeds and supersedes the deferred one.
   weight.blur();focusView.jump({exerciseId:'straight',setId:'s1'});
   const other=port.row({exerciseId:'straight',setId:'s1'}).querySelector('[data-field="reps"]');other.focus();other.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));other.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
   return [deferred,focusView.visibleRef().setId];})).toEqual(['a1','s1']);
 });
 test('a programmatic partner switch moves focus off a relocated note action to the new context',async({page})=>{
  await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
  const round=page.locator('.focus-round').first(),context=round.locator('.focus-round-context');await expect(round).toHaveClass(/is-compact/);
  await context.getByRole('button',{name:'Add exercise note, Single-arm incline dumbbell chest press',exact:true}).focus();
  await page.evaluate(()=>focusView.jump({exerciseId:'b',setId:'b1'}));await expect(page.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
  await context.getByRole('button',{name:'Add set note, Set 1, Chest-supported row',exact:true}).focus();
  await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));await expect(page.locator('.focus-card[data-set-id="a1"] .focus-context-text')).toBeFocused();
 });
});
// A partially completed round is ordinary saved data owned by the one logger/sync path.
test.describe('saved partial rounds',()=>{
 test.use({reducedMotion:'no-preference'});
 const serverLog=async(page,id)=>(await (await page.request.get('/api/workouts/'+id)).json()).record.log;
 const running=page=>page.evaluate(()=>[...document.querySelectorAll('.focus-round *')].flatMap(n=>n.getAnimations()).length);
 // A finished log of the same variants (9 reps at 50 kg) gives both partner panes a lower-bound Best.
 async function startPair(page){
  await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Focus rounds');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
  const make=now=>createWorkoutLog({id:crypto.randomUUID(),now,makeId:()=>crypto.randomUUID(),template});
  const past=make(new Date(Date.now()-86400000));for(const e of past.exercises)for(const s of e.sets)Object.assign(s,{done:true,weightKg:50,reps:9});
  Object.assign(past,{status:'finished',finishedAt:toLocalIso(new Date(Date.now()-82800000))});
  let r=await page.request.put('/api/workouts/'+past.id,{headers,data:{revision:0,log:past}});expect(r.ok(),await r.text()).toBeTruthy();
  const log=make(new Date());log.exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:90};
  r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();
  await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();await expect(page.locator('.logger-title')).toBeFocused();
  return {log,before:await serverLog(page,log.id)};
 }
 test('A2 logged first stays one real saved completion through acknowledgement, Back, Resume and reload',async({page})=>{
  const {log,before}=await startPair(page),[a,b]=log.exercises,[a1,b1]=[a.sets[0].id,b.sets[0].id];
  const round=page.locator('.focus-round').first(),partners=round.locator('.focus-partner');
  // Both partner panes carry the lower-bound Best title.
  await expect(round.locator('.focus-pair-pane .log-best')).toHaveText([/^Best \(8\+ reps\) · 50 kg × 9 · /,/^Best \(8\+ reps\) · 50 kg × 9 · /]);
  await partners.nth(1).click();await expect.poll(()=>viewedId(page)).toBe(b1);const top=await feedTop(page);
  await page.getByLabel(`Set 1 weight, ${b.name}`,{exact:true}).fill('42.5');await page.getByLabel(`Set 1 reps, ${b.name}`,{exact:true}).fill('10');
  await page.getByRole('button',{name:`Add set note, Set 1, ${b.name}`,exact:true}).click();await page.getByRole('textbox',{name:`Note, set 1, ${b.name}`,exact:true}).fill('Slow eccentric');await page.keyboard.press('Enter');
  // The saved set note makes this round 9px taller than the feed; a Playwright click would first scroll it into view across the next snap point, which a tap never does.
  await expect(page.getByRole('button',{name:'Log A2 & switch to A1',exact:true})).toBeVisible();await page.evaluate(id=>document.querySelector(`.focus-card[data-set-id="${id}"] .log-done`).click(),b1);
  // Only B1 is logged; Auto-next switches to A1 in place.
  await expect.poll(()=>viewedId(page)).toBe(a1);expect(await feedTop(page)).toBe(top);
  const expected=structuredClone(before.exercises);Object.assign(expected[1].sets.find(s=>s.id===b1),{done:true,weightKg:42.5,reps:10,rir:null,note:'Slow eccentric'});
  await expect.poll(async()=>(await serverLog(page,log.id)).exercises).toEqual(expected);
  expect(Object.keys(await serverLog(page,log.id)).sort()).toEqual(Object.keys(before).sort());await expect(page.locator('.logger-status')).toHaveText('Saved');
  // Blank RIR stays blank after completion and acknowledgement.
  await expect(cardOf(page,b1).locator('.log-rir-option[aria-pressed="true"]')).toHaveCount(0);await expect(partners.nth(1)).toHaveAccessibleName(`A2, ${b.name}, complete`);
  // Leave with ordinary Back and return through Resume: the exact partner returns; stored completion never animates or advances.
  await partners.nth(1).click();await expect.poll(()=>viewedId(page)).toBe(b1);
  await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();await page.getByRole('link',{name:'Back to Home',exact:true}).click();
  await page.getByRole('button',{name:'Resume workout',exact:true}).click();await expect(page.locator('.workout-focus')).toBeVisible();
  await expect(partners.nth(1)).toHaveAttribute('aria-current','step');await expect(cardOf(page,b1)).toHaveClass(/is-done/);await expect(cardOf(page,a1)).not.toHaveClass(/is-done/);
  const resumedTop=await feedTop(page);expect(await running(page)).toBe(0);await page.waitForTimeout(900);
  expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(resumedTop);expect(await running(page)).toBe(0);
  // Reload: the accepted partial completion is still the stored one, with nothing moving.
  await page.reload();await expect(page.locator('.workout-focus')).toBeVisible();await expect(cardOf(page,b1)).toHaveClass(/is-done/);await expect(cardOf(page,a1)).not.toHaveClass(/is-done/);
  await expect(partners.nth(1)).toHaveAccessibleName(`A2, ${b.name}, complete`);const viewed=await viewedId(page),reloadTop=await feedTop(page);await page.waitForTimeout(900);
  expect(await viewedId(page)).toBe(viewed);expect(await feedTop(page)).toBe(reloadTop);expect(await running(page)).toBe(0);
  expect((await serverLog(page,log.id)).exercises).toEqual(expected);
 });
 test('a conflict accepted while a round advance is queued never applies a stale switch or travel',async({page})=>{
  await page.clock.install();const {log}=await startPair(page),[a,b]=log.exercises,[a1,b1,a2]=[a.sets[0].id,b.sets[0].id,a.sets[1].id];
  await page.clock.pauseAt(new Date(Date.now()+60000));
  await page.getByLabel(`Set 1 reps, ${a.name}`,{exact:true}).fill('8');await page.locator('.focus-round').first().locator('.focus-partner').nth(1).click();
  await page.getByLabel(`Set 1 reps, ${b.name}`,{exact:true}).fill('8');await page.locator('.focus-round').first().locator('.focus-partner').nth(0).click();
  // Synthetic clicks: the first switches to B1 in place, the second completes the round and queues the 650ms advance.
  await page.evaluate(id=>document.querySelector(`.focus-card[data-set-id="${id}"] .log-done`).click(),a1);expect(await viewedId(page)).toBe(b1);
  // Another device saved first: A1 stays open there and the advance target A2 is removed.
  const {record}=await (await page.request.get('/api/workouts/'+log.id)).json(),other=structuredClone(record.log);other.name='Server copy';other.exercises[0].sets=other.exercises[0].sets.filter(s=>s.id!==a2);
  expect((await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:record.revision,log:other}})).ok()).toBeTruthy();
  await page.evaluate(id=>document.querySelector(`.focus-card[data-set-id="${id}"] .log-done`).click(),b1);const top=await feedTop(page);
  await page.clock.runFor(400);const dialog=page.getByRole('dialog',{name:'Workout changed elsewhere'});await expect(dialog).toBeVisible();
  await page.clock.runFor(400);expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(top);
  await page.clock.resume();await dialog.getByRole('button',{name:'Use saved version'}).click();await page.getByRole('dialog',{name:'Use saved version?'}).getByRole('button',{name:'Use saved version'}).click();
  await expect(page.locator('.logger-status')).toHaveText('Saved');await expect(cardOf(page,a2)).toHaveCount(0);
  await expect(cardOf(page,a1)).not.toHaveClass(/is-done/);await expect(cardOf(page,b1)).not.toHaveClass(/is-done/);await page.waitForTimeout(900);
  expect(await viewedId(page)).toBe(b1);expect(await feedTop(page)).toBe(top);
  expect((await serverLog(page,log.id)).exercises.flatMap(e=>e.sets).filter(s=>s.done)).toEqual([]);
 });
});
