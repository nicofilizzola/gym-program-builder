import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('set cards reuse canonical inputs and restore them to compact layout',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await page.getByLabel('Set 1 weight, Bench press',{exact:true}).fill('24.25');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const started=await page.evaluate(async()=>{
  originalWeight.closest('.log-stepper').querySelector('.workout-ruler').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await new Promise(requestAnimationFrame);return originalWeight.getAnimations().some(a=>a.effect.getKeyframes().some(f=>Object.hasOwn(f,'transform')&&Object.hasOwn(f,'opacity')));
 });expect(started).toBe(true);
 const field=page.getByLabel('Set 1 weight, Bench press',{exact:true});await field.fill('82.3');
 await field.evaluate(el=>{el.setSelectionRange(1,3);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
 await page.evaluate(()=>{focusView.setEnabled(false);focusView.setEnabled(true);logger.setLog(port.read().log);logger.setLastTime({});logger.setBestPerformance({});});
 await expect(field).toBeFocused();await expect(field).toHaveValue('82.3');await expect(field).toHaveAttribute('aria-invalid','true');
 expect(await field.evaluate(el=>[el===originalWeight,el.selectionStart,el.selectionEnd,el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>Object.hasOwn(f,'transform')&&Object.hasOwn(f,'opacity'))).length])).toEqual([true,1,3,0]);
 await field.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
 await page.evaluate(async()=>{await port.command({type:'remove-exercise',exerciseId:'straight'});focusView.destroy();});
 expect(await page.evaluate(()=>originalWeight.getAnimations().length)).toBe(0);
});
test('warmups stay individual pages and RIR is one tap',async({page})=>{
 await mountFocusFixture(page);
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'aw'}));await expect(page.locator('.focus-card[data-set-id="aw"] .focus-rir-strip')).toBeHidden();
 await expect(page.locator('.focus-group[data-exercise-id="a"] .focus-card[data-set-id="aw"]')).toBeVisible();await expect(page.locator('.focus-group[data-exercise-id="b"] .focus-card[data-set-id="bw"]')).toHaveCount(1);
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));const card=page.locator('.focus-card[data-set-id="a2"]');await expect(card.locator('.focus-rir-strip')).toBeVisible();
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
// Visible pixels, at rest, of everything after the viewed page: later sets of its group, later groups (their name rows), rounds and the review.
const leak=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),viewed=f.querySelector('.focus-card.is-viewed'),at=viewed?viewed.closest('.focus-round')??viewed:f.querySelector('.focus-review');
 const later=[...f.querySelectorAll('.focus-card,.focus-feed>li')].filter(el=>(at.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&!at.contains(el)&&!el.contains(at));
 return Math.max(0,...later.map(el=>{const b=el.getBoundingClientRect();return Math.min(fb.bottom,b.bottom)-Math.max(fb.top,b.top);}));});
