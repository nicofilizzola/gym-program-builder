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
 const box=await page.locator('.exercise .card-index').first().boundingBox();
 await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();
 await page.mouse.move(box.x+15,box.y+15);
 return box;
}
test('collapsed content opens once without saving and expanded content stays open',async({page})=>{
 await exerciseFixture(page);const cards=page.locator('.exercise');
 for(const [index,target] of [[0,'.card-name'],[1,'.card-summary'],[2,null]]){
  const card=cards.nth(index);
  if(target)await card.locator(target).click();else await card.click({position:{x:8,y:8}});
  await expect(card.locator('[data-action=toggle]')).toHaveAttribute('aria-expanded','true');
  await expect(card.locator('[data-action=toggle]')).toBeFocused();
  await expect(card.locator('[data-collapse=body]')).not.toHaveAttribute('inert','');
  await card.locator('.card-body').click({position:{x:5,y:5}});await expect(card.locator('[data-action=toggle]')).toHaveAttribute('aria-expanded','true');
 }
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
});

test('nested controls act once and secondary clicks never open a card',async({page})=>{
 await exerciseFixture(page);const card=page.locator('.exercise').first(),toggle=card.locator('[data-action=toggle]');
 await card.locator('.card-name').click({button:'right'});await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.locator('.card-name').click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await toggle.locator('.card-name').click();await expect(toggle).toHaveAttribute('aria-expanded','false');
 await card.locator('.reorder-action').click();await expect(toggle).toHaveAttribute('aria-expanded','false');await page.keyboard.press('Escape');
 await card.locator('[data-action=remove] path').click();await expect(page.locator('.card-name')).toHaveText(['Row','Curl']);
 await expect(page.locator('[data-action=toggle][aria-expanded=false]')).toHaveCount(2);
});

test('mouse movement below drag threshold opens but cancelled presses never do',async({page})=>{
 await exerciseFixture(page);let b=await page.locator('.card-name').first().boundingBox();
 await page.mouse.move(b.x+3,b.y+3);await page.mouse.down();await page.mouse.move(b.x+5,b.y+4);await page.mouse.up();
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','true');
 await page.locator('[data-action=toggle]').first().click();b=await page.locator('.card-name').first().boundingBox();
 await page.mouse.move(b.x+3,b.y+3);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','false');
});

