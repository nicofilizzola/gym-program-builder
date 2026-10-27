import {test,expect} from '@playwright/test';

export async function mountProgram(page,{mode='simple',sequence}={}) {
 await page.setViewportSize({width:1440,height:1100});await page.goto('/');
 await page.evaluate(async({mode,sequence})=>{
  const {mountProgramView}=await import('/src/program-view.js');
  document.body.innerHTML='<main id="fixture"></main>';window.changes=[];
  const workouts=[['a','Upper',0],['b','Lower',6]].map(([id,name,day])=>({id,name,day,goals:{},exercises:[{name,sets:3,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]}]}));
  window.fixtureProgram={name:'Cycle',mode,goals:{},workouts,...(sequence?{sequence}:{})};
  window.view=mountProgramView(document.querySelector('#fixture'),{program:window.fixtureProgram,templates:[],onChange:p=>window.changes.push(p)});
 },{mode,sequence});
 await page.evaluate(()=>document.fonts.ready);
}
const sequenceKeys=page=>page.locator('[data-sequence-key]').evaluateAll(els=>els.map(el=>el.dataset.sequenceKey));
const current=page=>page.evaluate(()=>window.changes.at(-1));

test('program controls use Week first, session heading and accessible Edit icons',async({page})=>{
 await mountProgram(page);
 await expect(page.locator('.program-layout label')).toHaveText(['Week','Sequence']);
 await expect(page.getByRole('heading',{name:'Sessions',exact:true})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Sequence',exact:true})).toBeChecked();
 const edit=page.getByRole('button',{name:'Edit Upper',exact:true});
 await expect(edit.locator('svg')).toHaveCount(1);await edit.focus();
 await expect(page.getByRole('tooltip')).toHaveText('Edit');
 await expect(page.getByRole('button',{name:/Move (up|down)/})).toHaveCount(0);
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.locator('.day-field')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add rest day',exact:true})).toHaveCount(0);
});

test('mixed sequences reorder by keyboard, preserve weekdays and restore rests across layouts',async({page})=>{
 await mountProgram(page);
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 const rest=page.locator('.sequence-rest-item'),handle=rest.locator('.reorder-action');
 await expect(handle).toBeFocused();await page.keyboard.press('ArrowUp');
 expect((await sequenceKeys(page)).filter(k=>k==='a'||k==='b')).toEqual(['a','b']);
 expect((await current(page)).sequence.map(e=>e.type)).toEqual(['workout','rest','workout']);
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-sequence-key]').first()).toHaveClass(/sequence-rest-item/);
 await page.keyboard.press('ArrowUp');await expect(handle).toBeFocused();
 await page.getByRole('radio',{name:'Week',exact:true}).check();await expect(rest).toHaveCount(0);
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();await expect(rest).toHaveCount(1);
 expect((await current(page)).workouts.map(w=>[w.id,w.day])).toEqual([['a',0],['b',6]]);
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('6');
 await rest.getByRole('button',{name:'Remove rest day',exact:true}).click();
 await expect(page.locator('[data-workout="a"] .reorder-action')).toBeFocused();
});

test('Week keyboard handles reach every day and Unscheduled without selects',async({page})=>{
 await mountProgram(page,{mode:'schedule'});
 const handle=page.locator('[data-workout="a"] .reorder-action');
 await handle.focus();await page.keyboard.press('Alt+ArrowUp');
 expect(await current(page)).toBeUndefined();
 for(let i=1;i<=7;i++){
  await page.keyboard.press('Alt+ArrowDown');await expect(handle).toBeFocused();
  expect((await current(page)).workouts.find(w=>w.id==='a').day).toBe(i===7?null:i);
 }
 await expect(page.locator('[data-workout-order]')).toContainText('Unscheduled');
 await expect(handle).toHaveAttribute('aria-describedby',/reorder/);
 await expect(page.locator('[data-week-help]')).toContainText('Alt');
 await page.keyboard.press('Alt+ArrowUp');
 expect((await current(page)).workouts.find(w=>w.id==='a').day).toBe(6);
});

