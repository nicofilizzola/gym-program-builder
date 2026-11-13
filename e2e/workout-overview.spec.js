import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function mount(page,log,{viewed}={}){await mountFocusFixture(page,{log});await page.evaluate(async viewed=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');window.overview=mountWorkoutOverview({port,onJump:ref=>focusView.jump(ref,{focus:true}),onActivity:v=>focusView.suspend(v)});if(viewed)focusView.jump(viewed);overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));},viewed);return page.getByRole('dialog',{name:'Workout overview'});}
const act=async(page,d,name,item)=>{await d.getByRole('button',{name:`Actions, ${name}`,exact:true}).click();await page.getByRole('button',{name:item,exact:true}).click();};
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
 const d=await mount(page);await expect(d.locator('p:not([hidden])',{hasText:'No sets'})).toBeVisible();await act(page,d,'Cable raise','Add set');expect(await page.evaluate(()=>port.read().log.exercises.at(-1).sets.length)).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.focus-overview')).toBeFocused();
});
test('reorder moves pairs as blocks and unlink preserves set identity',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await d.getByRole('button',{name:/Reorder superset/}).press('ArrowUp');expect(await page.evaluate(()=>port.read().log.exercises.slice(0,2).map(e=>e.id))).toEqual(['a','b']);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),top:document.querySelector('.focus-feed').scrollTop,rows:[...document.querySelectorAll('.focus-feed .focus-card')].map(r=>[r.dataset.setId,r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)])}))).toMatchObject({ref:{exerciseId:'a',setId:'a2'}});
 await expect(d.getByRole('button',{name:/^Actions, /})).toHaveCount(4);await expect(d.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(1);await d.getByRole('button',{name:'Unlink superset',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].superset)).toBeUndefined();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
 await expect(d.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Actions, /})).toHaveCount(4);
});
test('note editing uses canonical scope and removing a paired member dissolves pair',async({page})=>{
 const d=await mount(page);await act(page,d,'Bench press','Exercise note');await d.getByRole('textbox',{name:'Note, Bench press',exact:true}).fill('Overview note');await act(page,d,'Chest-supported row','Remove exercise');
 expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='straight').note)).toBe('Overview note');expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='a').superset)).toBeUndefined();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.focus-overview')).toBeFocused();
});
test('picker lives in the dialog and closes without leaking its popover',async({page})=>{
 const d=await mount(page);await act(page,d,'Bench press','Swap exercise');await expect(d.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.exercise-options')).toHaveCount(0);
});
test('catalog swap keeps pair and sets while clearing its target',async({page})=>{
 const d=await mount(page);await act(page,d,'Chest-supported row','Swap exercise');await d.getByRole('combobox',{name:'Exercise',exact:true}).fill('Incline');await page.getByRole('option',{name:/Incline press/}).click();
 expect(await page.evaluate(()=>{const l=port.read().log;return {target:l.exercises[2].target,pair:!!l.exercises[1].superset,sets:l.exercises[2].sets.map(s=>s.id)};})).toEqual({target:null,pair:true,sets:['bw','b1']});
});
test('limits count warmups and working sets together',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log,ex=l.exercises[0];ex.sets=Array.from({length:20},(_,i)=>({...ex.sets[i%3],id:'cap'+i,kind:i<5?'warmup':'working'}));logger.setLog(l);});
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await expect(page.getByRole('button',{name:'Add set',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Add warm-up',exact:true})).toBeDisabled();
});
test('canceling completed-exercise removal keeps overview and log intact',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].done=true;l.exercises[0].sets[1].reps=8;logger.setLog(l);});await act(page,d,'Bench press','Remove exercise');await page.getByRole('dialog',{name:'Remove exercise?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
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

test('the actions menu holds every exercise command',async({page})=>{
 const d=await mount(page);const names=['Add set','Add warm-up','Exercise note','Swap exercise','Remove last set','Remove last warm-up','Remove exercise'],ids=()=>page.evaluate(()=>port.read().log.exercises[0].sets.map(s=>s.id));
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();const g=page.getByRole('group',{name:'Exercise actions',exact:true});await expect(g.getByRole('button')).toHaveText(names);
 await g.getByRole('button',{name:'Remove last set',exact:true}).click();expect(await ids()).toEqual(['sw','s1']);
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await page.getByRole('button',{name:'Remove last warm-up',exact:true}).click();expect(await ids()).toEqual(['s1']);
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await expect(page.getByRole('button',{name:'Remove last warm-up',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await d.getByRole('button',{name:'Actions, Cable raise',exact:true}).click();await expect(page.getByRole('button',{name:/^Remove last/})).toHaveCount(0);
});
test('rows show reorder, name, tags and actions; pairs show one header',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0],{brand:'Hammer',focusTags:['Upper chest']});const d=await mount(page,log);
 const line=d.locator('.overview-line').first();await expect(line.getByRole('button',{name:'Reorder Bench press',exact:true})).toBeVisible();await expect(line.locator('.overview-name')).toContainText('Bench press');
 await expect(line.locator('.overview-tags')).toHaveText('Tags: Hammer · Upper chest');await expect(line.locator('.overview-tags .visually-hidden')).toHaveText('Tags:');await expect(line.getByRole('button',{name:'Actions, Bench press',exact:true})).toBeVisible();
 await expect(d.locator('.overview-tags')).toHaveCount(1);
 const pair=d.locator('.overview-block.is-pair');await expect(pair.getByRole('button',{name:'Reorder superset Single-arm incline dumbbell chest press + Chest-supported row',exact:true})).toHaveCount(1);
 await expect(pair.locator('.overview-pair-head')).toContainText('30 sec between · 1 min 30 sec after round');await expect(pair.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(1);
 await expect(pair.locator('.overview-member')).toHaveText(['A1','A2']);await expect(pair.locator('.overview-line .reorder-action')).toHaveCount(0);
 await d.getByRole('button',{name:'Unlink superset',exact:true}).focus();await expect(page.getByRole('tooltip')).toHaveText('Unlink superset');
});
test('six exercises with four sets fit without scrolling at 390x844',async({page})=>{
 const log=focusFixture(),base=log.exercises[0],set=(id,kind,done,w,r)=>({id,kind,weightKg:w,reps:r,rir:null,done,note:''});
 log.exercises=Array.from({length:6},(_,i)=>({...base,id:'r'+i,name:`Row ${i+1}`,sets:[set('w','warmup',true,40,10),set('a','working',true,80,8),set('b','working',true,80,8),set('c','working',false,null,null)]}));
 const d=await mount(page,log);const m=await d.evaluate(dlg=>({top:dlg.scrollTop,bottom:dlg.getBoundingClientRect().bottom,last:[...dlg.querySelectorAll('.overview-chips')].at(-1).getBoundingClientRect().bottom,h:[...dlg.querySelectorAll('.overview-chips')].map(c=>c.getBoundingClientRect().height)}));
 expect(m.top).toBe(0);expect(m.last).toBeLessThanOrEqual(m.bottom);for(const h of m.h)expect(h).toBeLessThanOrEqual(45);
});
test('removing an exercise from its menu keeps focus in the sheet',async({page})=>{
 const d=await mount(page);await act(page,d,'Cable raise','Remove exercise');await page.waitForTimeout(250);
 await expect(d.getByRole('button',{name:'Actions, Single-arm incline dumbbell chest press',exact:true})).toBeFocused();
});
