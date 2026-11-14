import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('set cards reuse canonical inputs and restore them to compact layout',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await page.screenshot({path:'.superpowers/sdd/2026-11-08-mobile-workout-focus/focus-card-390.png'});
 const field=page.getByLabel('Set 1 weight, Bench press',{exact:true});await field.fill('82.3');
 await page.evaluate(()=>focusView.setEnabled(false));await expect(field).toBeFocused();await expect(field).toHaveValue('82.3');
 expect(await page.evaluate(()=>originalWeight===port.row({exerciseId:'straight',setId:'s1'}).querySelector('[data-field="weight"]'))).toBe(true);
 await page.evaluate(()=>focusView.setEnabled(true));await expect(field).toHaveValue('82.3');await expect(field).toBeFocused();
});
test('warmups and unequal supersets show execution context and RIR is one tap',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 const card=page.locator('.focus-card[data-set-id="a2"]');await expect(card).toContainText('No partner set this round');
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'aw'}));await expect(page.locator('.focus-card[data-set-id="aw"] .focus-rir-strip')).toBeHidden();await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));await expect(card.locator('.focus-rir-strip')).toBeVisible();
 const group=card.getByRole('group',{name:/RIR/}),zero=group.getByRole('button',{name:'0',exact:true});
 await zero.click();await expect(zero).toHaveAttribute('aria-pressed','true');await zero.click();await expect(zero).toHaveAttribute('aria-pressed','false');
 const boxes=await group.getByRole('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height};}));expect(boxes.every(r=>r.w>=44&&r.h>=44)).toBe(true);
 await expect(page.getByRole('button',{name:'List view',exact:true})).toHaveCount(0);
});
test('set and exercise notes retain separate scopes across set cards',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]'),group=page.locator('.focus-group[data-exercise-id="straight"]');
 await group.getByRole('button',{name:'Add exercise note, Bench press',exact:true}).click();const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await note.fill('Slow lowering');await note.blur();
 const setAction=card.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true});await expect(setAction).toHaveCSS('border-top-width','0px');await setAction.click();
 const setNote=page.getByLabel('Note, set 1, Bench press',{exact:true});await setNote.fill('Last rep slow');await setNote.press('Enter');
 await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 await expect(group).toContainText('Slow lowering');
 expect(await page.evaluate(()=>port.read().log.exercises[0].sets[2].note)).toBe('');
});
test('oversized notes remain reachable without overlapping adjacent cards',async({page})=>{
 const log=focusFixture();log.exercises[0].note='A long exercise note. '.repeat(45).slice(0,1000);log.exercises[0].sets[1].note='Set note '.repeat(40).slice(0,280);
 await page.setViewportSize({width:360,height:740});await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]'),done=card.getByRole('button',{name:'Mark set 1 done, Bench press',exact:true});await done.scrollIntoViewIfNeeded();await expect(done).toBeVisible();
 const layout=await page.evaluate(()=>{const a=document.querySelector('.focus-card[data-set-id="s1"]'),b=document.querySelector('.focus-card[data-set-id="s2"]');return {a:a.getBoundingClientRect().bottom,b:b.getBoundingClientRect().top,width:document.documentElement.scrollWidth};});expect(layout.b).toBeGreaterThanOrEqual(layout.a-1);expect(layout.width).toBeLessThanOrEqual(360);
});
test('history updates and removal preserve viewed identity and safe literal text',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'straight',setId:'s1'});const next=port.read().log;next.exercises[0].name='<img src=x>';logger.setLog(next);logger.setBestPerformance({});});
 await expect(page.locator('.focus-feed img')).toHaveCount(0);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
 await page.evaluate(async()=>port.command({type:'remove-set',ref:{exerciseId:'straight',setId:'s1'}}));expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
});
test('blank weight is visibly bodyweight without seeding a recorded number',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]');await expect(card.locator('.focus-bodyweight')).toHaveText('BW');
 expect(await page.evaluate(()=>port.read().log.exercises[0].sets[1].weightKg)).toBe(null);
 await card.getByLabel('Set 1 weight, Bench press',{exact:true}).fill('20');await expect(card.locator('.focus-bodyweight')).toBeHidden();
});
test('card puts the set note on the header row and the RIR row holds only RIR',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]'),action=card.locator('.focus-context').getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true});
 await expect(action).toBeVisible();const box=await action.boundingBox(),marker=await card.locator('.focus-complete-marker').boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeLessThanOrEqual(marker.x+0.5);
 await expect(card.locator('.focus-rir-strip button')).toHaveCount(6);
 await expect(card.locator('.focus-feedback')).toHaveClass(/visually-hidden/);
 await expect(page.locator('.focus-group[data-exercise-id="straight"] .focus-group-name .focus-exercise-note')).toHaveAttribute('aria-label','Add exercise note, Bench press');
 expect((await card.locator('.focus-context').boundingBox()).height).toBeCloseTo(44,0);
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'aw'}));
 await expect(page.locator('.focus-card[data-set-id="aw"] .focus-context').getByRole('button',{name:/^Add set note, Warm-up set 1/})).toBeVisible();
});
test('completion milestone reads in the Complete button',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]'),done=card.locator('.log-done');
 await card.getByLabel('Set 1 reps, Bench press',{exact:true}).fill('8');await done.click();
 await expect(done).toHaveAttribute('data-label',/ · Tap to undo$/);
 await expect(done).not.toHaveAttribute('data-label','Set complete · Tap to undo');
 await expect(card.locator('.focus-feedback')).not.toHaveText('');
});
test('a long unbreakable exercise name never widens the card',async({page})=>{
 const log=focusFixture();log.exercises[0].name='Another 23740b88-15c4-42d1-a134-1f80e39a698c';log.exercises[0].note='word '.repeat(60).trim();
 await page.setViewportSize({width:360,height:800});await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const widths=await page.locator('.focus-card[data-set-id="s1"]').evaluate(card=>({card:card.getBoundingClientRect().width,clip:card.querySelector('.log-set-clip').getBoundingClientRect().width,note:card.closest('.focus-group').querySelector('.focus-exercise-note-text').getBoundingClientRect().width}));
 expect(widths.clip).toBeLessThanOrEqual(widths.card);expect(widths.note).toBeLessThanOrEqual(widths.card);
});
// Visible pixels of an element inside the feed's box.
const shown=(page,selector)=>page.evaluate(selector=>{const f=document.querySelector('.focus-feed').getBoundingClientRect(),b=document.querySelector(selector).getBoundingClientRect();return {px:Math.max(0,Math.min(f.bottom,b.bottom)-Math.max(f.top,b.top)),h:b.height};},selector);
test('last set before review never peeks',async({page})=>{
 await page.setViewportSize({width:360,height:740});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await expect(page.locator('.focus-card[data-set-id="a2"]')).toHaveClass(/is-peekless/);
 await expect.poll(async()=>(await shown(page,'.focus-review h2')).px).toBe(0);
});
test('the next exercise peeks its whole name row, never its details',async({page})=>{
 await page.setViewportSize({width:360,height:900});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 const next='.focus-group[data-exercise-id="a"]';
 await expect.poll(async()=>{const h=await shown(page,next+' .focus-group-name');return h.px===0||Math.abs(h.px-h.h)<=1;}).toBe(true);
 expect((await shown(page,next+' .focus-group-details')).px).toBeLessThanOrEqual(1); // offsetTop and scrollTop are whole pixels
 expect((await shown(page,'.focus-card[data-set-id="aw"] .focus-context')).px).toBeLessThanOrEqual(1);
});
// Pinned geometry: the name row top and the viewed row top relative to the feed and the details' bottom.
const pin=(page,setId)=>page.evaluate(setId=>{const f=document.querySelector('.focus-feed').getBoundingClientRect(),row=document.querySelector(`.focus-card[data-set-id="${setId}"]`),g=row.closest('.focus-group');
 return {name:g.querySelector('.focus-group-name').getBoundingClientRect().top-f.top,row:row.getBoundingClientRect().top-g.querySelector('.focus-group-details').getBoundingClientRect().bottom};},setId);
