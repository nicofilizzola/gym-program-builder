import {test,expect} from '@playwright/test';

async function fixture(page) {
 await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  const {validateDocument}=await import('/src/document-validation.js');
  document.body.innerHTML='<div id="fixture"></div>';
  window.supersetChanges=[];window.supersetErrors=[];
  const ex=(name,restSeconds,muscle)=>({name,sets:3,warmupSets:0,restSeconds,repRange:{min:8,max:12},primaryMuscles:[muscle],secondaryMuscles:[]});
  window.editor=mountSessionEditor(document.querySelector('#fixture'),{
   workout:{name:'Upper',goals:{},extraMinutes:0,bufferPercent:0,exercises:[ex('Bench',180,'Chest'),ex('Row',90,'Upper back'),ex('Curl',90,'Biceps')]},
   onChange:value=>{window.supersetChanges.push(value);const result=validateDocument('template',value);if(result.error)window.supersetErrors.push(result.error);}
  });
  await document.fonts.ready;
 });
}
const lastChange=page=>page.evaluate(()=>window.supersetChanges.at(-1));
const expectValidChanges=async page=>expect(await page.evaluate(()=>window.supersetErrors)).toEqual([]);
const names=page=>page.locator('#exercises .exercise .card-name');
const pairButton=(page,name)=>page.getByRole('button',{name:`Superset ${name} with next exercise`,exact:true});

test('pairing builds a superset frame with rest summary and member rules',async({page})=>{
 await fixture(page);
 const cards=page.locator('#exercises .exercise');
 await expect(cards.first().getByRole('button',{name:'Superset Bench with next exercise',exact:true})).toBeAttached();
 await expect(cards.nth(2).getByRole('button',{name:/^Superset .* with next exercise$/})).toHaveCount(0);
 await expect(page.locator('.duration-toggle')).toHaveAccessibleDescription('~27 min');
 await pairButton(page,'Bench').click();
 const frame=page.locator('#exercises > li.superset');
 await expect(frame).toHaveCount(1);
 await expect(frame).toHaveAttribute('data-block-start','0');
 await expect(frame.locator('.superset-members > li.exercise .card-name')).toHaveText(['Bench','Row']);
 await expect(frame.locator('.superset-head')).toContainText('Superset');
 await expect(frame.locator('.superset-head')).toContainText('30 sec between · 3 min after round');
 await expect(page.getByRole('button',{name:/^Superset .* with next exercise$/})).toHaveCount(0);
 expect((await page.locator('#exercises > li').evaluateAll(items=>items.map(item=>item.className.split(' ')[0])))).toEqual(['superset','exercise']);
 await expect(page.locator('.duration-toggle')).toHaveAccessibleDescription('~24 min');
 expect((await lastChange(page)).exercises[0].superset).toEqual({restBetweenSeconds:30,restAfterRoundSeconds:180});
 await expectValidChanges(page);

 for(const member of await frame.locator('.superset-members > li.exercise').all()){
  await member.getByRole('button',{name:/^Expand exercise: /}).click();
  await expect(member.getByText('Rest set by superset',{exact:true})).toBeVisible();
  await expect(member.getByRole('slider',{name:'Rest per set',exact:true})).toHaveCount(0);
  await expect(member.getByRole('button',{name:'Reorder exercise',exact:true})).toHaveCount(0);
  await expect(member.locator('.card-summary')).toHaveText('3 × 8–12 · Superset');
 }
 await expect(cards.nth(2).getByRole('button',{name:'Reorder exercise',exact:true})).toBeVisible();
 await expect(frame.locator('.superset-head .reorder-action')).toHaveAccessibleName('Reorder superset');
});

test('rest settings disclosure edits the pair and updates the readout at once',async({page})=>{
 await fixture(page);await pairButton(page,'Bench').click();
 const settings=page.getByRole('button',{name:'Superset rest settings',exact:true});
 await expect(settings).toHaveAttribute('aria-expanded','false');
 const body=page.locator('#'+await settings.getAttribute('aria-controls'));
 await expect(body).toHaveAttribute('inert','');
 await settings.click();
 await expect(settings).toHaveAttribute('aria-expanded','true');
 const between=page.getByRole('slider',{name:'Rest between exercises',exact:true});
 await expect(between).toBeVisible();await expect(page.getByRole('slider',{name:'Rest after round',exact:true})).toBeVisible();
 await expect(between).toHaveAttribute('aria-valuetext','30 sec');
 await between.focus();await page.keyboard.press('ArrowRight');
 await expect(page.locator('.superset-head')).toContainText('45 sec between · 3 min after round');
 await expect(page.locator('.duration-toggle')).toHaveAccessibleDescription('~25 min');
 expect((await lastChange(page)).exercises[0].superset.restBetweenSeconds).toBe(45);
 await settings.click();await expect(settings).toHaveAttribute('aria-expanded','false');await expect(body).toHaveAttribute('inert','');
 await expectValidChanges(page);
});