for(const [width,height] of [[360,740],[360,900],[390,844]])test(`no resting page shows the next set, exercise or review at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await mountFocusFixture(page);
 // Straight sets, the boundary into paired warm-ups, warm-up to warm-up, warm-ups to a round, round to round and the last round before the review.
 for(const [exerciseId,setId] of [['straight','sw'],['straight','s1'],['straight','s2'],['a','aw'],['b','bw'],['a','a1'],['a','a2']]){
  await page.evaluate(ref=>focusView.jump(ref),{exerciseId,setId});await expect(page.locator(`.focus-card.is-viewed[data-set-id="${setId}"]`)).toHaveCount(1);
  expect(await leak(page),setId).toBeLessThanOrEqual(0.5);
 }
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
 await expect(page.locator('.focus-card .focus-exercise-title')).toHaveCount(0);await expect(page.locator('.focus-feed>.focus-group')).toHaveCount(3);
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
 await expect.poll(()=>leak(page)).toBeLessThanOrEqual(0.5);
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
test('structure changes keep the round page and the viewed set',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a1'});window.row=port.row({exerciseId:'a',setId:'a1'});window.round=row.closest('.focus-round');});
 const top=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed');return round.offsetTop-f.scrollTop;}),same=()=>page.evaluate(()=>({ref:focusView.visibleRef(),row:port.row({exerciseId:'a',setId:'a1'})===row&&document.contains(row),round:row.closest('.focus-round')===round}));
 await page.evaluate(()=>port.command({type:'add-warmup',exerciseId:'b'}));await expect(page.locator('.focus-group[data-exercise-id="b"] .focus-card')).toHaveCount(2);
 expect(await same()).toEqual({ref:{exerciseId:'a',setId:'a1'},row:true,round:true});expect(Math.abs(await top())).toBeLessThanOrEqual(2);
 await page.evaluate(()=>port.command({type:'unlink',exerciseId:'a'}));await expect.poll(()=>page.evaluate(()=>port.read().log.exercises[1].superset??null)).toBe(null);
 expect(await same()).toMatchObject({ref:{exerciseId:'a',setId:'a1'},row:true,round:false});await expect(page.locator('.focus-round')).toHaveCount(0);
 expect(await page.evaluate(()=>row.closest('.focus-group')?.dataset.exerciseId)).toBe('a');
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
 await expect(page.locator('.focus-round:has([data-set-id="a2"]) .focus-tags')).toHaveCount(0);
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
 await page.locator('.focus-round:has([data-set-id="a1"])').getByRole('button',{name:'Add exercise note, Single-arm incline dumbbell chest press',exact:true}).click();
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

test('populated ruler path records responsive writes and paint work',async({page},testInfo)=>{
 const log=focusFixture(),base=log.exercises[0];
 log.exercises=Array.from({length:6},(_,i)=>({...structuredClone(base),id:i?'exercise-'+i:'straight',target:{...base.target,sets:4,warmupSets:0},sets:Array.from({length:4},(_,j)=>({...base.sets[1],id:i?`set-${i}-${j}`:j?'s'+(j+1):'s1',weightKg:80,reps:8}))}));
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const samples=await page.evaluate(async()=>{
  const input=originalWeight,root=input.closest('.log-stepper').querySelector('.workout-ruler'),track=root.firstElementChild;
  const observer=new MutationObserver(records=>styleMutations+=records.length);observer.observe(track,{attributes:true,attributeFilter:['style']});
  let styleMutations=0,rebuilds=0,frames=0;const original=track.replaceChildren;track.replaceChildren=function(...nodes){rebuilds++;return original.apply(this,nodes);};
  const send=(type,x,y)=>{const start=performance.now();root.dispatchEvent(new PointerEvent(type,{pointerId:11,isPrimary:true,button:0,clientX:x,clientY:y,bubbles:true}));return performance.now()-start;};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>{frames++;resolve();}));
  const read=()=>port.read().log.exercises[0].sets[0].weightKg,samples=[];
  try{
   for(const [name,xs] of [['slow',Array.from({length:8},(_,i)=>100-(i+1)*12)],['fast',Array.from({length:120},(_,i)=>100-(i+1)*2)],['reversal',Array.from({length:40},(_,i)=>i<20?100-i*8:-52+(i-20)*8)]]){
    styleMutations=0;rebuilds=0;frames=0;let duration=0;const values=[];send('pointerdown',100,20);
    for(const [i,x] of xs.entries()){
     const before=read();duration+=send('pointermove',x,i%2?60:20);
     if(read()!==before){if(Number(input.value)!==read())throw Error('canonical input write delayed');values.push(read());}
     if(name==='slow')await frame();
    }
    send('pointerup',xs.at(-1),20);await frame();await frame();styleMutations+=observer.takeRecords().length;
    samples.push({name,moves:xs.length,dispatchMs:duration,frames,styleMutations,rebuilds,values,input:Number(input.value),canonical:read(),saved:saved.at(-1).exercises[0].sets[0].weightKg});
   }
  }finally{observer.disconnect();track.replaceChildren=original;}
  return samples;
 });
 for(const sample of samples){expect(sample.input).toBe(sample.canonical);expect(sample.saved).toBe(sample.canonical);expect(sample.values.length).toBeGreaterThan(0);}
 await testInfo.attach('ruler-work',{body:JSON.stringify({browser:testInfo.project.name||'chromium',viewport:{width:390,height:844},samples}),contentType:'application/json'});
 console.log('ruler-work '+JSON.stringify(samples));
});

test('readout: completion kg and reps fallback never animates canonical inputs',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page);
 await page.evaluate(()=>{logger.setLastTime({v1:{sets:[{kind:'working',weightKg:80,reps:8,rir:5}],note:''}});const next=port.read().log;next.exercises[0].variantId='v1';next.exercises[0].referenceId='r1';logger.setLog(next);focusView.jump({exerciseId:'straight',setId:'s1'});});
 await page.evaluate(()=>focusView.setAutoNext(false));
 const card=page.locator('.focus-card[data-set-id="s1"]');await expect(card.locator('[data-field="weight"]')).toHaveValue('');await expect(card.locator('[data-field="reps"]')).toHaveValue('');
 await card.locator('.log-done').click();await expect(card.locator('[data-field="weight"]')).toHaveValue('80');await expect(card.locator('[data-field="reps"]')).toHaveValue('8');
 expect(await card.locator('input[data-field]').evaluateAll(nodes=>nodes.flatMap(el=>el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>Object.hasOwn(f,'transform')&&Object.hasOwn(f,'opacity'))))).then(a=>a.length)).toBe(0);
 expect(await page.evaluate(()=>port.read().log.exercises[0].sets[1].rir)).toBe(null);
});

// Superset rounds: one page holds both partners; exact refs stay the public address.
const doneLog=(...ids)=>{const log=focusFixture();for(const ex of log.exercises)for(const s of ex.sets)if(ids.includes(s.id))Object.assign(s,{reps:8,done:true});return log;};
const partners=(page,index=0)=>page.locator('.focus-round').nth(index).getByRole('group',{name:'Superset A partners'});
test('a superset round is one page holding both canonical partners',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page);
 await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a1'});window.inputs=[['a','a1'],['b','b1'],['a','a2']].map(([exerciseId,setId])=>port.row({exerciseId,setId}).querySelector('[data-field="reps"]'));});
 const round=page.locator('.focus-round').first();
 await expect(page.locator('.focus-round')).toHaveCount(2);
 expect(await page.evaluate(()=>{const f=document.querySelector('.focus-feed');return [f.querySelectorAll('.focus-group .focus-card').length+f.querySelectorAll('.focus-round').length,f.querySelectorAll('.focus-review').length];})).toEqual([7,1]);
 expect(await page.evaluate(()=>[document.querySelectorAll('input[data-field="reps"]').length,inputs.every(i=>document.querySelector('.focus-feed').contains(i)),inputs.every(i=>document.querySelectorAll('#'+CSS.escape(i.id)).length===1)])).toEqual([8,true,true]);
 expect(await page.evaluate(()=>[getComputedStyle(document.querySelector('.focus-round')).scrollSnapAlign,getComputedStyle(port.row({exerciseId:'a',setId:'a1'})).scrollSnapAlign,getComputedStyle(port.row({exerciseId:'b',setId:'b1'})).scrollSnapAlign])).toEqual(['start','none','none']);
 await expect(round.locator('.focus-round-context')).toContainText('Superset A');await expect(round.locator('.focus-round-context')).toContainText('Round 1 of 2');await expect(round.locator('.focus-round-label svg')).toHaveCount(1);
 const group=round.getByRole('group',{name:'Superset A partners'});await expect(group).toBeVisible();
 const [a,b]=[group.getByRole('button').nth(0),group.getByRole('button').nth(1)];await expect(group.getByRole('button')).toHaveCount(2);
 await expect(a).toHaveAccessibleName('A1, Single-arm incline dumbbell chest press');await expect(b).toHaveAccessibleName('A2, Chest-supported row');
 await expect(a).toHaveAttribute('aria-current','step');await expect(b).not.toHaveAttribute('aria-current');
 for(const button of [a,b]){const r=await button.boundingBox();expect(r.height).toBeGreaterThanOrEqual(44);expect(r.width).toBeGreaterThanOrEqual(44);await expect(button.locator('.focus-partner-check')).toBeHidden();}
 expect(await a.evaluate(el=>getComputedStyle(el.querySelector('.focus-partner-name')).whiteSpace)).not.toBe('nowrap');
 await expect(round.locator('.focus-card[data-set-id="a1"]')).toBeVisible();await expect(round.locator('.focus-card[data-set-id="b1"]')).toBeHidden();
 expect(await page.evaluate(()=>Boolean(port.row({exerciseId:'b',setId:'b1'}).closest('[inert]')))).toBe(true);
 await page.evaluate(()=>{window.roundTop=document.querySelector('.focus-feed').scrollTop;
  window.partnerInput=port.row({exerciseId:'b',setId:'b1'}).querySelector('[data-field="reps"]');
  focusView.jump({exerciseId:'b',setId:'b1'},{animate:true,focus:true});});
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 expect(await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop)).toBeCloseTo(await page.evaluate(()=>roundTop),0);
 await expect(round.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
 expect(await page.evaluate(()=>partnerInput===port.row({exerciseId:'b',setId:'b1'}).querySelector('[data-field="reps"]'))).toBe(true);
 await expect(b).toHaveAttribute('aria-current','step');await expect(a).not.toHaveAttribute('aria-current');
 await expect(round.locator('.focus-card[data-set-id="b1"]')).toBeVisible();await expect(round.locator('.focus-card[data-set-id="a1"]')).toBeHidden();
 await expect(page.locator('.focus-progress-meta')).toContainText('Exercise 3 of 4');
});
test('partner selection and completion are independent',async({page})=>{
 await mountFocusFixture(page,{log:doneLog('a1')});await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const group=partners(page),a=group.getByRole('button').nth(0),b=group.getByRole('button').nth(1);
 // selected + complete, unselected + unfinished
 await expect(a).toHaveAttribute('aria-current','step');await expect(a).toHaveAccessibleName('A1, Single-arm incline dumbbell chest press, complete');await expect(a.locator('.focus-partner-check')).toBeVisible();
 await expect(b).not.toHaveAttribute('aria-current');await expect(b).toHaveAccessibleName('A2, Chest-supported row');await expect(b.locator('.focus-partner-check')).toBeHidden();
 // unselected + complete, selected + unfinished; manual selection never marks or undoes a set
 await b.click();await expect(b).toBeFocused();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 await expect(b).toHaveAttribute('aria-current','step');await expect(b.locator('.focus-partner-check')).toBeHidden();
 await expect(a).not.toHaveAttribute('aria-current');await expect(a.locator('.focus-partner-check')).toBeVisible();
 await a.click();await expect(a).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>port.read().log.exercises.flatMap(e=>e.sets).filter(s=>s.done).map(s=>s.id))).toEqual(['a1']);
});
test('a missing partner keeps its identity but has no set to select',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 const round=page.locator('.focus-round').nth(1),group=partners(page,1),b=group.getByRole('button').nth(1);
 await expect(group.getByRole('button')).toHaveCount(2);await expect(round.locator('.focus-round-context')).toContainText('Round 2 of 2');
 await expect(b).toBeVisible();await expect(b).toBeDisabled();await expect(b).toContainText('No set this round');await expect(b).toContainText('Chest-supported row');
 await expect(b.locator('.focus-partner-check')).toHaveCount(0);await expect(round.locator('.focus-card[data-exercise-id="b"]')).toHaveCount(0);
 await b.click({force:true});expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
});
test('cross-page travel focuses the target at start and publishes on arrival',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const start=await page.evaluate(()=>{focusView.jump({exerciseId:'b',setId:'b1'},{animate:true,focus:true});return {ref:focusView.visibleRef(),focused:document.activeElement.closest('.focus-card')?.dataset.setId,context:document.activeElement.classList.contains('focus-context-text'),position:document.querySelector('.focus-progress-meta').textContent};});
 expect(start).toMatchObject({ref:{exerciseId:'straight',setId:'s1'},focused:'b1',context:true});expect(start.position).toContain('Exercise 1 of 4');
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 await expect(page.locator('.focus-progress-meta')).toContainText('Exercise 3 of 4');
 expect(await page.evaluate(()=>Math.abs(document.querySelector('.focus-round').offsetTop-document.querySelector('.focus-feed').scrollTop))).toBeLessThanOrEqual(1);
});
for(const how of ['pointer','key','wheel','dialog','resize','removal'])test(`interrupted travel settles on an existing set without hidden focus (${how})`,async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await page.evaluate(async how=>{focusView.jump({exerciseId:'b',setId:'b1'},{animate:true,focus:true});await new Promise(r=>setTimeout(r,60));const f=document.querySelector('.focus-feed');
  if(how==='pointer')document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  if(how==='key')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift',bubbles:true}));
  if(how==='wheel')f.dispatchEvent(new WheelEvent('wheel',{deltaY:1,bubbles:true}));
  if(how==='dialog')focusView.suspend(true);
  if(how==='resize')dispatchEvent(new Event('resize'));
  if(how==='removal')await port.command({type:'remove-set',ref:{exerciseId:'b',setId:'b1'}});},how);
 await page.waitForTimeout(400);if(how==='dialog')await page.evaluate(()=>focusView.suspend(false));
 const r=await page.evaluate(()=>{const ref=focusView.visibleRef(),a=document.activeElement;return {exists:Boolean(ref&&port.row(ref)&&document.querySelector('.focus-feed').contains(port.row(ref))),hidden:Boolean(a.closest('[inert]'))||getComputedStyle(a).visibility==='hidden'};});
 expect(r).toEqual({exists:true,hidden:false});
});
test('Back to current selects an unfinished partner in place',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await mountFocusFixture(page,{log:doneLog('sw','s1','s2','aw','bw','a1')});await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const current=page.getByRole('button',{name:'Back to current',exact:true});await expect(current).toBeVisible();const top=await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop);
 await current.click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 expect(await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop)).toBeCloseTo(top,0);await expect(current).toBeHidden();
 await expect(page.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
});
const scrollTo=(page,selector)=>page.evaluate(selector=>{const f=document.querySelector('.focus-feed'),el=document.querySelector(selector);f.scrollTop=el.offsetTop-(parseFloat(el.style.scrollMarginTop)||0);},selector);
test('scrolling to a round restores its remembered, first unfinished or first partner',async({page})=>{
 await mountFocusFixture(page,{log:doneLog('a1')});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await scrollTo(page,'.focus-round');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 await partners(page).getByRole('button').nth(0).click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});
 await scrollTo(page,'.focus-card[data-set-id="s1"]');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
 await scrollTo(page,'.focus-round');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});
 await scrollTo(page,'.focus-round ~ .focus-round');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
 await mountFocusFixture(page,{log:doneLog('a1','b1')});await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 await scrollTo(page,'.focus-round');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});
});
test('reattachment restores the exact stored partner',async({page})=>{
 await mountFocusFixture(page);
 await page.evaluate(async()=>{const {mountWorkoutFocus}=await import('/src/workout-focus-view.js');focusView.destroy();const host=document.createElement('div');document.querySelector('.workout-logger').append(host);
  window.focusView=mountWorkoutFocus(host,{port,ui:{viewed:{exerciseId:'b',setId:'b1'},autoNext:true,weightIncrement:2.5},onInteraction:()=>{},onViewed:()=>{},onFinish:()=>{}});focusView.setEnabled(true);});
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
 await expect(partners(page).getByRole('button').nth(1)).toHaveAttribute('aria-current','step');await expect(page.locator('.focus-card[data-set-id="b1"] [data-field="reps"]')).toBeVisible();
 expect(await page.evaluate(()=>Math.abs(document.querySelector('.focus-round').offsetTop-document.querySelector('.focus-feed').scrollTop))).toBeLessThanOrEqual(1);
});
test('reorder, unlink and member removal keep exact rows and the viewed partner',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'b',setId:'b1'});window.row=port.row({exerciseId:'b',setId:'b1'});window.round=row.closest('.focus-round');});
 await page.evaluate(()=>port.command({type:'move-block',exerciseId:'a',toBlockIndex:0}));await expect.poll(()=>page.evaluate(()=>port.read().log.exercises[0].id)).toBe('a');
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),row:port.row({exerciseId:'b',setId:'b1'})===row,round:row.closest('.focus-round')===round,top:Math.abs(round.offsetTop-document.querySelector('.focus-feed').scrollTop)<=1,current:round.querySelector('[aria-current="step"]')?.textContent}))).toMatchObject({ref:{exerciseId:'b',setId:'b1'},row:true,round:true,top:true,current:expect.stringContaining('A2')});
 await page.evaluate(()=>port.command({type:'unlink',exerciseId:'a'}));await expect(page.locator('.focus-round')).toHaveCount(0);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),row:port.row({exerciseId:'b',setId:'b1'})===row,group:row.closest('.focus-group')?.dataset.exerciseId,inert:Boolean(row.closest('[inert]'))}))).toEqual({ref:{exerciseId:'b',setId:'b1'},row:true,group:'b',inert:false});
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a1'});window.row=port.row({exerciseId:'a',setId:'a1'});});
 await page.evaluate(()=>port.command({type:'remove-exercise',exerciseId:'b'}));await expect.poll(()=>page.evaluate(()=>port.read().log.exercises.some(e=>e.id==='b'))).toBe(false);
 await expect(page.locator('.focus-round')).toHaveCount(0);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),row:port.row({exerciseId:'a',setId:'a1'})===row,group:row.closest('.focus-group')?.dataset.exerciseId}))).toEqual({ref:{exerciseId:'a',setId:'a1'},row:true,group:'a'});
});
// A compact round relocates the selected note actions into its context; retiring the round returns them to their rows.
for(const [how,command,row] of [['unlink',{type:'unlink',exerciseId:'a'},'a1'],['member removal',{type:'remove-exercise',exerciseId:'b'},'a1']])test(`retiring a compact round (${how}) returns the relocated note actions`,async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a1'});focusView.setFeedHeight(300);});
 const setNote=page.getByRole('button',{name:`Add set note, Set 1, ${A_NAME}`,exact:true}),exNote=page.getByRole('button',{name:`Add exercise note, ${A_NAME}`,exact:true});
 await expect(page.locator('.focus-round-context').first().locator('.focus-set-note')).toHaveCount(1);
 await setNote.focus();await page.evaluate(command=>port.command(command),command);await expect(page.locator('.focus-round')).toHaveCount(0);
 await expect(page.locator(`.focus-card[data-set-id="${row}"] .focus-set-note`)).toHaveCount(1);await expect(setNote).toHaveCount(1);await expect(exNote).toHaveCount(1);
 expect(await page.evaluate(()=>document.activeElement===document.body)).toBe(false);
 await expect(page.locator('.focus-group[data-exercise-id="a"]').getByRole('button',{name:`Add exercise note, ${A_NAME}`,exact:true})).toHaveCount(1);
 if(how==='unlink')await expect(page.locator('.focus-card[data-set-id="a2"] .focus-set-note')).toHaveCount(1);
});
// Completion actions say what they log; the canonical done button keeps its handler and regains its own name outside Focus.
const doneButton=(page,id)=>page.locator(`.focus-card[data-set-id="${id}"] .log-done`);
async function named(page,id,name){const b=doneButton(page,id);await expect(b).toHaveAccessibleName(name);await expect(b).toHaveAttribute('data-label',name);await expect(b).not.toHaveAttribute('aria-pressed');}
const viewAt=(page,setId)=>page.evaluate(setId=>focusView.jump({exerciseId:setId[0]==='b'?'b':'a',setId}),setId);
test('round completion is explicit for either partner, validated and undone per member',async({page})=>{
 await mountFocusFixture(page);await viewAt(page,'a1');
 await named(page,'a1','Log A1 & switch to A2');await expect(page.getByRole('button',{name:'Log A1 & switch to A2',exact:true})).toBeVisible();
 await viewAt(page,'b1');await named(page,'b1','Log A2 & switch to A1');await viewAt(page,'a2');await named(page,'a2','Complete round');
 // Invalid reps: the existing error field takes focus; nothing is logged, moved or inferred.
 await viewAt(page,'a1');const top=await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop);await page.getByLabel('Set 1 reps, Single-arm incline dumbbell chest press',{exact:true}).fill('0');await page.evaluate(()=>document.activeElement.blur());await doneButton(page,'a1').click();
 await expect(page.getByLabel('Set 1 reps, Single-arm incline dumbbell chest press',{exact:true})).toBeFocused();
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),done:port.read().log.exercises.flatMap(e=>e.sets).filter(s=>s.done).length,rir:port.read().log.exercises[1].sets[1].rir}))).toEqual({ref:{exerciseId:'a',setId:'a1'},done:0,rir:null});
 await page.getByLabel('Set 1 reps, Single-arm incline dumbbell chest press',{exact:true}).fill('8');await doneButton(page,'a1').click();
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});expect(await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop)).toBeCloseTo(top,0);
 await named(page,'b1','Complete round');await expect(page.locator('.focus-progress-meta')).toContainText('1 / 5 working sets');
 await page.getByLabel('Set 1 reps, Chest-supported row',{exact:true}).fill('9');await doneButton(page,'b1').click();await named(page,'b1','Undo A2 completion');
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
 await viewAt(page,'a1');await named(page,'a1','Undo A1 completion');await doneButton(page,'a1').click();
 expect(await page.evaluate(()=>port.read().log.exercises.flatMap(e=>e.sets).filter(s=>s.id==='a1'||s.id==='b1').map(s=>[s.id,s.done,s.reps]))).toEqual([['a1',false,8],['b1',true,9]]);
 await named(page,'a1','Complete round');expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});
});
test('with Auto-next off the first partner logs and stays; regular names return outside Focus',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.setAutoNext(false));await viewAt(page,'b1');await named(page,'b1','Log A2');await viewAt(page,'a1');await named(page,'a1','Log A1');
 await page.getByLabel('Set 1 reps, Single-arm incline dumbbell chest press',{exact:true}).fill('8');await doneButton(page,'a1').click();await page.waitForTimeout(800);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a1'});await named(page,'a1','Undo A1 completion');
 await page.evaluate(()=>focusView.setEnabled(false));
 for(const [id,name] of [['a1','Mark set 1 done, Single-arm incline dumbbell chest press'],['b1','Mark set 1 done, Chest-supported row']]){const b=page.locator(`.log-set[data-set-id="${id}"] .log-done`);await expect(b).toHaveAccessibleName(name);await expect(b).not.toHaveAttribute('aria-labelledby');await expect(b).toHaveAttribute('aria-pressed',id==='a1'?'true':'false');}
});

// Composition: the composing node is never hidden, replaced or blurred; only the latest partner request applies once it ends.
const A1={exerciseId:'a',setId:'a1'},B1={exerciseId:'b',setId:'b1'},A_NAME='Single-arm incline dumbbell chest press';
async function composeOnA1(page){
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 await page.evaluate(()=>{const a=port.row({exerciseId:'a',setId:'a1'}),b=port.row({exerciseId:'b',setId:'b1'});window.held=[a,b].flatMap(r=>['weight','reps'].map(f=>r.querySelector(`[data-field="${f}"]`)));});
 await page.getByLabel(`Set 1 weight, ${A_NAME}`,{exact:true}).fill('82.3');
 const round=page.locator('.focus-round').first();
 await round.getByRole('button',{name:`Add exercise note, ${A_NAME}`,exact:true}).click();const exerciseNote=page.getByRole('textbox',{name:`Note, ${A_NAME}`,exact:true});await exerciseNote.fill('Slow descent');await exerciseNote.blur();
 await round.getByRole('button',{name:`Add set note, Set 1, ${A_NAME}`,exact:true}).click();const note=page.getByLabel(`Note, set 1, ${A_NAME}`,{exact:true});await note.fill('  Tempo  ');
 await note.evaluate(n=>{window.composingNote=n;n.setSelectionRange(2,5);n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
 return note;
}
const composingIntact=page=>page.evaluate(()=>({same:document.activeElement===composingNote,value:composingNote.value,range:[composingNote.selectionStart,composingNote.selectionEnd],viewed:focusView.visibleRef(),inert:composingNote.closest('.focus-pair-pane').inert}));
const heldIntact=page=>page.evaluate(()=>{const a=port.row({exerciseId:'a',setId:'a1'}),b=port.row({exerciseId:'b',setId:'b1'});return [a,b].flatMap(r=>['weight','reps'].map(f=>r.querySelector(`[data-field="${f}"]`))).every((n,i)=>n===held[i]);});
test('partner switching waits for composition and preserves invalid drafts',async({page})=>{
 const note=await composeOnA1(page);
 await page.evaluate(()=>{focusView.jump({exerciseId:'b',setId:'b1'});focusView.jump({exerciseId:'a',setId:'a1'});focusView.jump({exerciseId:'b',setId:'b1'});logger.setStatus('Saved');logger.setLastTime({});focusView.setEnabled(false);focusView.setEnabled(true);});
 expect(await composingIntact(page)).toEqual({same:true,value:'  Tempo  ',range:[2,5],viewed:A1,inert:false});
 await note.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
 await expect(page.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual(B1);
 await expect(page.locator('.focus-card[data-set-id="b1"]')).toBeVisible();await expect(page.locator('.focus-card[data-set-id="a1"]')).toBeHidden();
 // Ordinary blur trimming through the existing note path; the invalid weight stays as typed and nothing completes.
 const weight=page.getByLabel(`Set 1 weight, ${A_NAME}`,{exact:true});await expect(weight).toHaveValue('82.3');await expect(weight).toHaveAttribute('aria-invalid','true');expect(await heldIntact(page)).toBe(true);
 expect(await page.evaluate(()=>{const l=port.read().log;return {note:l.exercises[1].sets[1].note,exerciseNote:l.exercises[1].note,done:l.exercises.flatMap(e=>e.sets).filter(s=>s.done).length};})).toEqual({note:'Tempo',exerciseNote:'Slow descent',done:0});
});
test('a final request for the selected partner cancels the queued switch',async({page})=>{
 const note=await composeOnA1(page);
 await page.evaluate(()=>{focusView.jump({exerciseId:'b',setId:'b1'});focusView.jump({exerciseId:'a',setId:'a1'});focusView.jump({exerciseId:'b',setId:'b1'});focusView.jump({exerciseId:'a',setId:'a1'});});
 await note.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
 expect(await composingIntact(page)).toEqual({same:true,value:'  Tempo  ',range:[2,5],viewed:A1,inert:false});expect(await heldIntact(page)).toBe(true);
 await expect(page.locator('.focus-round').first().locator('.focus-partner').nth(0)).toHaveAttribute('aria-current','step');
});
test('a partner removed during composition falls back safely',async({page})=>{
 const note=await composeOnA1(page);
 await page.evaluate(async()=>{focusView.jump({exerciseId:'b',setId:'b1'});await port.command({type:'remove-set',ref:{exerciseId:'b',setId:'b1'}});});
 await note.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
 expect(await composingIntact(page)).toMatchObject({same:true,viewed:A1,inert:false});await expect(page.locator('.focus-card[data-set-id="a1"]')).toBeVisible();
});
test('a selector tap on a non-viewed round moves the rulers to the newly shown partner',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'b',setId:'bw'}));
 const rulers=()=>page.evaluate(()=>['a1','b1'].map(id=>!document.querySelector(`.focus-card[data-set-id="${id}"] .workout-ruler`).hidden));
 expect(await rulers()).toEqual([true,false]);
 await page.evaluate(()=>document.querySelectorAll('.focus-round')[0].querySelectorAll('.focus-partner')[1].click());
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'bw'});expect(await rulers()).toEqual([false,true]);
});
const colorOf=(page,value,property='color')=>page.evaluate(([value,property])=>{const probe=document.createElement('i');probe.style[property]=value;document.body.append(probe);const c=getComputedStyle(probe)[property];probe.remove();return c;},[value,property]);
test('each incoming exercise block carries one full-width accent rule on its name row, never per set',async({page})=>{
 await mountFocusFixture(page);const accent=await colorOf(page,'var(--accent)');
 const r=await page.evaluate(accent=>{const f=document.querySelector('.focus-feed'),ruled=[...f.querySelectorAll('*')].filter(el=>{const s=getComputedStyle(el);return s.borderTopWidth==='2px'&&s.borderTopStyle==='solid'&&s.borderTopColor===accent;});
  return {ruled:ruled.map(el=>el.className),names:[...f.querySelectorAll('.focus-group>.focus-group-name')].length,full:ruled.every(el=>Math.abs(el.getBoundingClientRect().width-f.clientWidth)<=1)};},accent);
 expect(r.ruled).toEqual(Array(r.names).fill('focus-group-name'));expect(r.names).toBe(3);expect(r.full).toBe(true);
});
test('warm-ups are a quieter page with a prominent label and the same targets as working sets',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'sw'}));
 const warm=page.locator('.focus-card[data-set-id="sw"]'),work=page.locator('.focus-card[data-set-id="s1"]'),[surface,border]=await Promise.all([colorOf(page,'var(--surface)','backgroundColor'),colorOf(page,'var(--border)','borderTopColor')]);
 await expect(warm.locator('.focus-set-label')).toHaveText('Warm-up · W1');
 const s=await warm.locator('.focus-context').evaluate(el=>{const s=getComputedStyle(el),l=getComputedStyle(el.querySelector('.focus-set-label'));return {bg:s.backgroundColor,border:[s.borderTopWidth,s.borderTopStyle,s.borderTopColor],weight:Number(l.fontWeight)};});
 expect(s.bg).toBe(surface);expect(s.border).toEqual(['1px','solid',border]);expect(s.weight).toBeGreaterThanOrEqual(600);
 await expect(work.locator('.focus-context')).not.toHaveCSS('background-color',surface);
 await expect(warm.locator('.focus-rir-strip')).toBeHidden();await expect(warm.getByRole('button',{name:'Add set note, Warm-up set 1, Bench press',exact:true})).toBeVisible();
 const size=async card=>card.evaluate(c=>{const d=c.querySelector('.log-done').getBoundingClientRect();return {done:[Math.round(d.width),Math.round(d.height)],font:getComputedStyle(c.querySelector('[data-field="reps"]')).fontSize};});
 const w=await size(warm);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));expect(w).toEqual(await size(work));expect(w.done[1]).toBeGreaterThanOrEqual(44);
 // A paired exercise's warm-up has no partner selector and completes on its own, with the same required reps.
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'aw'}));const aw=page.locator('.focus-card[data-set-id="aw"]');
 await expect(aw.locator('.focus-set-label')).toHaveText('Warm-up · W1');expect(await aw.evaluate(c=>[Boolean(c.closest('.focus-round')),Boolean(c.closest('.focus-group').querySelector('.focus-partners'))])).toEqual([false,false]);
 await aw.locator('.log-done').click();expect(await page.evaluate(()=>port.read().log.exercises[1].sets[0].done)).toBe(false);
 await aw.getByRole('textbox',{name:/reps/}).fill('10');await aw.locator('.log-done').click();expect(await page.evaluate(()=>port.read().log.exercises[1].sets[0].done)).toBe(true);
});
test('a round shows its set context once: no repeated superset or round eyebrow, the accessible name keeps exercise and set',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const ctx=page.locator('.focus-card[data-set-id="a1"] .focus-context-text');
 await expect(ctx).toHaveAttribute('aria-label','A1 · Round 1, Single-arm incline dumbbell chest press');
 await expect(ctx).not.toContainText('Superset');await expect(ctx).not.toContainText('Round');await expect(ctx).not.toContainText('Paired with');
});
