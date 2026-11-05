import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,removeSet,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';
import {addExercise,finishWorkout} from '../src/workout-edit.js';

const makeId=()=>crypto.randomUUID();
const hours=n=>new Date(Date.now()-n*3600000);

async function put(page,log,revision=0){
 const response=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision,log}});
 expect(response.ok(),await response.text()).toBeTruthy();
 return (await response.json()).record;
}
const serverLog=async(page,id)=>(await (await page.request.get(`/api/workouts/${id}`)).json()).record.log;

/** A finished log (first exercise 80×8 @2, optional third variant 50×10) and an active log from the same template. */
async function setup(page,{mutate=log=>log,history=true}={}){
 await login(page);await resetWorkouts(page);
 const {id:templateId}=await createLinkedTemplate(page,'Push A');
 const template=(await (await page.request.get(`/api/documents/${templateId}`)).json()).record;
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const linked=new Set(template.document.exercises.map(e=>e.catalogId));
 const spare=entries.find(e=>!e.archived&&e.equipment&&!linked.has(e.id));
 if(history){
  let past=createWorkoutLog({id:makeId(),now:hours(3),makeId,template});
  past=addExercise(past,spare,makeId);
  past={...past,exercises:[
   {...past.exercises[0],sets:[{id:makeId(),kind:'working',weightKg:80,reps:8,rir:2,done:true}]},
   {...past.exercises[2],sets:[{id:makeId(),kind:'working',weightKg:50,reps:10,rir:null,done:true}]}]};
  await put(page,finishWorkout(past,hours(2)).log);
 }
 const log=await openLog(page,template,mutate);
 return {log,spare,template,names:log.exercises.map(e=>e.name)};
}
async function openLog(page,template,mutate=log=>log){
 const log=mutate(createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template}));
 await put(page,log);
 await page.goto('/#/workouts/'+log.id);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 return log;
}
const card=(page,name)=>page.locator('.log-exercise').filter({has:page.getByRole('heading',{name,exact:true})});
const status=page=>page.locator('.logger-status');