test('the exercise block stays pinned while its sets snap under it',async({page})=>{
 await mountFocusFixture(page);
 for(const setId of ['sw','s1','s2']){await page.evaluate(setId=>focusView.jump({exerciseId:'straight',setId}),setId);const p=await pin(page,setId);expect(Math.abs(p.name),setId+JSON.stringify(p)).toBeLessThanOrEqual(1);expect(Math.abs(p.row),setId+JSON.stringify(p)).toBeLessThanOrEqual(1);}
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'aw'}));
 expect(await page.evaluate(()=>document.querySelector('.focus-group[data-exercise-id="straight"] .focus-group-name').getBoundingClientRect().bottom-document.querySelector('.focus-feed').getBoundingClientRect().top)).toBeLessThanOrEqual(1);
});
test('each exercise shows its title, tags, note and history once',async({page})=>{
 await mountFocusFixture(page);const group=page.locator('.focus-group[data-exercise-id="straight"]');
 await expect(group.locator('.focus-exercise-title')).toHaveCount(1);await expect(group.locator('.focus-history')).toHaveCount(1);
 await expect(group.getByRole('button',{name:'Add exercise note, Bench press',exact:true})).toHaveCount(1);
 await expect(page.locator('.focus-card .focus-exercise-title')).toHaveCount(0);await expect(page.locator('.focus-feed>.focus-group')).toHaveCount(6);
});
test('each superset round set brings its own block',async({page})=>{
 await mountFocusFixture(page);
 for(const [exerciseId,setId,name] of [['a','a1','Single-arm incline dumbbell chest press'],['b','b1','Chest-supported row'],['a','a2','Single-arm incline dumbbell chest press']]){
  await page.evaluate(ref=>focusView.jump(ref),{exerciseId,setId});
  expect(await page.evaluate(()=>{const top=document.querySelector('.focus-feed').getBoundingClientRect().top;return [...document.querySelectorAll('.focus-group-name')].find(n=>{const b=n.getBoundingClientRect();return Math.abs(b.top-top)<=1&&b.bottom>top+1;})?.querySelector('.focus-exercise-title').getAttribute('aria-label');})).toBe(name);
 }
});
// Logger renders call place() for every row; some (opening a set note) publish nothing afterwards, so update() never regroups.
test('a logger save keeps rows in their groups',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 const read=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),r=f.querySelector('.focus-card[data-set-id="s2"]'),snapTop=r=>r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0);
  return {grouped:r.parentElement===f.querySelector('.focus-group[data-exercise-id="straight"] .focus-group-sets'),delta:snapTop(r)-f.scrollTop,saves:saved.length};});
 const before=await read();
 await page.locator('.focus-card[data-set-id="s2"]').getByRole('group',{name:/RIR/}).getByRole('button',{name:'2',exact:true}).click();
 await expect.poll(async()=>(await read()).saves).toBeGreaterThan(before.saves);
 let after=await read();expect(after.grouped).toBe(true);expect(Math.abs(after.delta)).toBeLessThanOrEqual(2);
 await page.locator('.focus-card[data-set-id="s2"] .focus-context').getByRole('button',{name:'Add set note, Set 2, Bench press',exact:true}).click();
 await expect(page.getByLabel('Note, set 2, Bench press',{exact:true})).toBeFocused();
 after=await read();expect(after.grouped).toBe(true);expect(Math.abs(after.delta)).toBeLessThanOrEqual(2);
});
test('closing the exercise note returns the group to its measured state',async({page})=>{
 const log=focusFixture();log.exercises[0].note='A long exercise note. '.repeat(45).slice(0,1000);
 await page.setViewportSize({width:360,height:740});await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const group=page.locator('.focus-group[data-exercise-id="straight"]');await expect(group).toHaveClass(/is-name-only/);
 await group.locator('.focus-group-name').getByRole('button',{name:'Edit exercise note, Bench press',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await expect(note).toBeFocused();await expect(group).not.toHaveClass(/is-name-only/);
 await note.blur();await expect(note).toHaveCount(0);
 await expect(group).toHaveClass(/is-name-only/);await expect(group.locator('.focus-group-name .focus-exercise-note')).toBeVisible();
});
test('opening a long exercise note keeps the viewed set anchored',async({page})=>{
 await page.setViewportSize({width:390,height:900});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const delta=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),snapTop=r=>r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0);return snapTop(f.querySelector('[data-set-id="s1"]'))-f.scrollTop;});const before=await delta();
 await page.locator('.focus-group[data-exercise-id="straight"]').getByRole('button',{name:'Add exercise note, Bench press',exact:true}).click();
 await page.getByRole('textbox',{name:'Note, Bench press',exact:true}).fill('Note '.repeat(80));await page.waitForTimeout(400);
 expect(Math.abs(await delta()-before)).toBeLessThanOrEqual(2);
 await expect.poll(async()=>{const h=await shown(page,'.focus-card[data-set-id="s2"] .focus-context');return h.px<=1||Math.abs(h.px-h.h)<=1;}).toBe(true);
});
const snapDelta=(page,setId)=>page.evaluate(setId=>{const f=document.querySelector('.focus-feed'),r=f.querySelector(`[data-set-id="${setId}"]`);return r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop;},setId);
// 390x740: the logger's own 14rem cap is taller than 40% of this feed, so only the Focus cap holds the editor.
test('an open exercise note stays pinned and capped',async({page})=>{
 await page.setViewportSize({width:390,height:740});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 const before=await snapDelta(page,'s2'),group=page.locator('.focus-group[data-exercise-id="straight"]');
 await group.getByRole('button',{name:'Add exercise note, Bench press',exact:true}).click();
 await page.getByRole('textbox',{name:'Note, Bench press',exact:true}).fill('Note '.repeat(200));await page.waitForTimeout(400);
 await expect(group).not.toHaveClass(/is-name-only/);
 const g=await group.evaluate(g=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect();return {editor:g.querySelector('textarea').getBoundingClientRect().height,feed:f.clientHeight,details:g.querySelector('.focus-group-details').getBoundingClientRect().top-fb.top,name:g.querySelector('.focus-group-name').getBoundingClientRect().height};});
 expect(g.editor,JSON.stringify(g)).toBeLessThanOrEqual(g.feed*.4+1);expect(Math.abs(g.details-g.name),JSON.stringify(g)).toBeLessThanOrEqual(1);
 expect(Math.abs(await snapDelta(page,'s2')-before)).toBeLessThanOrEqual(2);
});
test('tight screens pin only the name row',async({page})=>{
 const log=focusFixture();log.exercises[0].note='A long exercise note. '.repeat(45).slice(0,1000);
 await page.setViewportSize({width:360,height:740});await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 const group=page.locator('.focus-group[data-exercise-id="straight"]');await expect(group).toHaveClass(/is-name-only/);
 const read=()=>group.evaluate(g=>{const fb=document.querySelector('.focus-feed').getBoundingClientRect(),name=g.querySelector('.focus-group-name').getBoundingClientRect(),d=g.querySelector('.focus-group-details').getBoundingClientRect(),done=g.querySelector('[data-set-id="s2"] .log-done').getBoundingClientRect();
  return {name:name.top-fb.top,details:Math.max(0,Math.min(fb.bottom,d.bottom)-Math.max(name.bottom,d.top)),doneInside:done.top>=fb.top-.5&&done.bottom<=fb.bottom+.5};});
 const p=await read();expect(Math.abs(p.name),JSON.stringify(p)).toBeLessThanOrEqual(1);expect(p.details,JSON.stringify(p)).toBeLessThanOrEqual(1);expect(p.doneInside,JSON.stringify(p)).toBe(true);
 await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'sw'}));expect((await read()).details).toBeGreaterThan(1);
});
test('a focused field clears the pinned block',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 const p=await page.evaluate(()=>{const f=document.querySelector('.focus-feed'),g=f.querySelector('.focus-group[data-exercise-id="straight"]'),reps=f.querySelector('[data-set-id="s2"] [data-field="reps"]'),details=g.querySelector('.focus-group-details');
  f.classList.add('is-unsnapped');f.scrollTop+=reps.getBoundingClientRect().top-details.getBoundingClientRect().bottom+20; // the input's top 20px under the block
  const under=reps.getBoundingClientRect().top<details.getBoundingClientRect().bottom;reps.focus();return {under};});
 expect(p.under).toBe(true);await settle(page);
 const r=await page.evaluate(()=>{const g=document.querySelector('.focus-group[data-exercise-id="straight"]');return {input:document.activeElement.getBoundingClientRect().top,pin:g.querySelector('.focus-group-details').getBoundingClientRect().bottom};});
 expect(r.input,JSON.stringify(r)).toBeGreaterThanOrEqual(r.pin-1);
});
test('structure changes keep the group and the viewed set',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a1'});window.row=port.row({exerciseId:'a',setId:'a1'});window.group=row.closest('.focus-group');});
 const before=await snapDelta(page,'a1'),same=()=>page.evaluate(()=>({ref:focusView.visibleRef(),row:port.row({exerciseId:'a',setId:'a1'})===row&&document.contains(row),group:row.closest('.focus-group')===group}));
 await page.evaluate(()=>port.command({type:'add-warmup',exerciseId:'b'}));await expect(page.locator('.focus-group[data-exercise-id="b"] .focus-card')).toHaveCount(3);
 expect(await same()).toEqual({ref:{exerciseId:'a',setId:'a1'},row:true,group:true});expect(Math.abs(await snapDelta(page,'a1')-before)).toBeLessThanOrEqual(2);
 await page.evaluate(()=>port.command({type:'unlink',exerciseId:'a'}));await expect.poll(()=>page.evaluate(()=>port.read().log.exercises[1].superset??null)).toBe(null);
 expect(await same()).toMatchObject({ref:{exerciseId:'a',setId:'a1'},row:true});
});
// Frame-order races: a refit queued before a user scroll, and a scroll landing just after a feed measurement.
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
test('a refit queued before a user scroll keeps the scrolled-to set in place',async({page})=>{
 await page.setViewportSize({width:390,height:900});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'sw'}));
 await page.locator('.focus-card[data-set-id="s2"] [data-field="reps"]').evaluate(n=>n.focus({preventScroll:true})); // typing turns snapping off
 await page.evaluate(()=>new Promise(resolve=>{
  const pad=document.createElement('div');pad.style.height='120px';document.querySelector('.focus-group[data-exercise-id="straight"] .focus-history').append(pad);
  // The ResizeObserver fires after this frame and queues its refit; the scroll lands in the next frame.
  requestAnimationFrame(()=>setTimeout(()=>{const f=document.querySelector('.focus-feed');const r=f.querySelector('[data-set-id="s2"]');f.scrollTop=r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0);resolve();}));
 }));
 await settle(page);
 expect(await page.evaluate(()=>{const f=document.querySelector('.focus-feed'),r=f.querySelector('[data-set-id="s2"]');return Math.abs(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop);})).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
});
test('a scroll right after a feed measurement still moves the viewed set',async({page})=>{
 await page.setViewportSize({width:390,height:900});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'sw'}));
 await page.evaluate(()=>new Promise(resolve=>{focusView.setFeedHeight(560);setTimeout(()=>{const f=document.querySelector('.focus-feed');const r=f.querySelector('[data-set-id="s2"]');f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});resolve();});}));
 await settle(page);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
});
test('the card lists the variant tags under the title',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0],{brand:'Hammer Strength',focusTags:['Upper chest','Stretch']});
 await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const list=page.locator('.focus-group[data-exercise-id="straight"]').getByRole('list',{name:'Tags, Bench press'});
 await expect(list.getByRole('listitem')).toHaveText(['Brand: Hammer Strength','Focus: Upper chest','Focus: Stretch']);
 await expect(list.locator('li .visually-hidden')).toHaveText(['Brand: ','Focus: ','Focus: ']);
 await expect(list.locator('button,a')).toHaveCount(0);await expect(list.locator('.is-brand')).toHaveCount(1);
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await expect(page.locator('.focus-group:has([data-set-id="a2"]) .focus-tags')).toHaveCount(0);
});

