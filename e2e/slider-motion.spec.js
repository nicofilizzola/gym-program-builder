import {test,expect} from '@playwright/test';

async function fixture(page,reducedMotion='no-preference'){
 await page.emulateMedia({reducedMotion});await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<main id="fixture"></main>';
  window.sliderChanges=[];window.editor=mountSessionEditor(document.querySelector('main'),{workout:{name:'Motion',goals:{Chest:4},extraMinutes:5,bufferPercent:10,exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Chest'],secondaryMuscles:[]}]},onChange:value=>window.sliderChanges.push(value)});
 });await page.getByRole('button',{name:/^Expand exercise: /}).click();
}

test('native slider values stay immediate while visible thumb and fill move together',async({page})=>{
 await fixture(page);const sets=page.getByLabel('Sets',{exact:true});
 await expect(sets.locator('..').locator('.slider-thumb')).toHaveCount(1);
 const result=await sets.evaluate(input=>{const slider=input.parentElement,thumb=slider.querySelector('.slider-thumb'),before=thumb.style.left;input.value=9;input.dispatchEvent(new Event('input',{bubbles:true}));return {before,after:thumb.style.left,value:input.value,readout:slider.closest('.slider-field').querySelector('.slider-value').textContent,sets:window.sliderChanges.at(-1).exercises[0].sets};});
 expect(result.value).toBe('9');expect(result.sets).toBe(9);expect(result.readout).toBe('9');expect(result.after).toBe(result.before);
 await expect.poll(()=>sets.locator('..').locator('.slider-thumb').getAttribute('style')).not.toContain(result.before);
 await expect.poll(()=>sets.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBeCloseTo(8/9,5);
 await sets.focus();await page.keyboard.press('Home');await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');await expect(sets).toHaveValue('9');
 const min=page.getByLabel('Reps min',{exact:true});await min.fill('25');await expect(page.getByLabel('Reps max',{exact:true})).toHaveValue('25');
 await expect.poll(()=>min.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-from')))).toBeCloseTo(24/29,5);
 await page.evaluate(()=>window.editor.destroy());await expect(page.locator('.slider-thumb')).toHaveCount(0);
});

test('reduced motion and programmatic refresh settle slider visuals immediately',async({page})=>{
 await fixture(page,'reduce');const sets=page.getByLabel('Sets',{exact:true});
 await sets.fill('10');await expect(sets.locator('..').locator('.slider-thumb')).toHaveCount(1);
 expect(await sets.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBe(1);
 await page.evaluate(()=>window.editor.setWorkout({name:'Refresh',goals:{},exercises:[{name:'Row',sets:5,repRange:{min:10,max:15},restSeconds:90,primaryMuscles:['Lats'],secondaryMuscles:[]}]}));
 expect(await sets.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBeCloseTo(4/9,5);
});

test('rest, allowances, session goals and weekly goals share synchronized slider presentation',async({page})=>{
 await fixture(page);
 await page.getByRole('button',{name:'Show duration details',exact:true}).click();
 for(const [name,value,fraction]of [['Rest per set','240',240/300],['Extra time','40',40/60],['Buffer','35',35/50]]){
  const input=page.getByLabel(name,{exact:true});await expect(input.locator('..').locator('.slider-thumb')).toHaveCount(1);await input.fill(value);await expect(input).toHaveValue(value);await expect.poll(()=>input.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBeCloseTo(fraction,5);
 }
 await page.getByRole('button',{name:'Set goals',exact:true}).click();const goal=page.getByLabel('Chest goal',{exact:true});await goal.fill('9.5');await expect(goal).toHaveValue('9.5');await expect.poll(()=>goal.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBeCloseTo(9.5/12,5);
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.evaluate(async()=>{window.editor.destroy();const {mountProgramView}=await import('/src/program-view.js');window.programView=mountProgramView(document.querySelector('main'),{program:{name:'Weekly',mode:'schedule',goals:{},workouts:[]},templates:[]});});
 await page.getByRole('button',{name:'Set weekly goals',exact:true}).click();const weekly=page.getByLabel('Chest weekly goal',{exact:true});await weekly.fill('12.5');await expect(weekly).toHaveAttribute('aria-valuetext','12.5');await expect.poll(()=>weekly.locator('..').evaluate(el=>Number(el.style.getPropertyValue('--visual-to')))).toBeCloseTo(12.5/30,5);
});