test('mouse drag moves rests between sessions and commits once',async({page})=>{
 await mountProgram(page,{sequence:[{type:'workout',workoutId:'a'},{type:'workout',workoutId:'b'},{type:'rest',id:'r'}]});
 const handle=await page.locator('[data-rest="r"] h3').boundingBox();
 const target=await page.locator('[data-workout="b"]').boundingBox();
 await page.mouse.move(handle.x+16,handle.y+16);await page.mouse.down();
 await page.mouse.move(target.x+60,target.y+5,{steps:5});await expect(page.locator('.sort-drag-copy')).toBeVisible();
 expect(await current(page)).toBeUndefined();await page.mouse.up();
 expect(await sequenceKeys(page)).toEqual(['a','r','b']);
 expect(await page.evaluate(()=>window.changes.length)).toBe(1);
});

test('rest-only programs support consecutive rests and removal focus',async({page})=>{
 await mountProgram(page);await page.evaluate(()=>{
  window.view.update({...window.fixtureProgram,workouts:[],sequence:[]});
 });
 const add=page.getByRole('button',{name:'Add rest day',exact:true});
 await add.click();await add.click();await expect(page.locator('.sequence-rest-item')).toHaveCount(2);
 await page.getByRole('button',{name:'Remove rest day',exact:true}).first().click();
 await expect(page.locator('.sequence-rest-item .reorder-action')).toBeFocused();
 await page.getByRole('button',{name:'Remove rest day',exact:true}).click();await expect(add).toBeFocused();
 await expect(page.locator('.workout-item')).toHaveCount(0);
});