for(const motion of ['reduce','no-preference'])test(`exercise note growth anchors without native anchoring (${motion})`,async({page})=>{
 await page.route('**/e2e/fixtures/fonts/fonts.css',r=>r.abort());await page.emulateMedia({reducedMotion:motion});
 await page.setViewportSize({width:390,height:900});await mountFocusFixture(page);await page.addStyleTag({content:'.focus-feed{overflow-anchor:none}'});
 await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));const before=await snapDelta(page,'s1');
 await page.locator('.focus-group[data-exercise-id="straight"]').getByRole('button',{name:'Add exercise note, Bench press',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await note.click();await note.fill('Note '.repeat(80));
 await settle(page);await note.evaluate(n=>Promise.all(n.closest('.focus-group').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await settle(page);
 expect(Math.abs(await snapDelta(page,'s1')-before)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});await expect(note).toBeFocused();
 await page.locator('.focus-card[data-set-id="s1"] .focus-context').hover();await page.mouse.wheel(0,800);
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).not.toEqual({exerciseId:'straight',setId:'s1'});
});
test('unlink transfers the open canonical exercise editor with focus and composition',async({page})=>{
 await page.route('**/e2e/fixtures/fonts/fonts.css',r=>r.abort());await mountFocusFixture(page);
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 await page.locator('.focus-group:has([data-set-id="a1"]) .focus-exercise-note').click();
 const note=page.getByRole('textbox',{name:'Note, Single-arm incline dumbbell chest press',exact:true});await note.fill('retained draft');
 await note.evaluate(n=>{window.openEditor=n;n.setSelectionRange(3,5);n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'draft'}));});
 await page.evaluate(()=>port.command({type:'unlink',exerciseId:'a'}));
 await expect(note).toBeVisible();await expect(note).toBeFocused();
 expect(await note.evaluate(n=>({same:n===openEditor,value:n.value,start:n.selectionStart,end:n.selectionEnd,group:!!n.closest('.focus-group[data-exercise-id="a"]')}))).toEqual({same:true,value:'retained draft',start:3,end:5,group:true});
 await note.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'draft'})));
 await note.fill('continued draft');expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='a').note)).toBe('continued draft');
});