for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
 test.describe(`logger at ${viewport.width}px`,()=>{
  test.use({viewport});

  test('placeholders and ✓ log a set in one tap',async({page})=>{
   const {log,names:[first,second]}=await setup(page,{mutate:log=>({...log,exercises:log.exercises.map((e,i)=>i===1?{...e,target:null}:e)})});
   await expect(card(page,first).locator('.log-last-time')).toContainText('Last time');
   await expect(card(page,first).locator('.log-last-time')).toContainText('80×8 @2');
   await expect(card(page,second).locator('.log-last-time')).toContainText('No history');
   const weight=page.getByLabel(`Set 1 weight, ${first}`,{exact:true}),reps=page.getByLabel(`Set 1 reps, ${first}`,{exact:true});
   await expect(weight).toHaveAttribute('placeholder','80');await expect(reps).toHaveAttribute('placeholder','8');
   await expect(weight).toHaveAttribute('inputmode','decimal');await expect(reps).toHaveAttribute('inputmode','numeric');
   const done=page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true});
   await expect(done).toHaveAttribute('aria-pressed','false');
   await done.click();
   await expect(done).toHaveAttribute('aria-pressed','true');
   await expect(weight).toHaveValue('80');await expect(reps).toHaveValue('8');
   await expect(page.getByRole('group',{name:`Set 1 RIR, ${first}`}).getByRole('button',{name:'2',exact:true})).toHaveAttribute('aria-pressed','true');
   await expect(status(page)).toHaveText('Saved');
   await expect.poll(async()=>(await serverLog(page,log.id)).exercises[0].sets[0]).toMatchObject({weightKg:80,reps:8,rir:2,done:true});
   // A done set toggles back to not done and keeps its values.
   await done.click();await expect(done).toHaveAttribute('aria-pressed','false');await expect(weight).toHaveValue('80');
   // No reps from last time or a target: ✓ asks for reps and focuses the field.
   const noReps=page.getByRole('button',{name:`Mark set 1 done, ${second}`,exact:true});
   await expect(page.getByLabel(`Set 1 reps, ${second}`,{exact:true})).toHaveAttribute('placeholder','');
   await noReps.click();
   await expect(card(page,second).getByText('Enter reps',{exact:true})).toBeVisible();
   await expect(page.getByLabel(`Set 1 reps, ${second}`,{exact:true})).toBeFocused();
   await expect(noReps).toHaveAttribute('aria-pressed','false');
   await page.getByLabel(`Set 1 reps, ${second}`,{exact:true}).fill('10');
   await expect(card(page,second).getByText('Enter reps',{exact:true})).toHaveCount(0);
   // Elapsed time and the heading.
   await expect(page.locator('.logger-elapsed')).toHaveText('5 min');
   await expect(page.getByRole('heading',{level:1,name:'Push A'})).toBeVisible();
  });

  test('inputs, steppers and RIR',async({page})=>{
   const {log,names:[first]}=await setup(page);
   const field=(n,kind)=>page.getByLabel(`Set ${n} ${kind}, ${first}`,{exact:true});
   await expect(field(2,'weight')).toBeVisible();await expect(field(2,'reps')).toBeVisible();
   await field(2,'weight').fill('82,5');await field(2,'weight').blur();
   await expect(field(2,'weight')).toHaveValue('82.5');
   await expect(status(page)).toHaveText('Saved');
   await page.reload();
   await expect(field(2,'weight')).toHaveValue('82.5');
   await field(2,'weight').fill('82.3');await field(2,'weight').blur();
   await expect(field(2,'weight')).toHaveValue('82.3');
   await expect(field(2,'weight')).toHaveAttribute('aria-invalid','true');
   await expect(card(page,first).getByText('Weight must be a multiple of 0.25 from 0 to 999.75 kg.')).toBeVisible();
   await page.waitForTimeout(600);
   expect((await serverLog(page,log.id)).exercises[0].sets[1].weightKg).toBe(82.5);
   await field(2,'weight').fill('85');
   await expect(field(2,'weight')).toHaveAttribute('aria-invalid','false');
   await expect(card(page,first).getByText('Weight must be a multiple of 0.25 from 0 to 999.75 kg.')).toHaveCount(0);
   // + on an empty weight starts from its placeholder.
   await expect(field(1,'weight')).toHaveValue('');
   await page.getByRole('button',{name:`Increase set 1 weight, ${first}`,exact:true}).click();
   await expect(field(1,'weight')).toHaveValue('82.5');
   await page.getByRole('button',{name:`Decrease set 1 weight, ${first}`,exact:true}).click();
   await expect(field(1,'weight')).toHaveValue('80');
   await field(1,'reps').fill('1');
   await page.getByRole('button',{name:`Decrease set 1 reps, ${first}`,exact:true}).click();
   await expect(field(1,'reps')).toHaveValue('1');
   await page.getByRole('button',{name:`Increase set 1 reps, ${first}`,exact:true}).click();
   await expect(field(1,'reps')).toHaveValue('2');
   const rir=page.getByRole('group',{name:`Set 1 RIR, ${first}`});
   await rir.getByRole('button',{name:'3',exact:true}).click();
   await expect(rir.getByRole('button',{name:'3',exact:true})).toHaveAttribute('aria-pressed','true');
   await expect.poll(async()=>(await serverLog(page,log.id)).exercises[0].sets[0]).toMatchObject({weightKg:80,reps:2,rir:3});
   await rir.getByRole('button',{name:'3',exact:true}).click();
   await expect(rir.getByRole('button',{name:'3',exact:true})).toHaveAttribute('aria-pressed','false');
   await expect.poll(async()=>(await serverLog(page,log.id)).exercises[0].sets[0].rir).toBe(null);
  });

  test('swap, add, remove and reorder exercises',async({page})=>{
   const {log,spare,names:[first,second]}=await setup(page);
   await page.getByLabel(`Set 1 weight, ${first}`,{exact:true}).fill('60');
   await page.getByRole('button',{name:`Swap exercise ${first}`,exact:true}).click();
   const combo=page.getByRole('combobox',{name:'Exercise'});
   await expect(combo).toBeFocused();
   await combo.fill(spare.name);
   await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').filter({hasText:spare.name}).first().click();
   await expect(card(page,spare.name)).toBeVisible();
   await expect(card(page,first)).toHaveCount(0);
   await expect(page.getByLabel(`Set 1 weight, ${spare.name}`,{exact:true})).toHaveValue('60');
   await expect(card(page,spare.name).locator('.log-set')).toHaveCount(3);
   await expect(card(page,spare.name).locator('.log-last-time')).toContainText('50×10');
   await expect(page.getByRole('button',{name:`Swap exercise ${spare.name}`,exact:true})).toBeFocused();
   await expect.poll(async()=>(await serverLog(page,log.id)).exercises[0]).toMatchObject({variantId:spare.id,name:spare.name,target:null});
   // Add exercise: a new card with one empty set.
   await page.getByRole('button',{name:'Add exercise',exact:true}).click();
   await expect(combo).toBeFocused();
   await combo.fill(first);
   await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').filter({hasText:first}).first().click();
   await expect(page.locator('.log-exercise')).toHaveCount(3);
   const added=page.locator('.log-exercise').nth(2);
   await expect(added.locator('.log-set')).toHaveCount(1);
   await expect(added.getByLabel(/^Set 1 weight, /)).toHaveValue('');
   const addedName=await added.locator('h2').textContent();
   // Remove an exercise with done sets asks first.
   await page.getByRole('button',{name:`Mark set 1 done, ${second}`,exact:true}).click();
   await page.getByRole('button',{name:`Remove exercise ${second}`,exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Remove exercise?'});
   await expect(dialog).toContainText(`Remove ${second} and its logged sets?`);
   await dialog.getByRole('button',{name:'Cancel'}).click();
   await expect(card(page,second)).toHaveCount(1);
   await page.getByRole('button',{name:`Remove exercise ${second}`,exact:true}).click();
   await dialog.getByRole('button',{name:'Remove exercise'}).click();
   await expect(card(page,second)).toHaveCount(0);
   await expect(page.locator('.log-exercise')).toHaveCount(2);
   // Reorder via the menu keeps focus on the handle.
   const reorder=page.getByRole('button',{name:`Reorder ${spare.name}`,exact:true});
   await reorder.click();
   await page.getByRole('button',{name:'Move down',exact:true}).click();
   await expect(page.locator('.log-exercise').nth(1).getByRole('heading')).toHaveText(spare.name);
   await expect(reorder).toBeFocused();
   await page.keyboard.press('ArrowUp');
   await expect(page.locator('.log-exercise').nth(0).getByRole('heading')).toHaveText(spare.name);
   await expect(reorder).toBeFocused();
   await expect.poll(async()=>(await serverLog(page,log.id)).exercises.map(e=>e.name)).toEqual([spare.name,addedName]);
  });

  test('Finish warns about uncompleted sets and refuses an empty log',async({page})=>{
   const trim=log=>({...log,exercises:log.exercises.map((e,i)=>i===1?{...e,sets:e.sets.slice(0,2)}:e)});
   const {log,template,names:[first]}=await setup(page,{mutate:trim,history:false});
   await page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true}).click();
   await page.getByRole('button',{name:`Mark set 2 done, ${first}`,exact:true}).click();
   await page.getByRole('button',{name:'Finish',exact:true}).click();
   const dialog=page.getByRole('dialog');
   await expect(dialog).toContainText('3 sets not completed — finish anyway? Uncompleted sets will be removed.');
   await dialog.getByRole('button',{name:'Cancel'}).click();
   await expect(page).toHaveURL(new RegExp(log.id));
   // Exactly one open set uses the singular.
   const second=(await page.locator('.log-exercise h2').nth(1).textContent());
   await page.getByRole('button',{name:`Mark set 1 done, ${second}`,exact:true}).click();
   await page.getByRole('button',{name:`Mark set 2 done, ${second}`,exact:true}).click();
   await page.getByRole('button',{name:'Finish',exact:true}).click();
   await expect(dialog).toContainText('1 set not completed — finish anyway? Uncompleted sets will be removed.');
   await dialog.getByRole('button',{name:'Finish workout'}).click();
   await expect(page).toHaveURL(/#\/workouts$/);
   await expect(page.locator('.workout-history-row').first()).toContainText('4 sets');
   expect((await serverLog(page,log.id)).status).toBe('finished');
   // Nothing done: Finish is refused; Discard removes the log.
   const blank=await openLog(page,template);
   await page.getByRole('button',{name:'Finish',exact:true}).click();
   await expect(page.getByText('Log at least one set, or discard the workout.')).toBeVisible();
   await expect(page).toHaveURL(new RegExp(blank.id));
   await page.getByRole('button',{name:'Workout actions',exact:true}).click();
   await page.getByRole('button',{name:'Discard workout',exact:true}).click();
   const discard=page.getByRole('dialog',{name:'Discard workout?'});
   await expect(discard).toContainText('This workout and its sets will be deleted. This cannot be undone.');
   await discard.getByRole('button',{name:'Discard workout'}).click();
   await expect(page).toHaveURL(/#\/workouts$/);
   await expect(page.getByRole('heading',{level:1,name:'Workouts'})).toBeVisible();
   expect((await page.request.get(`/api/workouts/${blank.id}`)).status()).toBe(404);
   expect(await page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
  });
 });
}