test('import asks before replacing a rest-only program',async({page})=>{
 await mountProgram(page);await page.evaluate(()=>window.view.update({...window.fixtureProgram,workouts:[],sequence:[{type:'rest',id:'r'}]}));
 let prompted=false;page.on('dialog',async dialog=>{prompted=true;await dialog.dismiss();});
 await page.locator('[data-file]').setInputFiles({name:'replace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program:{name:'Replacement',mode:'schedule',goals:{},workouts:[]}}))});
 await expect.poll(()=>prompted).toBe(true);
 await expect(page.locator('[data-rest="r"]')).toHaveCount(1);
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Cycle');
});

test('layout fades affect only sessions and reduced motion switches immediately',async({page})=>{
 await mountProgram(page,{sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'}]});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{
  window.panelBefore=document.querySelector('[data-weekly-panel]').firstElementChild;
  window.layoutAnimations=[];const animate=Element.prototype.animate;
  Element.prototype.animate=function(...args){const animation=animate.apply(this,args);if(this.matches('[data-workouts]'))window.layoutAnimations.push(animation.effect.getTiming().duration);return animation;};
 });
 for(const name of ['Week','Sequence']){
  await page.getByRole('radio',{name,exact:true}).check();
  await expect(page.locator('[data-workouts]')).not.toHaveAttribute('inert','');
  await expect(page.getByRole('radio',{name,exact:true})).toBeFocused();
 }
 expect(await page.evaluate(()=>window.layoutAnimations)).toEqual([75,100,75,100]);
 expect(await page.evaluate(()=>document.querySelector('[data-weekly-panel]').firstElementChild===window.panelBefore)).toBe(true);
 await expect(page.locator('[data-rest="r"]')).toHaveCount(1);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.locator('.day-section')).toHaveCount(8);
 expect(await page.evaluate(()=>window.layoutAnimations.length)).toBe(4);
});

test('rapid layout reversals and mutations cancel stale commits',async({page})=>{
 await mountProgram(page);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{
  for(const mode of ['schedule','simple','schedule']){
   const input=document.querySelector('[name="program-layout"][value="'+mode+'"]');input.checked=true;input.dispatchEvent(new Event('change'));
  }
 });
 await expect(page.locator('.day-section')).toHaveCount(8);
 await expect(page.locator('[data-workouts]')).not.toHaveAttribute('inert','');
 await page.evaluate(()=>{
  const input=document.querySelector('[name="program-layout"][value="simple"]');input.checked=true;input.dispatchEvent(new Event('change'));
  document.querySelector('[data-add-rest]').click();
 });
 await expect(page.locator('[data-rest]')).toHaveCount(1);
 await expect(page.locator('[data-workouts]')).not.toHaveAttribute('inert','');
 await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await expect(page.locator('.day-section')).toHaveCount(1);
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await page.getByRole('button',{name:'Edit Upper',exact:true}).click();
 await expect(page.getByRole('button',{name:'Back to program',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to program',exact:true}).click();
 await expect(page.locator('.day-section')).toHaveCount(8);
 await page.evaluate(()=>{
  document.querySelector('[name="program-layout"][value="simple"]').click();
  window.view.update({...window.fixtureProgram,mode:'schedule'});
 });
 await expect(page.locator('.day-section')).toHaveCount(8);
 await expect(page.locator('[data-workouts]')).not.toHaveAttribute('inert','');
 await page.evaluate(()=>{
  document.querySelector('[name="program-layout"][value="simple"]').click();window.view.destroy();
 });
 await expect(page.locator('#fixture')).toBeEmpty();
 await expect(page.locator('.sort-drag-copy,.sort-placeholder')).toHaveCount(0);
});

test('touch can drag a rest into the sequence with accessible target sizes',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'});
 try {
  const page=await context.newPage();
  await mountProgram(page,{sequence:[{type:'workout',workoutId:'a'},{type:'workout',workoutId:'b'},{type:'rest',id:'r'}]});
  for(const control of await page.locator('.sequence-rest-item button,.workout-action').all()){
   const box=await control.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const handle=await page.locator('[data-rest="r"] h3').boundingBox(),target=await page.locator('[data-workout="b"]').boundingBox();
  const client=await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:handle.x+22,y:handle.y+22}]});
  await expect(page.locator('[data-rest="r"]')).toHaveClass(/is-hold-armed/);
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x+70,y:target.y+4}]});
  await expect(page.locator('.sort-drag-copy')).toBeVisible();
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await sequenceKeys(page)).toEqual(['a','r','b']);
  await expect(page.locator('.sort-drag-copy,.sort-placeholder')).toHaveCount(0);
 } finally {await context.close();}
});


test('rest Reorder menu moves mixed entries and preserves accessible controls across layouts',async({page})=>{
 await mountProgram(page,{sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'}]});
 const reorder=page.getByRole('button',{name:'Reorder rest day',exact:true});
 await reorder.click();await page.getByRole('button',{name:'Move down',exact:true}).click();
 expect(await sequenceKeys(page)).toEqual(['a','b','r']);await expect(reorder).toBeFocused();
 await reorder.click();await expect(page.getByRole('button',{name:'Move down',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Move up',exact:true}).click();
 expect(await sequenceKeys(page)).toEqual(['a','r','b']);await expect(reorder).toBeFocused();
 await expect(page.locator('.drag-handle')).toHaveCount(0);
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[390,844],[820,1180]]){
  await page.setViewportSize({width,height});
  for(const enlarged of [false,true]){
   await page.evaluate(enlarged=>document.documentElement.style.fontSize=enlarged?'200%':'',enlarged);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   await reorder.click();await expect(page.locator('.reorder-menu:popover-open')).toBeVisible();
   const box=await page.locator('.reorder-menu').boundingBox();
   expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(width-8);
   await page.keyboard.press('Escape');await expect(reorder).toBeFocused();
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.screenshot({path:`.superpowers/sdd/2026-10-27-program-merge/sequence-${width}.png`,fullPage:true});
 }
});
