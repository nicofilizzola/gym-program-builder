import {openLibrarySection} from './navigation-helper.js';
import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate} from './workout-helper.js';

const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const status=page=>page.locator('.logger-status');
let T='Push A';

/** Starts a workout from the template library card and waits until it is saved. */
async function start(page,{fresh=true}={}){
 if(fresh){
  await login(page);await resetWorkouts(page);
  await page.goto('/#/programs');await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
  T='Push '+crypto.randomUUID().slice(0,6);
  await createLinkedTemplate(page,T);
 }
 await openLibrarySection(page,'templates');
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 await expect(status(page)).toHaveText('Saved');
 return {id:new URL(page.url()).hash.split('/').at(-1),names:await page.locator('.log-exercise h2').allTextContents()};
}
const done=(page,n,name)=>page.getByRole('button',{name:`Mark set ${n} done, ${name}`,exact:true});
const noteOf=async(page,id)=>(await serverRecord(page,id)).log.exercises[0].note;
const editName=exercise=>new RegExp('^Edit note, '+exercise.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+': ');
const blur=page=>page.getByLabel('Workout name',{exact:true}).focus();
const setMenu=(page,n,name,warm=false)=>page.getByRole('button',{name:`${warm?'Warm-up set':'Set'} ${n} actions, ${name}`,exact:true});
const setInput=(page,n,name,warm=false)=>page.getByRole('textbox',{name:`Note, ${warm?'warm-up set':'set'} ${n}, ${name}`,exact:true});
async function openSetNote(page,n,name,{warm=false,edit=false}={}){
 await setMenu(page,n,name,warm).click();
 await page.getByRole('group',{name:'Set actions',exact:true}).getByRole('button',{name:edit?'Edit note':'Add note',exact:true}).click();
 const input=setInput(page,n,name,warm);await expect(input).toBeFocused();return input;
}
const finish=async page=>{
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 // Phones finish into the recap; Done continues to Home.
 if(page.viewportSize().width<=760){await expect(page.locator('.workout-recap')).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();}
 await expect(page).toHaveURL(page.viewportSize().width<=760?/#\/home$/:/#\/workouts$/);
};

for(const [label,viewport,hasTouch] of [['390 touch',{width:390,height:800},true],['1366',{width:1366,height:768},false]]){
 test.describe(label,()=>{
  test.use({viewport,hasTouch});

  test('exercise notes open, save, reopen, clear and carry over as last time',async({page})=>{
   test.skip(label==='390 touch','Active phone workouts use Focus; note behavior there is covered by the Focus and long-note tests.');
   const {id,names:[first]}=await start(page);
   const add=page.getByRole('button',{name:`Add note, ${first}`,exact:true});
   await expect(add).toHaveText('Add note');await expect(add.locator('svg[aria-hidden="true"]')).toHaveCount(1);
   expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(hasTouch?43.5:31.5);
   await add.click();
   const input=page.getByLabel(`Note, ${first}`,{exact:true});
   await expect(input).toBeFocused();
   await input.fill('Seat 4');
   await input.press('Enter');await input.pressSequentially('top pin');
   await expect(input).toHaveValue('Seat 4\ntop pin');
   await input.fill('Seat 4');
   await blur(page);
   const text=page.getByRole('button',{name:editName(first)});
   await expect(text).toHaveText('Seat 4');
   await expect(status(page)).toHaveText('Saved');
   expect(await noteOf(page,id)).toBe('Seat 4');
   await text.click();
   await expect(input).toBeFocused();
   expect(await input.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([6,6]);
   await input.fill('   ');await blur(page);
   await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toHaveText('Add note');
   await expect(status(page)).toHaveText('Saved');
   expect(await noteOf(page,id)).toBe('');
   // Note again, finish, then start the same template: the note shows as read-only last-time text, not copied.
   await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
   await input.fill('Seat 4');await blur(page);
   await done(page,1,first).click();
   await expect(status(page)).toHaveText('Saved');
   await finish(page);
   const next=await start(page,{fresh:false});
   const card=page.locator('.log-exercise').filter({has:page.getByRole('heading',{name:first,exact:true})});
   await expect(card.locator('p.log-last-note')).toContainText('Seat 4');
   await expect(card.locator('p.log-last-note')).toHaveAttribute('title','Seat 4');
   await expect(card.locator('p.log-last-note .visually-hidden')).toHaveText('Last time note:');
   await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toBeVisible();
   expect(await noteOf(page,next.id)).toBe('');
  });

  test('a finished workout edits its note through autosave',async({page})=>{
   const {id,names:[first]}=await start(page);
   await done(page,1,first).click();
   await expect(status(page)).toHaveText('Saved');
   await finish(page);
   await page.goto('/#/workouts/'+id);
   await expect(page.getByLabel('Start time',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
   await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Felt heavy');
   await blur(page);
   await expect.poll(()=>noteOf(page,id)).toBe('Felt heavy');
  });

  // At 360px the active workout is Focus, which opens the same exercise note from its card.
  test('a long note wraps without horizontal scroll',async({page})=>{
   await page.setViewportSize({width:360,height:800});
   const {names:[first]}=await start(page);
   await expect(page.locator('.workout-focus')).toBeVisible();
   await page.getByRole('button',{name:`Add exercise note, ${first}`,exact:true}).first().click();
   await page.getByLabel(`Note, ${first}`,{exact:true}).fill('word '.repeat(200).trim().slice(0,1000));
   await blur(page);
   const text=page.getByRole('button',{name:editName(first)});
   await expect(text).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await text.boundingBox()).width).toBeLessThanOrEqual(360);
  });

  test('set notes save on input, finish on Enter, reopen and clear in the aligned note slot',async({page})=>{
   test.skip(label==='390 touch','Active phone workouts use Focus; note behavior there is covered by the Focus and long-note tests.');
   const {id,names:[first]}=await start(page);
   const input=await openSetNote(page,2,first);
   const row=setMenu(page,2,first).locator('xpath=ancestor::li[contains(@class,"log-set")][1]');
   const kg=await row.locator('[data-kind="weight"]').boundingBox(),menu=await setMenu(page,2,first).boundingBox(),box=await input.boundingBox();
   expect(Math.abs(box.x-kg.x)).toBeLessThanOrEqual(1);
   expect(Math.abs(box.x+box.width-menu.x-menu.width)).toBeLessThanOrEqual(1);
   expect(box.height).toBeGreaterThanOrEqual(hasTouch?43.5:31.5);
   await input.fill('  Felt easy  ');
   // Input must synchronously mirror the untrimmed value without replacing the focused field.
   expect(await input.evaluate(el=>({focused:el===document.activeElement,note:JSON.parse(localStorage.getItem('gpb.activeWorkout')).log.exercises[0].sets[1].note}))).toEqual({focused:true,note:'  Felt easy  '});
   await input.press('Enter');
   const text=row.locator('button.log-set-note-text');
   await expect(text).toHaveText('Felt easy');
   await expect(input).toHaveCount(0);
   await expect(text).toBeFocused();
   expect((await text.boundingBox()).height).toBeGreaterThanOrEqual(hasTouch?43.5:31.5);
   await expect.poll(async()=>(await serverRecord(page,id)).log.exercises[0].sets[1].note).toBe('Felt easy');
   await openSetNote(page,2,first,{edit:true});
   expect(await input.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([9,9]);
   await input.fill('x'.repeat(279));await input.pressSequentially('xyz');
   await expect(input).toHaveValue('x'.repeat(280));
   await input.fill('   ');await blur(page);
   await expect(row.locator('.log-set-note-slot')).toBeEmpty();
   await setMenu(page,2,first).click();
   await expect(page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Add note',exact:true})).toBeVisible();
  });

  test('warm-up notes use distinct labels and resume as saved text',async({page})=>{
   test.skip(label==='390 touch','Active phone workouts use Focus; note behavior there is covered by the Focus and long-note tests.');
   const {names:[first]}=await start(page);
   await page.getByRole('button',{name:`Add warm-up, ${first}`,exact:true}).click();
   const input=await openSetNote(page,1,first,{warm:true});
   await input.fill('Light and controlled');await input.press('Enter');
   const text=page.locator('.log-set.is-warmup .log-set-note-text');
   await expect(text).toHaveText('Light and controlled');
   await text.click();await expect(input).toBeFocused();await blur(page);
   await expect(status(page)).toHaveText('Saved');await page.reload();
   await expect(text).toHaveText('Light and controlled');
   await expect(page.locator('.log-set-note-input')).toHaveCount(0);
   await expect(page.locator('.log-set-note-part.is-closed')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`.superpowers/sdd/2026-11-05-tracker-polish-supersets-notes/task-9-${label.replace(' ','-')}.png`,fullPage:true});
  });

  test('removing a set with an open note restores the next menu and leaves no orphan input',async({page})=>{
   test.skip(label==='390 touch','Active phone workouts use Focus; note behavior there is covered by the Focus and long-note tests.');
   const {names:[first]}=await start(page);
   const input=await openSetNote(page,2,first);await input.fill('Remove with this set');
   const row=input.locator('xpath=ancestor::li[contains(@class,"log-set")][1]'),id=await row.getAttribute('data-set-id');
   // Invoke the same menu actions in one browser turn while the note starts focused.
   await input.evaluate(el=>{el.closest('.log-set').querySelector('.log-set-menu').click();[...document.querySelectorAll('.reorder-menu button')].find(b=>b.textContent==='Remove set'&&b.closest(':popover-open')).click();});
   await expect(page.locator(`[data-set-id="${id}"]`)).toHaveCount(0);
   await expect(page.locator('.log-set-note-input')).toHaveCount(0);
   await expect(setMenu(page,2,first)).toBeFocused();
   // The last row focuses Add set when no rows remain.
   for(const n of [2,1]){await setMenu(page,n,first).click();await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Remove set',exact:true}).click();}
   await expect(page.getByRole('button',{name:`Add set, ${first}`,exact:true})).toBeFocused();
  });
 });
}

test('finished set notes autosave',async({page})=>{
 const {id,names:[first]}=await start(page);
 await done(page,1,first).click();await expect(status(page)).toHaveText('Saved');await finish(page);
 await page.goto('/#/workouts/'+id);
 const input=await openSetNote(page,1,first);await input.fill('Felt heavy');await input.press('Enter');
 await expect.poll(async()=>(await serverRecord(page,id)).log.exercises[0].sets[0].note).toBe('Felt heavy');
});

test('set note close retains inert content through the collapse and rapid reopen keeps the new input',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const {names:[first]}=await start(page);
 const input=await openSetNote(page,2,first);
 await expect(input).toBeVisible();
 // Sample a real closing frame immediately, then later animation frames: DOM retention and geometry both matter.
 const samples=await input.evaluate(async el=>{
  const part=el.closest('.log-set-note-part'),row=el.closest('.log-set');
  await new Promise(resolve=>setTimeout(resolve,240));
  const height=part.getBoundingClientRect().height;el.blur();
  const immediately={connected:el.isConnected,inert:part.inert,hidden:part.getAttribute('aria-hidden'),closed:part.classList.contains('is-closed')};
  el.focus();const refocused=document.activeElement===el;
  await new Promise(resolve=>setTimeout(resolve,70));const middle=part.getBoundingClientRect().height;
  row.querySelector('.log-set-menu').click();
  [...document.querySelectorAll('.reorder-menu button')].find(b=>b.textContent==='Add note'&&b.closest(':popover-open')).click();
  return {height,middle,immediately,refocused};
 });
 expect(samples.immediately).toEqual({connected:true,inert:true,hidden:'true',closed:true});
 expect(samples.refocused).toBe(false);expect(samples.middle).toBeGreaterThan(0);expect(samples.middle).toBeLessThan(samples.height);
 await expect(input).toBeFocused();
 await input.fill('Still here');await page.waitForTimeout(350);
 await expect(input).toHaveValue('Still here');await expect(input).toBeFocused();
 await input.press('Enter');await expect(page.locator('.log-set-note-text')).toHaveText('Still here');
});

test('reduced motion settles set note open and close in the same turn',async({browser})=>{
 // Compact touch rows exist above 760px; phones use Focus.
 const context=await browser.newContext({viewport:{width:800,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
 const {names:[first]}=await start(page);
 const input=await openSetNote(page,2,first);
 expect(await input.evaluate(el=>({height:el.getBoundingClientRect().height,transition:getComputedStyle(el.closest('.log-set-note-part')).transitionDuration}))).toEqual({height:44,transition:'0s'});
 const closed=await input.evaluate(el=>{const slot=el.closest('.log-set-note-slot');el.blur();return {connected:el.isConnected,children:slot.childElementCount};});
 expect(closed).toEqual({connected:false,children:0});
 await context.close();
});

test('removing a noted row retains inert content through its closing animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const {names:[first]}=await start(page);
 const input=await openSetNote(page,2,first);await input.fill('Remove this note');
 const result=await input.evaluate(async el=>{
  await new Promise(resolve=>setTimeout(resolve,240));
  const row=el.closest('.log-set'),height=row.getBoundingClientRect().height,id=row.dataset.setId;
  row.querySelector('.log-set-menu').click();
  [...document.querySelectorAll('.reorder-menu button')].find(b=>b.textContent==='Remove set'&&b.closest(':popover-open')).click();
  const retained=row.isConnected&&row.inert&&row.classList.contains('is-removing');
  await new Promise(resolve=>setTimeout(resolve,70));return {id,height,middle:row.getBoundingClientRect().height,retained};
 });
 expect(result.retained).toBe(true);expect(result.middle).toBeGreaterThan(0);expect(result.middle).toBeLessThan(result.height);
 await expect(page.locator(`[data-set-id="${result.id}"]`)).toHaveCount(0);
 await expect(page.locator('.log-set-note-input')).toHaveCount(0);
 await expect(setMenu(page,2,first)).toBeFocused();
});

test('a note typed offline survives reload and syncs once restored',async({page})=>{
 const {id,names:[first]}=await start(page);
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Seat 4');await blur(page);
 await page.reload();
 await expect(page.getByRole('button',{name:editName(first)})).toHaveText('Seat 4');
 await page.unroute('**/api/**');await page.evaluate(()=>dispatchEvent(new Event('online')));
 await expect(status(page)).toHaveText('Saved');
 expect(await noteOf(page,id)).toBe('Seat 4');
});

test('the read-only history view shows the note as text with no add button',async({page})=>{
 const {names:[first,second]}=await start(page);
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 await page.getByLabel('Workout note',{exact:true}).fill('Whole workout read-only');await blur(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Seat 4');await blur(page);
 const input=await openSetNote(page,1,first);await input.fill('Felt heavy');await input.press('Enter');
 await expect(status(page)).toHaveText('Saved');
 await done(page,1,first).click();
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));
 await finish(page);
 await page.locator('.workout-history-row').first().click();
 await expect(page.getByLabel('Start time',{exact:true})).toBeHidden();
 await expect(page.locator('.logger-note .log-note-static')).toHaveText('Whole workout read-only');
 await expect(page.getByRole('button',{name:'Edit workout note',exact:true})).toHaveCount(0);
 await expect(page.locator('.log-note').filter({hasText:'Seat 4'})).toBeVisible();
 await expect(page.locator('.log-set-note-static')).toHaveText('Felt heavy');
 await expect(page.locator('button.log-set-note-text,.log-set-menu:not([hidden]),.log-set-note-input')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^(Add|Edit) note/})).toHaveCount(0);
 await expect(page.locator('.log-exercise').filter({hasText:second}).locator('.log-note')).toBeHidden();
});

test('the note editor animates under normal motion and survives rapid reversal',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const {names:[first]}=await start(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toBeFocused();
 const closing=await page.getByLabel(`Note, ${first}`,{exact:true}).evaluate(async input=>{
  const part=input.closest('.log-note-part');await new Promise(resolve=>setTimeout(resolve,240));
  const height=part.getBoundingClientRect().height;input.blur();
  const retained=input.isConnected&&part.inert&&part.getAttribute('aria-hidden')==='true';
  await new Promise(resolve=>setTimeout(resolve,70));
  return {retained,height,middle:part.getBoundingClientRect().height};
 });
 expect(closing.retained).toBe(true);expect(closing.middle).toBeGreaterThan(0);expect(closing.middle).toBeLessThan(closing.height);
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toBeVisible();
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await blur(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toHaveCount(1);
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toBeFocused();
});


test('workout note saves multiline text, preserves caret through ack and restores offline',async({page})=>{
 const {id}=await start(page);
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 const input=page.getByLabel('Workout note',{exact:true});await expect(input).toBeFocused();
 const shortHeight=await input.evaluate(el=>el.clientHeight);
 await input.fill(('A line of workout context\n').repeat(20));
 expect(await input.evaluate(el=>el.clientHeight)).toBeGreaterThan(shortHeight);
 await input.fill('  Whole workout\ncontext  ');await input.evaluate(el=>{window.noteNode=el;el.setSelectionRange(5,5);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
 await expect(status(page)).toHaveText('Saved');
 await expect(input).toBeFocused();
 expect(await input.evaluate(el=>[el===window.noteNode,el.selectionStart,el.selectionEnd])).toEqual([true,5,5]);
 await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
 await blur(page);await expect(page.getByRole('button',{name:'Edit workout note',exact:true})).toHaveText('Whole workout\ncontext');
 await expect.poll(async()=>(await serverRecord(page,id)).log.note).toBe('Whole workout\ncontext');
 await page.getByRole('button',{name:'Edit workout note',exact:true}).click();await expect(input).toBeFocused();
 expect(await input.evaluate(el=>el.selectionStart)).toBe(21);
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));await input.fill('Offline workout context');await page.reload();
 await expect(page.getByRole('button',{name:'Edit workout note',exact:true})).toHaveText('Offline workout context');
 await page.unroute('**/api/**');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(async()=>(await serverRecord(page,id)).log.note).toBe('Offline workout context');
 await page.getByRole('button',{name:'Edit workout note',exact:true}).click();await input.fill('a'.repeat(2000));await expect(input).toHaveAttribute('maxlength','2000');
 await input.fill('   ');await blur(page);await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeVisible();
});
