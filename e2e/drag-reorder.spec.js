import {test,expect} from '@playwright/test';

async function exerciseFixture(page) {
 await page.setViewportSize({width:1280,height:1000});await page.goto('/');
 await page.evaluate(async()=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');
  document.body.innerHTML='<div id="fixture"></div>';
  window.changes=[];
  window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout:{name:'Upper',goals:{},exercises:['Bench','Row','Curl'].map(name=>({name,sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}))},onChange:value=>window.changes.push(value)});
 });await page.evaluate(()=>document.fonts.ready);
}
async function startExerciseDrag(page) {
 const box=await page.locator('.exercise .drag-handle').first().boundingBox();
 await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();
 await page.mouse.move(box.x+32,box.y+32);
 return box;
}
test('exercise follows pointer before release',async({page})=>{
 await exerciseFixture(page);const start=await startExerciseDrag(page);
 const copy=page.locator('.sort-drag-copy');await expect(copy).toBeVisible();
 const before=await copy.boundingBox();await page.mouse.move(start.x+62,start.y+62);
 const after=await copy.boundingBox();expect(after.x-before.x).toBeCloseTo(30,0);expect(after.y-before.y).toBeCloseTo(30,0);
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 expect(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size;})).toBe(true);
 await page.keyboard.press('Escape');await page.mouse.up();await expect(copy).toHaveCount(0);
});
test('exercise drop commits once',async({page})=>{
 await exerciseFixture(page);await startExerciseDrag(page);
 const target=await page.locator('.exercise').nth(2).boundingBox();await page.mouse.move(target.x+80,target.y+target.height-5);
 await expect(page.locator('.sort-placeholder')).toBeVisible();expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await page.mouse.up();
 expect(await page.evaluate(()=>window.changes.map(v=>v.exercises.map(e=>e.name)))).toEqual([['Row','Curl','Bench']]);
 await expect(page.locator('.exercise .drag-handle').last()).toBeFocused();
});
for(const cancel of ['Escape','pointercancel','lostpointercapture','outside','destroy'])test(`exercise cancel restores mixed collapsed order: ${cancel}`,async({page})=>{
 await exerciseFixture(page);await page.getByRole('button',{name:'Expand exercise',exact:true}).nth(1).click();await startExerciseDrag(page);
 const target=await page.locator('.exercise').last().boundingBox();await page.mouse.move(target.x+80,target.y+target.height-5);
 if(cancel==='Escape')await page.keyboard.press('Escape');
 else if(cancel==='outside')await page.mouse.move(1,1);
 else if(cancel==='destroy')await page.evaluate(()=>window.editor.destroy());
 else await page.locator('.exercise .drag-handle').first().dispatchEvent(cancel,{pointerId:1});
 await page.mouse.up();await expect(page.locator('.sort-drag-copy')).toHaveCount(0);await expect(page.locator('.sort-placeholder')).toHaveCount(0);
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 if(cancel!=='destroy'){await expect(page.locator('.exercise .card-summary')).toContainText(['Bench','Row','Curl']);await expect(page.locator('.exercise').nth(1).getByRole('button',{name:'Collapse exercise',exact:true})).toBeVisible();}
});
test('exercise reorder supports keyboard and click alternatives',async({page})=>{
 await exerciseFixture(page);const handles=page.getByRole('button',{name:'Reorder exercise',exact:true});
 await handles.first().focus();await page.keyboard.press('ArrowDown');await expect(handles.nth(1)).toBeFocused();
 await handles.nth(1).click();await page.getByRole('button',{name:'Move down',exact:true}).click();
 expect(await page.evaluate(()=>window.changes.at(-1).exercises.map(e=>e.name))).toEqual(['Row','Curl','Bench']);
});
test('exercise preview scrolls and destroys cleanly with touch input',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 await exerciseFixture(page);
 await page.evaluate(()=>{for(let i=0;i<10;i++)document.querySelector('#add-exercise').click();document.querySelector('#collapse-all').click();});
 await page.setViewportSize({width:1280,height:600});
 await page.locator('.exercise .drag-handle').first().scrollIntoViewIfNeeded();
 const box=await page.locator('.exercise .drag-handle').first().boundingBox();
 const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+22,y:box.y+22}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+24,y:580}]});
 await expect(page.locator('.sort-drag-copy')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
 await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await expect(page.locator('.sort-drag-copy')).toHaveCount(0);await context.close();
});
test('exercise neighbour motion respects preference',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await exerciseFixture(page);await startExerciseDrag(page);
 const box=await page.locator('#exercises .exercise').last().boundingBox();
 await page.mouse.move(box.x+80,box.y+box.height-10);
 expect(await page.locator('#exercises').evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.effect.getTiming().duration===180))).toBe(true);
 await page.keyboard.press('Escape');await page.mouse.up();
 await page.emulateMedia({reducedMotion:'reduce'});await startExerciseDrag(page);
 const last=await page.locator('#exercises .exercise').last().boundingBox();await page.mouse.move(last.x+80,last.y+last.height-10);
 expect(await page.locator('#exercises').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
 await page.keyboard.press('Escape');await page.mouse.up();
});
test('small pointer movements preserve active neighbour animations',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await exerciseFixture(page);await startExerciseDrag(page);
 const box=await page.locator('#exercises .exercise').last().boundingBox();await page.mouse.move(box.x+80,box.y+box.height-10);
 await page.locator('#exercises').evaluate(el=>{window.neighbourAnimations=el.getAnimations({subtree:true});});
 await page.mouse.move(box.x+81,box.y+box.height-10);
 expect(await page.evaluate(()=>window.neighbourAnimations.length>0&&window.neighbourAnimations.every(a=>a.playState!=='idle'))).toBe(true);
 await page.keyboard.press('Escape');await page.mouse.up();
});

