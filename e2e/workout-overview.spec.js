import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function mount(page){await mountFocusFixture(page);await page.evaluate(async()=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');window.overview=mountWorkoutOverview({port,onJump:ref=>focusView.jump(ref,{focus:true}),onActivity:v=>focusView.suspend(v)});overview.open(document.querySelector('.focus-overview'));});return page.getByRole('dialog',{name:'Workout overview'});}
test('groups warmups and working sets and frames uneven superset rounds',async({page})=>{
 const d=await mount(page);await page.screenshot({path:'.superpowers/sdd/2026-11-08-mobile-workout-focus/overview-390.png'});await expect(d.getByRole('heading',{name:'Round 1',exact:true})).toBeVisible();await expect(d).toContainText('No partner set this round');await expect(d.getByRole('button',{name:'Warm-up 1, Bench press',exact:true})).toBeVisible();
 await d.getByRole('button',{name:'Working set 2, Bench press',exact:true}).click();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
});
test('zero-set exercise remains manageable and escape restores opener',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Add set, Cable raise',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises.at(-1).sets.length)).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.focus-overview')).toBeFocused();
});
test('reorder moves pairs as blocks and unlink preserves set identity',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await d.getByRole('button',{name:/Reorder superset/}).press('ArrowUp');expect(await page.evaluate(()=>port.read().log.exercises.slice(0,2).map(e=>e.id))).toEqual(['a','b']);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),top:document.querySelector('.focus-feed').scrollTop,rows:[...document.querySelectorAll('.focus-feed>.focus-card')].map(r=>[r.dataset.setId,r.offsetTop])}))).toMatchObject({ref:{exerciseId:'a',setId:'a2'}});
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
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].variantId=l.exercises[3].variantId='v9';l.exercises[3].name=l.exercises[0].name;l.exercises[3].sets=[{...l.exercises[0].sets[1],id:'repeat'}];logger.setLog(l);});await d.getByRole('button',{name:'Working set 1, Bench press',exact:true}).last().click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'empty',setId:'repeat'});
});
test('reorder menu remains operable inside the native dialog',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Reorder Bench press',exact:true}).click();await page.getByRole('button',{name:'Move down',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].id)).toBe('a');
});

