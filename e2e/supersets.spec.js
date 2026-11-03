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

// Block reordering: A, [B+C], D. A pair moves as one block and nothing can land between its members.
async function blockFixture(page) {
 await page.setViewportSize({width:1280,height:1000});
 await fixture(page);
 await page.evaluate(()=>{
  const ex=(name,muscle,extra={})=>({name,sets:3,warmupSets:0,restSeconds:90,repRange:{min:8,max:12},primaryMuscles:[muscle],secondaryMuscles:[],...extra});
  window.editor.setWorkout({name:'Upper',goals:{},extraMinutes:0,bufferPercent:0,exercises:[
   ex('A','Chest'),ex('B','Lats',{superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}),ex('C','Biceps'),ex('D','Triceps')]});
  window.supersetChanges=[];
 });
}
const pairHandle=page=>page.getByRole('button',{name:'Reorder superset',exact:true});
const singleHandle=(page,name)=>page.locator('#exercises > li.exercise').filter({has:page.locator('.card-name',{hasText:new RegExp(`^${name}$`)})}).getByRole('button',{name:'Reorder exercise',exact:true});
async function expectOrder(page,order){
 await expect(names(page)).toHaveText(order);
 const doc=await lastChange(page);
 expect(doc.exercises.map(ex=>ex.name)).toEqual(order);
 const b=order.indexOf('B');
 expect(doc.exercises[b].superset).toEqual({restBetweenSeconds:30,restAfterRoundSeconds:90});
 expect(doc.exercises.filter(ex=>ex.superset)).toHaveLength(1);
 await expect(page.locator('#exercises > li.superset .superset-members > li.exercise .card-name')).toHaveText(['B','C']);
 await expect(page.locator('#exercises > li.superset')).toHaveAttribute('data-block-start',String(b));
 await expectValidChanges(page);
}

test('dragging a superset above a single moves the whole pair',async({page})=>{
 await blockFixture(page);
 const head=await page.locator('.superset-title').boundingBox(),a=await page.locator('#exercises > li.exercise').first().boundingBox();
 await page.mouse.move(head.x+5,head.y+5);await page.mouse.down();await page.mouse.move(head.x+15,head.y+15);
 await expect(page.locator('.sort-drag-copy.superset')).toBeVisible();
 await page.mouse.move(a.x+80,a.y+5);await page.mouse.up();
 await expectOrder(page,['B','C','A','D']);
 expect(await page.evaluate(()=>window.supersetChanges.length)).toBe(1);
 await expect(pairHandle(page)).toBeFocused();
});

test('a single dropped on the gap inside a pair lands before or after the whole pair',async({page})=>{
 await blockFixture(page);
 const d=await page.locator('#exercises > li.exercise').last().locator('.card-index').boundingBox();
 const members=page.locator('.superset-members > li.exercise');
 const b=await members.first().boundingBox(),c=await members.last().boundingBox();
 await page.mouse.move(d.x+5,d.y+5);await page.mouse.down();await page.mouse.move(d.x+15,d.y+15);
 await expect(page.locator('.sort-drag-copy')).toBeVisible();
 await page.mouse.move(b.x+80,(b.y+b.height+c.y)/2);await page.mouse.up();
 const order=await names(page).allTextContents();
 expect([['A','D','B','C'],['A','B','C','D']]).toContainEqual(order);
 await expect(page.locator('.superset .card-name')).toHaveText(['B','C']);
 if(order[1]==='D')await expectOrder(page,order);
});

test('keyboard moves a superset one block and keeps focus on its handle',async({page})=>{
 await blockFixture(page);
 await pairHandle(page).focus();await page.keyboard.press('ArrowUp');
 await expectOrder(page,['B','C','A','D']);
 await expect(pairHandle(page)).toBeFocused();
 await expect(page.locator('#order-status')).toContainText('B and C');
 await expect(page.locator('#order-status')).toContainText('1–2 of 4');
 await page.keyboard.press('ArrowDown');await expectOrder(page,['A','B','C','D']);await expect(pairHandle(page)).toBeFocused();
});