test('exercise follows pointer before release',async({page})=>{
 await exerciseFixture(page);const start=await startExerciseDrag(page);
 const copy=page.locator('.sort-drag-copy');await expect(copy).toBeVisible();
 const before=await copy.boundingBox();await page.mouse.move(start.x+45,start.y+45);
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
 await expect(page.locator('.exercise .reorder-action').last()).toBeFocused();
});
for(const cancel of ['Escape','pointercancel','lostpointercapture','outside','destroy'])test(`exercise cancel restores mixed collapsed order: ${cancel}`,async({page})=>{
 await exerciseFixture(page);await page.getByRole('button',{name:/^Expand exercise: /}).nth(1).click();await startExerciseDrag(page);
 const target=await page.locator('#exercises > .exercise:not(.sort-source)').last().boundingBox();await page.mouse.move(target.x+80,target.y+target.height-5);
 if(cancel==='Escape')await page.keyboard.press('Escape');
 else if(cancel==='outside')await page.mouse.move(1,1);
 else if(cancel==='destroy')await page.evaluate(()=>window.editor.destroy());
 else await page.locator('.exercise').first().dispatchEvent(cancel,{pointerId:1});
 await page.mouse.up();await expect(page.locator('.sort-drag-copy')).toHaveCount(0);await expect(page.locator('.sort-placeholder')).toHaveCount(0);
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 if(cancel!=='destroy'){await expect(page.locator('[data-action=toggle][aria-expanded=true]')).toHaveCount(1);await expect(page.locator('.exercise .card-name')).toHaveText(['Bench','Row','Curl']);await expect(page.locator('.exercise').nth(1).getByRole('button',{name:/^Collapse exercise: /})).toBeVisible();}
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
 await page.locator('.exercise .reorder-action').first().scrollIntoViewIfNeeded();
 const box=await page.locator('.exercise .card-index').first().boundingBox();
 const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+22,y:box.y+22}]});
 await expect(page.locator('.exercise').first()).toHaveClass(/is-hold-armed/);
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
 const box=await page.locator(`[data-workout="${id}"] .workout-metadata p:first-child`).boundingBox();await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();
 await page.mouse.move(box.x+15,box.y+15);
 // The agenda reflows while the placeholder moves, so read the target after the drag has begun and jump to it.
 const end=await target.boundingBox();await page.mouse.move(end.x+60,end.y+end.height-12);
}
test('program sequence drag previews and commits canonical order',async({page})=>{
 await programFixture(page);await dragWorkout(page,'a',page.locator('[data-workout="c"]'));
 await expect(page.locator('.sort-drag-copy')).toBeVisible();expect(await page.evaluate(()=>window.changes.length)).toBe(0);await page.mouse.up();
 expect(await page.evaluate(()=>window.changes.at(-1).workouts.map(w=>[w.id,w.day]))).toEqual([['b',6],['c',null],['a',0]]);
 await expect(page.locator('[data-workout="a"] .reorder-action')).toBeFocused();
});
test('program drag crosses days, Unscheduled and empty groups',async({page})=>{
 await programFixture(page,'schedule');
 for(const [id,day]of [['a','6'],['a','unscheduled'],['a','0']]){
  const target=page.locator(`[data-sort-group="${day}"]`);await target.scrollIntoViewIfNeeded();await page.locator(`[data-workout="${id}"] .reorder-action`).scrollIntoViewIfNeeded();
  // The test viewport contains the schedule; target geometry is read at pointer movement time.
  await dragWorkout(page,id,target);await page.mouse.up();
  expect(await page.evaluate(()=>window.changes.at(-1).workouts.find(w=>w.id==='a').day)).toBe(day==='unscheduled'?null:Number(day));
  await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('9');
 }
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.locator('[data-sort-group="0"] [data-workout="a"]')).toHaveCount(1);
});
test('program drag order and day assignments persist after reload',async({page})=>{
 await page.setViewportSize({width:1280,height:1400});await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();
 const program={name:'Saved drag',mode:'schedule',goals:{},workouts:[['First',0],['Second',6],['Third',null]].map(([name,day])=>({name,day,goals:{},exercises:[]}))};
 await page.locator('[data-file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program}))});
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Saved drag');
 const key=await page.locator('.workout-item').filter({has:page.getByRole('heading',{name:'First',exact:true})}).getAttribute('data-workout');
 await dragWorkout(page,key,page.locator('[data-sort-group="6"]'));await page.mouse.up();await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(page.locator('[data-sort-group="6"] h3')).toHaveText(['Second','First']);await page.getByRole('radio',{name:'Sequence',exact:true}).check();
 await expect(page.locator('.workout-item h3')).toHaveText(['Second','First','Third']);
});

for(const surface of ['.card-index','.card-name','.card-summary','padding'])test(`exercise drag starts from ${surface}`,async({page})=>{
 await exerciseFixture(page);
 if(surface!=='.card-summary')await page.getByRole('button',{name:/^Expand exercise: /}).first().click();
 const card=page.locator('.exercise').first(),el=surface==='padding'?card:card.locator(surface),box=await el.boundingBox();
 const x=box.x+5,y=box.y+5;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+12,y+12);
 await expect(page.locator('.sort-drag-copy')).toBeVisible();
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await page.keyboard.press('Escape');await page.mouse.up();
});