test('a height measurement before the scroll frame keeps the focused set in view',async({page})=>{
 await mountFocusFixture(page);await page.addStyleTag({content:'.focus-feed{overflow-anchor:none}'});
 await page.evaluate(()=>focusView.setFeedHeight(700));await settle(page);
 await page.evaluate(()=>{
  focusView.jump({exerciseId:'straight',setId:'s1'});
  const feed=document.querySelector('.focus-feed'),row=feed.querySelector('[data-set-id="s2"]');
  row.querySelector('[data-field="reps"]').focus({preventScroll:true});
  feed.scrollTop=row.offsetTop-(parseFloat(row.style.scrollMarginTop)||0);
  // A keyboard measurement can beat the rAF that publishes the user's scroll.
  focusView.setFeedHeight(560);
 });
 await settle(page);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
 expect(Math.abs(await snapDelta(page,'s2'))).toBeLessThanOrEqual(2);
 await expect(page.locator('.focus-card[data-set-id="s2"] [data-field="reps"]')).toBeFocused();
});

for(const motion of ['reduce','no-preference'])for(const key of ['Tab','Shift+Tab'])test(`leaving an exercise note by ${key} keeps keyboard focus visible (${motion})`,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});await mountFocusFixture(page);await page.addStyleTag({content:'.focus-feed{overflow-anchor:none}'});
 await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));const before=await snapDelta(page,'s1');
 const group=page.locator('.focus-group[data-exercise-id="straight"]');await group.locator('.focus-exercise-note').click();
 const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await note.fill('Note '.repeat(80));
 await settle(page);await group.evaluate(g=>Promise.all(g.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await settle(page);
 await note.evaluate(n=>n.setSelectionRange(3,5));await page.keyboard.press('ArrowRight');await expect(note).toBeFocused();
 expect(await note.evaluate(n=>[n.selectionStart,n.selectionEnd])).toEqual([5,5]);expect(Math.abs(await snapDelta(page,'s1')-before)).toBeLessThanOrEqual(2);
 await page.keyboard.press(key);await expect(note).toHaveCount(0);await settle(page);
 if(key==='Shift+Tab'){await expect(page.locator('.focus-feed')).toBeFocused();await page.keyboard.press('Tab');await expect(group.locator('.focus-exercise-note')).toBeFocused();}
 else{
  const target=page.locator('.focus-card[data-set-id="sw"] .focus-set-note');await expect(target).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'sw'});
  const box=await target.boundingBox(),feed=await page.locator('.focus-feed').boundingBox();expect(box.y).toBeGreaterThanOrEqual(feed.y);expect(box.y+box.height).toBeLessThanOrEqual(feed.y+feed.height);
 }
});