test('single cards step over a pair as one block (regression: never slip inside and re-pair)',async({page})=>{
 await blockFixture(page);
 await singleHandle(page,'A').focus();await page.keyboard.press('ArrowDown');
 await expectOrder(page,['B','C','A','D']);
 await expect(singleHandle(page,'A')).toBeFocused();
 await expect(page.locator('#order-status')).toContainText('Moved A to position 3 of 4');
 // Regression: D moving up via its Reorder options also jumps over the pair instead of slipping inside it.
 await page.keyboard.press('ArrowUp');await expectOrder(page,['A','B','C','D']);
 await singleHandle(page,'D').click();await page.getByRole('button',{name:'Move up',exact:true}).click();
 await expectOrder(page,['A','D','B','C']);
 await expect(singleHandle(page,'D')).toBeFocused();
 await singleHandle(page,'A').click();await page.getByRole('button',{name:'Move down',exact:true}).click();
 await expectOrder(page,['D','A','B','C']);
});

test('the superset Reorder options step one block with disabled ends',async({page})=>{
 await blockFixture(page);
 const up=page.getByRole('button',{name:'Move up',exact:true}),down=page.getByRole('button',{name:'Move down',exact:true});
 await pairHandle(page).click();
 await expect(pairHandle(page)).toHaveAttribute('aria-expanded','true');
 await expect(up).toBeEnabled();await expect(down).toBeEnabled();
 await up.click();
 await expectOrder(page,['B','C','A','D']);await expect(pairHandle(page)).toBeFocused();
 await pairHandle(page).click();await expect(up).toBeDisabled();await expect(down).toBeEnabled();
 await page.keyboard.press('Escape');await expect(pairHandle(page)).toBeFocused();
 for(let i=0;i<2;i++){await pairHandle(page).click();await down.click();}
 await expectOrder(page,['A','D','B','C']);
 await pairHandle(page).click();await expect(up).toBeEnabled();await expect(down).toBeDisabled();
 await page.keyboard.press('Escape');
});

test('touch press-and-hold drags a superset as one block',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 await blockFixture(page);
 const head=await page.locator('.superset-title').boundingBox(),d=await page.locator('#exercises > li.exercise').last().boundingBox();
 const client=await context.newCDPSession(page),x=head.x+5,y=head.y+5;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await expect(page.locator('#exercises > li.superset')).toHaveClass(/is-hold-armed/);
 await expect(page.locator('.superset-members > li.exercise').first()).toHaveCSS('border-top-color','rgb(249, 115, 22)');
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:d.y+d.height-5}]});
 await expect(page.locator('.sort-drag-copy.superset')).toBeVisible();
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expectOrder(page,['A','D','B','C']);
 expect(await page.evaluate(()=>window.supersetChanges.length)).toBe(1);
 await context.close();
});

test('the superset drag copy renders like its source frame',async({page})=>{
 await blockFixture(page);
 const frame=page.locator('#exercises > li.superset');
 const selectors=['.superset-title','.superset-head .reorder-action','.superset-members > li:first-child .card-identity','.superset-members > li:last-child .card-controls'];
 const layout=locator=>locator.evaluate((el,selectors)=>{
  const base=el.getBoundingClientRect(),out={width:base.width,height:base.height};
  for(const s of selectors){const r=el.querySelector(s).getBoundingClientRect();out[s]=[r.left-base.left,r.top-base.top,r.width,r.height];}
  return out;
 },selectors);
 const source=await layout(frame);
 const head=await page.locator('.superset-title').boundingBox();
 await page.mouse.move(head.x+5,head.y+5);await page.mouse.down();await page.mouse.move(head.x+25,head.y+25);
 const copy=page.locator('.sort-drag-copy');await expect(copy).toBeVisible();
 await expect(copy).toHaveAttribute('inert','');await expect(copy).toHaveAttribute('aria-hidden','true');
 const moved=await layout(copy);
 expect(Math.abs(moved.width-source.width)).toBeLessThanOrEqual(1);expect(Math.abs(moved.height-source.height)).toBeLessThanOrEqual(1);
 for(const s of selectors)source[s].forEach((v,i)=>expect(Math.abs(moved[s][i]-v),`${s}[${i}]`).toBeLessThanOrEqual(1));
 await page.keyboard.press('Escape');await page.mouse.up();
 await expect(page.locator('.sort-drag-copy,.sort-drag-host,.sort-placeholder')).toHaveCount(0);
 await expect(names(page)).toHaveText(['A','B','C','D']);
 expect(await page.evaluate(()=>window.supersetChanges.length)).toBe(0);
});
