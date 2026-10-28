import {test,expect} from '@playwright/test';

test('card headings identify exercises while collapsed summaries show only prescriptions',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  document.body.innerHTML='<div id="fixture"></div>';
  window.headingChanges=[];
  window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:['Bench < & press','Bench < & press','   '].map(name=>({name,sets:3,repRange:{min:8,max:12},restSeconds:180,primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}))},onChange:value=>window.headingChanges.push(value)});
 });
 const cards=page.locator('.exercise');
 await expect(cards.first().getByRole('heading',{name:'Exercise 1: Bench < & press',exact:true})).toBeVisible();
 await expect(cards.nth(1).getByRole('heading',{name:'Exercise 2: Bench < & press',exact:true})).toBeVisible();
 await expect(cards.last().getByRole('heading',{name:'Exercise 3: Untitled exercise',exact:true})).toBeVisible();
 await expect(cards.locator('.card-index')).toHaveText(['01','02','03']);
 await expect(cards.locator('.card-summary')).toHaveText(Array(3).fill('3 × 8–12 · Rest 3 min'));
 await expect(cards.first().getByRole('button',{name:'Expand exercise',exact:true})).toBeVisible();
 await cards.first().getByRole('button',{name:'Expand exercise',exact:true}).click();
 expect(await page.evaluate(()=>window.headingChanges.length)).toBe(0);
 const input=cards.first().getByLabel('Exercise name',{exact:true});
 await input.fill('Edited bench');
 await expect(input).toBeFocused();
 await expect(cards.first().getByRole('heading')).toHaveAccessibleName('Exercise 1: Edited bench');
 await cards.nth(1).getByRole('button',{name:'Reorder exercise',exact:true}).focus();await page.keyboard.press('ArrowUp');
 await expect(cards.first().getByRole('heading')).toHaveAccessibleName('Exercise 1: Bench < & press');
 await expect(cards.first().getByRole('button',{name:'Reorder exercise',exact:true})).toBeFocused();
 await expect(cards.first().getByRole('button',{name:'Expand exercise',exact:true})).toBeVisible();
 await expect(cards.nth(1).getByRole('button',{name:'Collapse exercise',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await expect(cards.last().getByRole('heading')).toHaveAccessibleName('Exercise 4: Untitled exercise');
 await expect(cards.last().getByRole('button',{name:'Collapse exercise',exact:true})).toBeVisible();
 await page.evaluate(()=>window.editor.setWorkout({name:'Reloaded',goals:{},exercises:[{name:'Reloaded row',sets:2,repRange:{min:10,max:10},primaryMuscles:['Lats'],secondaryMuscles:[]}]}));
 await expect(cards.first().getByRole('heading')).toHaveAccessibleName('Exercise 1: Reloaded row');
 await expect(cards.first().getByRole('button',{name:'Expand exercise',exact:true})).toBeVisible();
});

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
 await page.evaluate(()=>document.fonts.ready);
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



test('disclosure stays beside identity with keyboard focus and current tooltip',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
 const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<div id="fixture"></div>';
 window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:[{name:'A very long bench press exercise name '.repeat(4),sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}});
 });
 const card=page.locator('.exercise').first(),toggle=card.locator('[data-action=toggle]');
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});
 const t=await toggle.boundingBox(),h=await card.locator('.card-identity').boundingBox();
 expect(t.x+t.width).toBeLessThanOrEqual(h.x);expect(Math.abs(t.y-h.y)).toBeLessThan(12);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await toggle.focus();await expect(page.getByRole('tooltip')).toHaveText('Expand exercise');
 await toggle.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(toggle).toBeFocused();
 await toggle.press('Tab');await toggle.focus();await expect(page.getByRole('tooltip')).toHaveText('Collapse exercise');
 await toggle.press('Space');await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(card.locator('[data-collapse=body]')).toHaveAttribute('inert','');
});

test('disclosure reverses smoothly and bulk collapse restores focus before hiding fields',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await page.evaluate(async()=>{
 const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<div id="fixture"></div>';
 window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}});
 });
 const toggle=page.locator('[data-action=toggle]'),body=page.locator('[data-collapse=body]');
 await toggle.evaluate(async b=>{b.click();await new Promise(requestAnimationFrame);b.click();await new Promise(requestAnimationFrame);b.click();});
 await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(body).not.toHaveAttribute('inert','');
 await expect(body).toHaveCSS('transition-duration','0.2s, 0.2s');
 await page.getByLabel('Exercise name',{exact:true}).focus();
 await page.locator('#collapse-all').evaluate(b=>b.click());await expect(toggle).toBeFocused();await expect(body).toHaveAttribute('inert','');
 await page.emulateMedia({reducedMotion:'reduce'});await toggle.click();await expect(body).toHaveCSS('transition-duration','0s');
});