const rirBoxes=(page,name)=>page.getByRole('group',{name:`Set 1 RIR, ${name}`}).getByRole('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));
for(const width of [360,390]){
 test(`RIR options are 44px tall and share the kg-to-reps width at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  const {names:[first]}=await setup(page,{history:false});
  const boxes=await rirBoxes(page,first);
  expect(boxes).toHaveLength(6);
  for(const box of boxes){expect(box.width).toBeGreaterThanOrEqual(36);expect(box.height).toBeGreaterThanOrEqual(44);}
  for(const name of [`Mark set 1 done, ${first}`,`Set 1 actions, ${first}`]){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await context.close();
 });
}
test('fine pointer keeps a one-line set row with 32px RIR options at 1366px',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 const {names:[first]}=await setup(page,{history:false});
 for(const box of await rirBoxes(page,first)){expect(box.width).toBeGreaterThanOrEqual(32);expect(box.height).toBeGreaterThanOrEqual(32);}
 const row=page.locator('.log-set-row').first();
 const rowBox=await row.boundingBox(),done=await page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true}).boundingBox();
 expect(rowBox.height).toBeLessThan(48);
 expect(done.height).toBeGreaterThanOrEqual(32);
});

test('logger touch targets and reduced motion',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 const {names:[first]}=await setup(page);
 const targets=[page.getByLabel(`Set 1 weight, ${first}`,{exact:true}),page.getByLabel(`Set 1 reps, ${first}`,{exact:true}),
  page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true}),page.getByRole('button',{name:`Increase set 1 weight, ${first}`,exact:true}),
  page.getByRole('button',{name:`Set 1 actions, ${first}`,exact:true}),page.getByRole('button',{name:'Finish',exact:true})];
 for(const target of targets){const box=await target.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}
 // Stepper buttons are 36px wide on phones (full 44px height) so 999.75 and 100 stay visible.
 for(const target of targets.slice(2).filter((_,i)=>i!==1)){const box=await target.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);}
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBe(0);
 // Initial render has no running animations; reduced motion inserts a new set instantly.
 expect(await page.evaluate(()=>document.querySelector('.workout-logger').getAnimations({subtree:true}).length)).toBe(0);
 const sets=card(page,first).locator('.log-set');
 await page.getByRole('button',{name:`Add set, ${first}`}).click();
 await expect(sets).toHaveCount(4);
 expect(await sets.nth(3).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
 expect(await sets.nth(3).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(40);
 // With motion, adding animates and removing completes before the node goes.
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:`Add set, ${first}`}).click();
 await expect(sets).toHaveCount(5);
 expect(await sets.nth(4).evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
 await removeSet(page,5,first);
 await expect(sets).toHaveCount(4);
 await context.close();
});

test('weight and reps inputs show their longest values unclipped at 360px',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:800},hasTouch:true});
 const page=await context.newPage();
 const {names:[first]}=await setup(page,{history:false});
 await page.getByLabel(`Set 1 weight, ${first}`,{exact:true}).fill('999.75');
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('100');
 for(const name of ['weight','reps']){
  const clipped=await page.getByLabel(`Set 1 ${name}, ${first}`,{exact:true}).evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(clipped,name).toBeLessThanOrEqual(1);
 }
 await context.close();
});

test('chooseAction resolves its choice, or null on Cancel',async({page})=>{
 await page.goto('/');
 const ask=()=>page.evaluate(()=>{window.choice='pending';import('/src/confirm-dialog.js').then(({chooseAction})=>chooseAction({title:'Workout in progress',message:'Resume, finish or discard <b>Push</b>.',choices:[{value:'resume',label:'Resume current'},{value:'discard',label:'Discard current',destructive:true}]}).then(value=>{window.choice=value;}));});
 await ask();
 const dialog=page.getByRole('dialog',{name:'Workout in progress'});
 await expect(dialog).toContainText('<b>Push</b>');
 await expect(dialog.getByRole('button',{name:'Cancel'})).toBeFocused();
 await dialog.getByRole('button',{name:'Discard current'}).click();
 await expect(dialog).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.choice)).toBe('discard');
 await ask();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel'}).click();
 await expect(dialog).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.choice)).toBe(null);
 await ask();await expect(dialog.getByRole('button',{name:'Cancel'})).toBeFocused();await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.choice)).toBe(null);
});
