import {test,expect} from '@playwright/test';

test('muscle preview leaves exercise selection unchanged until activation',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  document.body.innerHTML='<div id="fixture"></div>';
  mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Reference',goals:{},exercises:[
   {name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]},
   {name:'Row',sets:3,repRange:{min:8,max:12},primaryMuscles:['Lats'],secondaryMuscles:[]}
  ]}});
 });
 const chest=page.locator('.volume-row[data-muscle="Chest"]'),lats=page.locator('.volume-row[data-muscle="Lats"]');
 await chest.hover();
 await expect(page.locator('#readout')).toContainText('Chest 3 sets');
 await expect(page.locator('.exercise[data-hit=""]')).toHaveCount(2);
 await chest.click();
 await expect(page.locator('.exercise').first()).toHaveAttribute('data-hit','primary');
 await expect(page.locator('.exercise').last()).toHaveAttribute('data-hit','none');
 await lats.hover();
 await expect(page.locator('#readout')).toContainText('Lats 3 sets');
 await expect(page.locator('.exercise').first()).toHaveAttribute('data-hit','primary');
 await chest.click();
 await expect(page.locator('.exercise[data-hit=""]')).toHaveCount(2);
});
test('mounted template retains live volume, focus, collapse and tooltip behavior',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  document.body.innerHTML='<div id="fixture"></div>';
  window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper A',exercises:[],goals:{}},onChange:value=>window.changed=value});
 });
 await expect(page.getByLabel('Session template name')).toHaveValue('Upper A');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByLabel('Exercise name', {exact:true}).fill('Bench');
 await page.locator('.primary').getByRole('checkbox',{name:'Chest',exact:true}).check();
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('3');
 await page.getByLabel('Sets',{exact:true}).fill('4');
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('4');
 await page.getByRole('button',{name:'Collapse exercise',exact:true}).click();
 await expect(page.locator('[data-collapse=body]').first()).toHaveAttribute('inert','');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByLabel('Exercise name',{exact:true}).last().fill('Row');
 await page.getByRole('button',{name:'Reorder exercise',exact:true}).last().focus();
 await page.keyboard.press('ArrowUp');
 await expect(page.getByRole('button',{name:'Reorder exercise',exact:true}).first()).toBeFocused();
 await expect(page.locator('.exercise').last().getByRole('button',{name:'Expand exercise',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Set goals',exact:true}).click();
 await page.getByRole('button',{name:'About Chest',exact:true}).click();
 await expect(page.getByRole('button',{name:'About Chest',exact:true})).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(page.locator('#goals-dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#goals-dialog')).toBeHidden();
 expect(await page.evaluate(()=>window.changed.exercises[1].name)).toBe('Bench');
});