test('interactive ancestors preserve editing and never start a drag',async({page})=>{
 await exerciseFixture(page);await page.getByRole('button',{name:/^Expand exercise: /}).first().click();
 await page.locator('.exercise').first().evaluate(card=>{
 const controls=document.createElement('div');controls.innerHTML='<button disabled>Unavailable</button><button aria-disabled="true"><svg width="25" height="25"><path d="M0 0h20v20"/></svg></button><a href="#test">Link</a><span contenteditable="true">Editable</span><div role="slider" tabindex="0">Custom slider</div><label>Test label<input type="checkbox"></label>';card.append(controls);
 });
 for(const selector of ['input[data-field="name"]','input[type="range"]','label','button svg:visible','button[disabled]','button[aria-disabled]','a','[contenteditable]','[role="slider"]']){
  const control=page.locator('.exercise').first().locator(selector).first();await control.scrollIntoViewIfNeeded();const b=await control.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+15,b.y+b.height/2+15);
  await expect(page.locator('.sort-drag-copy')).toHaveCount(0);await page.mouse.up();
 }
 await page.locator('.exercise input[data-field="name"]').first().fill('Edited bench');
 await expect(page.locator('.exercise input[data-field="name"]').first()).toHaveValue('Edited bench');
 expect(await page.evaluate(()=>window.changes.every(v=>v.exercises.map(e=>e.name).slice(1).join(',')==='Row,Curl'))).toBe(true);
});

test('right click and small movement do not reorder or steal focus',async({page})=>{
 await exerciseFixture(page);await page.locator('[data-template-name]').focus();
 const b=await page.locator('.card-index').first().boundingBox();
 await page.mouse.click(b.x+4,b.y+4,{button:'right'});
 await page.mouse.move(b.x+4,b.y+4);await page.mouse.down();await page.mouse.move(b.x+6,b.y+6);await page.mouse.up();
 await expect(page.locator('.sort-drag-copy')).toHaveCount(0);expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await expect(page.getByRole('button',{name:'Reorder exercise',exact:true}).first()).not.toBeFocused();
});

async function touchFixture(browser){
 const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}}),page=await context.newPage();
 await exerciseFixture(page);await page.setViewportSize({width:390,height:600});
 await page.evaluate(()=>{for(let i=0;i<10;i++)document.querySelector('#add-exercise').click();document.querySelector('#collapse-all').click();});
 await page.locator('.card-index').first().evaluate(el=>{el.scrollIntoView({block:'start'});window.scrollBy(0,-100);});
 const client=await context.newCDPSession(page),b=await page.locator('.card-index').first().boundingBox();
 return {context,page,client,x:b.x+5,y:b.y+5};
}
test('touch swipe scrolls before hold without reordering',async({browser})=>{
 const {context,page,client,x,y}=await touchFixture(browser);const initial=await page.evaluate(()=>scrollY);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=5;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(initial);
 await expect(page.locator('.sort-drag-copy')).toHaveCount(0);
 await expect(page.locator('[data-action=toggle][aria-expanded=true]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.changes.at(-1).exercises.slice(0,3).map(e=>e.name))).toEqual(['Bench','Row','Curl']);await context.close();
});
test('touch hold then drag commits once; hold then release does not',async({browser})=>{
 const {context,page,client,x,y}=await touchFixture(browser);await page.evaluate(()=>window.changes=[]);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await expect(page.locator('.exercise').first()).toHaveClass(/is-hold-armed/);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','false');
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await expect(page.locator('.exercise').first()).toHaveClass(/is-hold-armed/);
 const target=await page.locator('.exercise').nth(2).boundingBox();
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:target.y+target.height-3}]});
 await expect(page.locator('.sort-drag-copy')).toBeVisible();
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>window.changes.map(v=>v.exercises.slice(0,3).map(e=>e.name)))).toEqual([['Row','Curl','Bench']]);await context.close();
});
for(const cancel of ['second finger','touchcancel','destroy'])test(`pending touch hold cancels on ${cancel}`,async({browser})=>{
 const {context,page,client,x,y}=await touchFixture(browser);await page.evaluate(()=>window.changes=[]);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 if(cancel==='second finger')await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1},{x:x+50,y,id:2}]});
 else if(cancel==='touchcancel')await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 else await page.evaluate(()=>window.editor.destroy());
 await page.waitForTimeout(400); // Prove the cancelled 350ms timer never fires.
 await expect(page.locator('.is-hold-armed,.sort-drag-copy')).toHaveCount(0);
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);if(cancel!=='touchcancel')await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await context.close();
});


