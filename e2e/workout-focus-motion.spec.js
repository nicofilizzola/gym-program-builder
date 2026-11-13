import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});
async function prepare(page,clock=true){if(clock)await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});}
test('only explicit completion animates keyed progress then advances to context',async({page})=>{
 await prepare(page,false);await expect(page.locator('.is-celebrating')).toHaveCount(0);await page.evaluate(()=>{logger.setBestPerformance({});logger.setStatus('Saved');});await expect(page.locator('.is-celebrating')).toHaveCount(0);
 await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.focus-progress-segment.is-celebrating')).toHaveCount(1);
 await expect.poll(()=>page.locator('.focus-progress-segment.is-celebrating .focus-progress-fill').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m11)).toBeGreaterThan(0);const scale=await page.locator('.focus-progress-segment.is-celebrating .focus-progress-fill').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m11);expect(scale).toBeLessThan(1);
 await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
});
test('note opening cancels auto-next and undo recheck does not replay celebration',async({page})=>{
 // Paused: real time spent performing the click must not reach the 650ms advance.
 await prepare(page);await page.clock.pauseAt(new Date(Date.now()+60000));const card=page.locator('.focus-card[data-set-id="s1"]');await card.locator('.log-done').click();await page.clock.runFor(600);await card.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true}).click();await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
 await page.evaluate(async()=>{await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});});await expect(page.locator('.is-celebrating')).toHaveCount(0);
});
test('warmup completion advances without filling working progress',async({page})=>{
 await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'straight',setId:'sw'});port.command({type:'patch',ref:{exerciseId:'straight',setId:'sw'},patch:{reps:5}});});await page.locator('.focus-card[data-set-id="sw"] .log-done').click();await expect(page.locator('.focus-progress-segment.is-done')).toHaveCount(0);await page.clock.runFor(650);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});
test('reduced motion is instant and browsing old sets never advances',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await page.locator('.focus-card[data-set-id="s1"] .log-done').click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});await expect(page.locator('.is-celebrating')).toHaveCount(0);
 await page.evaluate(()=>{focusView.jump({exerciseId:'straight',setId:'s1'});port.command({type:'patch',ref:{exerciseId:'straight',setId:'s1'},patch:{reps:9}});});expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});
test('smooth auto-next settles on the destination without changing the viewed ID',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});
 await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
 await expect.poll(()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),r=document.querySelector('.focus-card[data-set-id="s2"]');return {gap:Math.round(f.scrollTop-(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0))),viewed:focusView.visibleRef(),heights:[...f.children].map(n=>n.offsetHeight)};})).toMatchObject({gap:0,viewed:{exerciseId:'straight',setId:'s2'}});
});
test('missing partner round is not celebrated while earlier sets remain open',async({page})=>{
 await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));const card=page.locator('.focus-card[data-set-id="a2"]');await card.locator('.log-done').click();await expect(card.locator('.focus-feedback')).toHaveText('Set complete. Keep building.');await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
});
test('undo burst cancels advancement and delayed history stays inert',async({page})=>{
 await prepare(page);await page.evaluate(async()=>{await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});logger.setBestPerformance({});logger.setStatus('Saved');});await page.clock.runFor(1200);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});await expect(page.locator('.is-celebrating')).toHaveCount(0);
});
test('virtual ruler activation keeps every card height stable',async({page})=>{
 await mountFocusFixture(page);const heights=()=>page.locator('.focus-card').evaluateAll(nodes=>nodes.map(n=>n.offsetHeight));const before=await heights();await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));expect(await heights()).toEqual(before);
});
test('presentation switches stop animation and pending advancement',async({page})=>{
 await prepare(page);await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.is-celebrating')).toHaveCount(2);expect(await page.evaluate(()=>{focusView.setEnabled(false);focusView.setEnabled(true);return document.querySelectorAll('.is-celebrating').length;})).toBe(0);await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});

