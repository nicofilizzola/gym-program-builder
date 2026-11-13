import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function mount(page,log,{viewed}={}){await mountFocusFixture(page,{log});await page.evaluate(async viewed=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');window.overview=mountWorkoutOverview({port,onJump:ref=>focusView.jump(ref,{focus:true}),onActivity:v=>focusView.suspend(v)});if(viewed)focusView.jump(viewed);overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));},viewed);return page.getByRole('dialog',{name:'Workout overview'});}
test('each exercise shows one chip per set with its state',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0].sets[1],{weightKg:80,reps:8,rir:2,done:true});const d=await mount(page,log,{viewed:{exerciseId:'straight',setId:'s2'}});await page.screenshot({path:'.superpowers/sdd/2026-11-12-workout-flow/overview-390.png'});
 await expect(d.getByRole('group',{name:'Sets, Bench press',exact:true}).locator('.overview-chip')).toHaveText(['W —','80×8','—']);
 const done=d.getByRole('button',{name:'Working set 1, Bench press, 80 kg × 8, 2 RIR, complete',exact:true});await expect(done).toHaveClass(/is-done/);await expect(done.locator('svg')).toHaveCount(1);
 const cur=d.getByRole('button',{name:/^Working set 2, Bench press/});await expect(cur).toHaveAttribute('aria-current','step');await expect(cur).toBeFocused();
 await expect(d.getByRole('button',{name:/^Warm-up 1, Bench press.*, up next$/})).toHaveCount(1);
 await expect(d.getByRole('button',{name:/^Working set 2, Single-arm.*, no partner set this round$/})).toHaveCount(1);
 await expect(d.getByRole('heading',{name:/^(Round 1|Warm-ups|Working sets)$/})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Remove (Working set|Warm-up)/})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Set note,/})).toHaveCount(0);
 for(const c of await d.locator('.overview-chip').all()){const r=await c.boundingBox();expect(r.height).toBeGreaterThanOrEqual(44);expect(r.width).toBeGreaterThanOrEqual(56);}
});
test('a chip jumps to its set and the viewed chip only closes',async({page})=>{
 const d=await mount(page,undefined,{viewed:{exerciseId:'straight',setId:'s1'}});
 await d.getByRole('button',{name:'Working set 2, Bench press',exact:true}).click();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
 await page.evaluate(()=>{overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));});await page.getByRole('dialog',{name:'Workout overview'}).getByRole('button',{name:'Working set 2, Bench press',exact:true}).click();await expect(d).toHaveCount(0);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});await expect(page.locator('.focus-overview')).toBeFocused();
});
test('zero-set exercise remains manageable and escape restores opener',async({page})=>{
 const d=await mount(page);await expect(d.locator('p:not([hidden])',{hasText:'No sets'})).toBeVisible();await d.getByRole('button',{name:'Add set, Cable raise',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises.at(-1).sets.length)).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.focus-overview')).toBeFocused();
});
test('reorder moves pairs as blocks and unlink preserves set identity',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await d.getByRole('button',{name:/Reorder superset/}).press('ArrowUp');expect(await page.evaluate(()=>port.read().log.exercises.slice(0,2).map(e=>e.id))).toEqual(['a','b']);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),top:document.querySelector('.focus-feed').scrollTop,rows:[...document.querySelectorAll('.focus-feed .focus-card')].map(r=>[r.dataset.setId,r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)])}))).toMatchObject({ref:{exerciseId:'a',setId:'a2'}});
 await d.getByRole('button',{name:'Unlink superset',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].superset)).toBeUndefined();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
 await expect(d.getByRole('button',{name:/Swap exercise/})).toHaveCount(4);await expect(d.getByRole('button',{name:/Remove exercise/})).toHaveCount(4);
});
test('note editing uses canonical scope and removing a paired member dissolves pair',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Exercise note, Bench press',exact:true}).click();await d.getByRole('textbox',{name:'Note, Bench press',exact:true}).fill('Overview note');await d.getByRole('button',{name:'Remove exercise Chest-supported row',exact:true}).click();
 expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='straight').note)).toBe('Overview note');expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='a').superset)).toBeUndefined();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.focus-overview')).toBeFocused();
});
test('picker lives in the dialog and closes without leaking its popover',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Swap exercise Bench press',exact:true}).click();await expect(d.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.exercise-options')).toHaveCount(0);
});
test('catalog swap keeps pair and sets while clearing its target',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Swap exercise Chest-supported row',exact:true}).click();await d.getByRole('combobox',{name:'Exercise',exact:true}).fill('Incline');await page.getByRole('option',{name:/Incline press/}).click();
 expect(await page.evaluate(()=>{const l=port.read().log;return {target:l.exercises[2].target,pair:!!l.exercises[1].superset,sets:l.exercises[2].sets.map(s=>s.id)};})).toEqual({target:null,pair:true,sets:['bw','b1']});
});
test('limits count warmups and working sets together',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log,ex=l.exercises[0];ex.sets=Array.from({length:20},(_,i)=>({...ex.sets[i%3],id:'cap'+i,kind:i<5?'warmup':'working'}));logger.setLog(l);});
 await expect(d.getByRole('button',{name:'Add set, Bench press',exact:true})).toBeDisabled();await expect(d.getByRole('button',{name:'Add warm-up, Bench press',exact:true})).toBeDisabled();
});
test('canceling completed-exercise removal keeps overview and log intact',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].done=true;l.exercises[0].sets[1].reps=8;logger.setLog(l);});await d.getByRole('button',{name:'Remove exercise Bench press',exact:true}).click();await page.getByRole('dialog',{name:'Remove exercise?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>port.read().log.exercises.length)).toBe(4);await expect(d).toBeVisible();
});
test('blank workouts can add catalog exercises and forty is the cap',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises=[];logger.setLog(l);});await d.getByRole('button',{name:'Add exercise',exact:true}).click();await d.getByRole('combobox',{name:'Exercise',exact:true}).fill('Incline');await page.getByRole('option',{name:/Incline press/}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].name)).toBe('Incline press');
 await page.evaluate(()=>{const l=port.read().log;l.exercises=Array.from({length:40},(_,i)=>({...l.exercises[0],id:'ex'+i,sets:[]}));logger.setLog(l);});await expect(d.getByRole('button',{name:'Add exercise',exact:true})).toBeDisabled();
});
test('repeated variants jump by exercise and set IDs',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].variantId=l.exercises[3].variantId='v9';l.exercises[3].name=l.exercises[0].name;l.exercises[3].sets=[{...l.exercises[0].sets[1],id:'repeat'}];logger.setLog(l);});await d.getByRole('button',{name:/^Working set 1, Bench press/}).last().click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'empty',setId:'repeat'});
});
test('reorder menu remains operable inside the native dialog',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Reorder Bench press',exact:true}).click();await page.getByRole('button',{name:'Move down',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].id)).toBe('a');
});