test('Reorder actions replace dotted handles and expose accessible options',async({page})=>{
 await exerciseFixture(page);const button=page.getByRole('button',{name:'Reorder exercise',exact:true}).first();
 await expect(button).toHaveText('');await expect(page.locator('.drag-handle')).toHaveCount(0);
 await button.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Move up',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Move down',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(button).toBeFocused();await expect(button).toHaveAttribute('aria-expanded','false');
 await page.keyboard.press('Space');await page.getByRole('button',{name:'Move down',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reorder exercise',exact:true}).nth(1)).toBeFocused();
 await expect(page.locator('#order-status')).toContainText('position 2');
});

test('program Reorder moves into empty days and Unscheduled with announcements',async({page})=>{
 await programFixture(page,'schedule');
 for(const [label,day]of [['Tuesday',1],['Sunday',6],['Unscheduled',null]]){
  const button=page.getByRole('button',{name:'Reorder Press',exact:true});await expect(button).toHaveAttribute('data-action-tooltip','Reorder');await button.click();
  const choice=page.getByRole('button',{name:`Move to ${label}`,exact:true});await expect(choice).toBeVisible();
  const b=await page.locator('.reorder-menu').boundingBox();expect(b.x).toBeGreaterThanOrEqual(8);expect(b.y).toBeGreaterThanOrEqual(8);
  await choice.click();await expect(page.getByRole('button',{name:'Reorder Press',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>window.changes.at(-1).workouts.find(w=>w.id==='a').day)).toBe(day);
  await expect(page.locator('[data-workout-order]')).toContainText(label);
 }
 expect(await page.evaluate(()=>window.changes.length)).toBe(3);
 await page.getByRole('button',{name:'Reorder Press',exact:true}).click();await page.getByRole('heading',{name:'Program',exact:true}).click();
 await expect(page.locator('.reorder-menu:popover-open')).toHaveCount(0);
});


test('program workout exercise whole-card reorder preserves prescriptions after save and reload',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();
 await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();
 const workout={name:'Upper persisted',day:2,extraMinutes:7,bufferPercent:15,goals:{Chest:6},exercises:['Bench','Row','Curl'].map((name,i)=>({name,sets:i+2,repRange:{min:8,max:12},restSeconds:180-i*45,primaryMuscles:['Chest'],secondaryMuscles:[]}))};
 await page.locator('[data-file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program:{name:'Whole-card persistence',mode:'schedule',goals:{},workouts:[workout]}}))});
 await page.locator('.workout-title').filter({hasText:'Upper persisted'}).click();await expect(page.locator('.exercise')).toHaveCount(3);await expect(page.locator('[data-template-name]')).toBeFocused();
 await startExerciseDrag(page);await expect(page.locator('.sort-drag-copy')).toBeVisible();const target=await page.locator('#exercises > .exercise:not(.sort-source)').last().boundingBox();await page.mouse.move(target.x+80,target.y+target.height-3);await expect(page.locator('.sort-placeholder')).toBeVisible();await page.mouse.up();
 await expect(page.locator('.card-name')).toHaveText(['Row','Curl','Bench']);
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('button',{name:/^Expand exercise: /}).last().click();await expect(page.locator('.exercise').last().getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue('180');
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();await page.reload();await page.locator('.workout-title').filter({hasText:'Upper persisted'}).click();
 await expect(page.locator('.card-name')).toHaveText(['Row','Curl','Bench']);
 for(const [i,rest,sets]of [[0,'135','3'],[1,'90','4'],[2,'180','2']]){
  await page.locator('.exercise').nth(i).getByRole('button',{name:/^Expand exercise: /}).click();
  await expect(page.locator('.exercise').nth(i).getByRole('slider',{name:'Rest per set',exact:true})).toHaveValue(rest);
  await expect(page.locator('.exercise').nth(i).getByRole('slider',{name:'Sets',exact:true})).toHaveValue(sets);
 }
 await expect(page.locator('#volume .volume-row[data-muscle="Chest"] .value')).toHaveText('9 / 6');
});

test('Reorder menus stay usable on mobile, tablet and enlarged text',async({browser})=>{
 for(const size of [{width:390,height:844},{width:820,height:1180},{width:1366,height:768}]){
  const context=await browser.newContext({viewport:size,hasTouch:true}),page=await context.newPage();await programFixture(page,'schedule');await page.setViewportSize(size);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const button=page.getByRole('button',{name:'Reorder Press',exact:true});await button.click();
  await expect(page.locator('.reorder-menu')).toBeVisible();
  const b=await button.boundingBox(),menu=await page.locator('.reorder-menu').boundingBox();
  expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);
  expect(menu.x).toBeGreaterThanOrEqual(8);expect(menu.y).toBeGreaterThanOrEqual(8);expect(menu.x+menu.width).toBeLessThanOrEqual(size.width-8);expect(menu.y+menu.height).toBeLessThanOrEqual(size.height-8);
  await page.getByRole('button',{name:'Move to Unscheduled',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reorder Press',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await page.screenshot({path:`.superpowers/sdd/2026-10-26-whole-card-dragging/program-touch-${size.width}.png`,fullPage:true});await context.close();
 }
});

 test('short touch tap opens without saving and a later tap still works after cancellation',async({browser})=>{
 const {context,page,client,x,y}=await touchFixture(browser);await page.evaluate(()=>window.changes=[]);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','true');
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await page.locator('[data-action=toggle]').first().tap();
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','false');
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('[data-action=toggle]').first()).toHaveAttribute('aria-expanded','true');
 await context.close();
});


// The drag copy is detached from its day/list ancestry; it must still lay out like its source card.
async function layoutOf(card,selectors) {
 return card.evaluate((el,selectors)=>{
  const base=el.getBoundingClientRect(),out={width:base.width,height:base.height};
  for(const s of selectors){const t=el.querySelector(s);if(!t){out[s]=null;continue;}const r=t.getBoundingClientRect();out[s]=[r.left-base.left,r.top-base.top,r.width,r.height];}
  return out;
 },selectors);
}
function expectSameLayout(copy,source,selectors) {
 expect(Math.abs(copy.width-source.width)).toBeLessThanOrEqual(1);expect(Math.abs(copy.height-source.height)).toBeLessThanOrEqual(1);
 for(const s of selectors){expect(source[s],s).not.toBeNull();expect(copy[s],s).not.toBeNull();source[s].forEach((v,i)=>expect(Math.abs(copy[s][i]-v),`${s}[${i}]`).toBeLessThanOrEqual(1));}
}
for(const [label,mode,width]of [['Week wide','schedule',1440],['Week narrow','schedule',1100],['Sequence','simple',1280]])test(`drag copy matches its source card layout (${label})`,async({page})=>{
 await programFixture(page,mode);await page.setViewportSize({width,height:mode==='schedule'?2400:1200});
 const selectors=['h3','.item-actions','[data-workout-duration]'],card=page.locator('[data-workout="a"]');
 const source=await layoutOf(card,selectors);
 const box=await page.locator('[data-workout="a"] .workout-metadata p:first-child').boundingBox();
 await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+25,box.y+25);
 const copy=page.locator('.sort-drag-copy');await expect(copy).toBeVisible();
 await expect(copy).toHaveAttribute('inert','');await expect(copy).toHaveAttribute('aria-hidden','true');
 expectSameLayout(await layoutOf(copy,selectors),source,selectors);
 await page.mouse.up();await expect(page.locator('.sort-drag-copy,.sort-drag-host,.sort-placeholder')).toHaveCount(0);
});
test('drag copy matches its source card layout (session editor)',async({page})=>{
 await exerciseFixture(page);
 const selectors=['.card-controls','.card-identity'],card=page.locator('.exercise').first();
 const source=await layoutOf(card,selectors);await startExerciseDrag(page);
 const copy=page.locator('.sort-drag-copy');await expect(copy).toBeVisible();
 await expect(copy).toHaveAttribute('inert','');await expect(copy).toHaveAttribute('aria-hidden','true');
 expectSameLayout(await layoutOf(copy,selectors),source,selectors);
 await page.keyboard.press('Escape');await page.mouse.up();
 await expect(page.locator('.sort-drag-copy,.sort-drag-host,.sort-placeholder')).toHaveCount(0);
});
