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
 const group=card.getByRole('group',{name:/RIR/}),zero=group.getByRole('button',{name:'0',exact:true});
 await zero.click();await expect(zero).toHaveAttribute('aria-pressed','true');await zero.click();await expect(zero).toHaveAttribute('aria-pressed','false');
 const boxes=await group.getByRole('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height};}));expect(boxes.every(r=>r.w>=44&&r.h>=44)).toBe(true);
 await expect(page.getByRole('button',{name:'List view',exact:true})).toHaveCount(0);
});
test('set and exercise notes retain separate scopes across set cards',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]');
 await card.getByRole('button',{name:'Add exercise note, Bench press',exact:true}).click();const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await note.fill('Slow lowering');await note.blur();
 const setAction=card.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true});await expect(setAction).toHaveCSS('border-top-width','0px');await setAction.click();
 const setNote=page.getByLabel('Note, set 1, Bench press',{exact:true});await setNote.fill('Last rep slow');await setNote.press('Enter');
 await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s2'}));
 await expect(page.locator('.focus-card[data-set-id="s2"]')).toContainText('Slow lowering');
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
 await expect(page.locator('.focus-card[data-set-id="s1"] img')).toHaveCount(0);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
 await page.evaluate(async()=>port.command({type:'remove-set',ref:{exerciseId:'straight',setId:'s1'}}));expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
});
test('blank weight is visibly bodyweight without seeding a recorded number',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]');await expect(card.locator('.focus-bodyweight')).toHaveText('BW');
 expect(await page.evaluate(()=>port.read().log.exercises[0].sets[1].weightKg)).toBe(null);
 await card.getByLabel('Set 1 weight, Bench press',{exact:true}).fill('20');await expect(card.locator('.focus-bodyweight')).toBeHidden();
});
test('card puts set note in the RIR row and has no visible feedback line',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'straight',setId:'s1'}));
 const card=page.locator('.focus-card[data-set-id="s1"]'),action=card.locator('.focus-rir-strip').getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true});
 await expect(action).toBeVisible();const box=await action.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 await expect(card.locator('.focus-feedback')).toHaveClass(/visually-hidden/);
 await expect(card.locator('.focus-identity .focus-exercise-note')).toHaveAttribute('aria-label','Add exercise note, Bench press');
 expect((await card.locator('.focus-context').boundingBox()).height).toBeLessThanOrEqual(44);
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
 const widths=await page.locator('.focus-card[data-set-id="s1"]').evaluate(card=>({card:card.getBoundingClientRect().width,clip:card.querySelector('.log-set-clip').getBoundingClientRect().width,note:card.querySelector('.focus-exercise-note-text').getBoundingClientRect().width}));
 expect(widths.clip).toBeLessThanOrEqual(widths.card);expect(widths.note).toBeLessThanOrEqual(widths.card);
});