test.describe('chip motion',()=>{
 test.use({reducedMotion:'no-preference'});
 test('added and removed chips fade',async({page})=>{
  await mount(page);
  const added=await page.evaluate(async()=>{await port.command({type:'add-set',exerciseId:'straight'});const c=[...document.querySelectorAll('.workout-overview [aria-label="Sets, Bench press"] .overview-chip')].at(-1),entering=c.classList.contains('is-entering');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return [entering,c.classList.contains('is-entering')];});
  expect(added).toEqual([true,false]);
  const removed=await page.evaluate(async()=>{const c=document.querySelector('.workout-overview [data-set-id="s2"]');await port.command({type:'remove-set',ref:{exerciseId:'straight',setId:'s2'}});return [c.classList.contains('is-removing'),c.inert,c.isConnected];});
  expect(removed).toEqual([true,true,true]);await page.waitForTimeout(250);expect(await page.evaluate(()=>!!document.querySelector('.workout-overview [data-set-id="s2"]'))).toBe(false);
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(async()=>{await port.command({type:'add-set',exerciseId:'straight'});const c=[...document.querySelectorAll('.workout-overview [aria-label="Sets, Bench press"] .overview-chip')].at(-1);await port.command({type:'remove-set',ref:{exerciseId:'straight',setId:c.dataset.setId}});return c.isConnected;})).toBe(false);
 });
});
test('a done chip keeps its check and refreshes its text on re-render',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0].sets[1],{weightKg:80,reps:8,done:true});const d=await mount(page,log);
 const chip=d.locator('.overview-chip[data-set-id="s1"]');await expect(chip).toHaveText('80×8');
 await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].weightKg=85;logger.setLog(l);});
 await expect(chip).toHaveText('85×8');await expect(chip.locator('svg path')).toHaveCount(1);
 await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].done=false;logger.setLog(l);});
 await expect(chip.locator('svg')).toHaveCount(0);await expect(chip).toHaveText('85×8');
});