test('swap keeps the frame; unlink restores individual rest; removing a member dissolves the pair',async({page})=>{
 await fixture(page);await pairButton(page,'Bench').click();
 const frame=page.locator('#exercises > li.superset');
 await page.getByRole('button',{name:'Swap exercises',exact:true}).click();
 await expect(names(page)).toHaveText(['Row','Bench','Curl']);
 await expect(frame).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Swap exercises',exact:true})).toBeFocused();
 let doc=await lastChange(page);
 expect(doc.exercises.map(ex=>ex.name)).toEqual(['Row','Bench','Curl']);
 expect(doc.exercises[0].superset).toEqual({restBetweenSeconds:30,restAfterRoundSeconds:180});
 expect(Object.hasOwn(doc.exercises[1],'superset')).toBe(false);
 await expect(frame.locator('.exercise').first()).toHaveAttribute('data-index','0');
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(0);
 await expect(names(page)).toHaveText(['Row','Bench','Curl']);
 const bench=page.locator('#exercises > li.exercise').nth(1);
 await bench.getByRole('button',{name:/^Expand exercise: /}).click();
 await expect(bench.getByRole('slider',{name:'Rest per set',exact:true})).toBeVisible();
 await expect(bench.locator('[data-value="restSeconds"]')).toHaveText('3 min');
 doc=await lastChange(page);expect(doc.exercises.some(ex=>ex.superset)).toBe(false);
 await expect(pairButton(page,'Row')).toBeAttached();

 await pairButton(page,'Row').click();await expect(frame).toHaveCount(1);
 await frame.locator('.exercise').nth(1).getByRole('button',{name:'Remove exercise',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(0);
 await expect(names(page)).toHaveText(['Row','Curl']);
 doc=await lastChange(page);expect(doc.exercises.map(ex=>ex.name)).toEqual(['Row','Curl']);expect(doc.exercises.some(ex=>ex.superset)).toBe(false);
 await expectValidChanges(page);
});

test('removing the first member also dissolves the pair and keeps collapsed state aligned',async({page})=>{
 await fixture(page);await pairButton(page,'Bench').click();
 await page.locator('#exercises .exercise').nth(2).getByRole('button',{name:/^Expand exercise: /}).click();
 await page.locator('.superset .exercise').first().getByRole('button',{name:'Remove exercise',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(0);
 await expect(names(page)).toHaveText(['Row','Curl']);
 await expect(page.locator('#exercises > li.exercise').nth(1)).toHaveAttribute('data-collapsed','false');
 await expect(page.locator('#exercises > li.exercise').nth(0)).toHaveAttribute('data-collapsed','true');
 await expectValidChanges(page);
});

test('reduced motion pairs and unpairs without running animations',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await fixture(page);
 const running=()=>page.evaluate(()=>document.getAnimations().length);
 await pairButton(page,'Bench').click();expect(await running()).toBe(0);
 await expect(page.locator('.superset')).toHaveCount(1);
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();expect(await running()).toBe(0);
 await expect(page.locator('.superset')).toHaveCount(0);
 await expectValidChanges(page);
});

test('pair and unlink animate the frame header and rapid reversal is safe',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 await pairButton(page,'Bench').click();
 const head=page.locator('.superset-frame-head');
 expect(await head.evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
 await expect.poll(()=>head.evaluate(el=>el.getAnimations().length)).toBe(0);
 await expect(page.getByRole('button',{name:'Unlink superset',exact:true})).toBeFocused();
 // Unlink starts the closing transition; pairing again before it ends cancels the pending rebuild.
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(1);
 await expect(pairButton(page,'Bench')).toBeFocused();
 await pairButton(page,'Bench').click();
 await page.waitForTimeout(400);
 await expect(page.locator('.superset')).toHaveCount(1);
 await expect(names(page)).toHaveText(['Bench','Row','Curl']);
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(0);
 await expect(pairButton(page,'Bench')).toBeFocused();
 await expectValidChanges(page);
});

test('imports and loads render pairs without animation and untitled names fall back',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);
 await page.evaluate(()=>window.editor.setWorkout({name:'Upper',goals:{},extraMinutes:0,bufferPercent:0,exercises:[
  {name:'',sets:3,warmupSets:0,restSeconds:90,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]},
  {name:'A',sets:3,warmupSets:0,restSeconds:90,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],superset:{restBetweenSeconds:15,restAfterRoundSeconds:90}},
  {name:'B',sets:3,warmupSets:0,restSeconds:90,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}));
 // Body-map heat fills may transition with the new data; the exercise list itself must not animate.
 expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('#exercises')).length)).toBe(0);
 await expect(page.locator('#exercises > li.superset')).toHaveAttribute('data-block-start','1');
 await expect(page.locator('.superset-head')).toContainText('15 sec between · 1 min 30 sec after round');
 await expect(pairButton(page,'Untitled exercise')).toHaveCount(0);
 await expect(page.locator('#exercises .exercise').evaluateAll(cards=>cards.map(card=>card.dataset.index))).resolves.toEqual(['0','1','2']);
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('.superset')).toHaveCount(0);
 await expect(pairButton(page,'Untitled exercise')).toBeAttached();
});