async function programFixture(page,mode='simple') {
 await page.setViewportSize({width:1280,height:mode==='schedule'?2400:1200});await page.goto('/');
 await page.evaluate(async mode=>{
  const {mountProgramView}=await import('/src/program-view.js');
  document.body.innerHTML='<div id="fixture"></div>';window.changes=[];
  window.programView=mountProgramView(document.querySelector('#fixture'),{templates:[],program:{name:'Week',mode,goals:{},workouts:[['a','Press',0],['b','Pull',6],['c','Extra',null]].map(([id,name,day])=>({id,name,day,goals:{},exercises:[{name,sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}))},onChange:p=>window.changes.push(p)});
 },mode);await page.evaluate(()=>document.fonts.ready);
}
async function dragWorkout(page,id,target) {
 const box=await page.locator(`[data-workout="${id}"] .drag-handle`).boundingBox();await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();
 const end=await target.boundingBox();await page.mouse.move(end.x+60,end.y+end.height-12,{steps:5});
}
test('program sequence drag previews and commits canonical order',async({page})=>{
 await programFixture(page);await dragWorkout(page,'a',page.locator('[data-workout="c"]'));
 await expect(page.locator('.sort-drag-copy')).toBeVisible();expect(await page.evaluate(()=>window.changes.length)).toBe(0);await page.mouse.up();
 expect(await page.evaluate(()=>window.changes.at(-1).workouts.map(w=>[w.id,w.day]))).toEqual([['b',6],['c',null],['a',0]]);
 await expect(page.locator('[data-workout="a"] .drag-handle')).toBeFocused();
});
test('program drag crosses days, Unscheduled and empty groups',async({page})=>{
 await programFixture(page,'schedule');
 for(const [id,day]of [['a','6'],['a','unscheduled'],['a','0']]){
  const target=page.locator(`[data-sort-group="${day}"]`);await target.scrollIntoViewIfNeeded();await page.locator(`[data-workout="${id}"] .drag-handle`).scrollIntoViewIfNeeded();
  // The test viewport contains the schedule; target geometry is read at pointer movement time.
  await dragWorkout(page,id,target);await page.mouse.up();
  expect(await page.evaluate(()=>window.changes.at(-1).workouts.find(w=>w.id==='a').day)).toBe(day==='unscheduled'?null:Number(day));
  await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('9');
 }
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();await page.getByRole('radio',{name:'Monday–Sunday',exact:true}).check();
 await expect(page.getByLabel('Day for Press')).toHaveValue('0');
});
test('program drag order and day assignments persist after reload',async({page})=>{
 await page.setViewportSize({width:1280,height:1400});await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();
 const program={name:'Saved drag',mode:'schedule',goals:{},workouts:[['First',0],['Second',6],['Third',null]].map(([name,day])=>({name,day,goals:{},exercises:[]}))};
 await page.locator('[data-file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program}))});
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Saved drag');
 const key=await page.locator('.workout-item').filter({has:page.getByRole('heading',{name:'First',exact:true})}).getAttribute('data-workout');
 await dragWorkout(page,key,page.locator('[data-sort-group="6"]'));await page.mouse.up();await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(page.getByLabel('Day for First',{exact:true})).toHaveValue('6');await page.getByRole('radio',{name:'Sequence',exact:true}).check();
 await expect(page.locator('.workout-item h3')).toHaveText(['Second','First','Third']);
});
