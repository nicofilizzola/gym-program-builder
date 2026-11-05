import {test,expect} from '@playwright/test';
import {login,resetWorkouts,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

const makeId=()=>crypto.randomUUID();

/** A template of three exercises where the first two are a superset pair. */
async function makeTemplate(page){
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const picks=entries.filter(x=>!x.archived&&x.equipment).slice(0,4);
 const exercises=picks.slice(0,3).map((e,i)=>({name:e.name,sets:2,warmupSets:0,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:[...e.primaryMuscles],secondaryMuscles:[...e.secondaryMuscles],catalogId:e.id,familyId:e.familyId,catalogRevision:e.revision,equipment:e.equipment,
  ...(i===0?{superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}}:{})}));
 const id=makeId();
 const r=await page.request.post('/api/documents',{headers,data:{id,kind:'template',document:{name:'Pair day',exercises,goals:{},extraMinutes:5,bufferPercent:10}}});
 expect(r.ok(),await r.text()).toBeTruthy();
 return {template:(await (await page.request.get(`/api/documents/${id}`)).json()).record,names:exercises.map(e=>e.name),spare:picks[3]};
}
async function openActive(page){
 await login(page);await resetWorkouts(page);
 const made=await makeTemplate(page);
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template:made.template});
 const r=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 return {log,...made};
}
const headings=page=>page.locator('.log-exercise h2').allTextContents();

for(const [label,opts] of [['phone',{viewport:{width:390,height:844},hasTouch:true}],['desktop',{viewport:{width:1366,height:768}}]]){
 test(`pair renders as one frame with A1/A2 members (${label})`,async({browser})=>{
  const context=await browser.newContext({...opts,reducedMotion:'reduce'});const page=await context.newPage();
  const {names}=await openActive(page);
  await expect(page.locator('li.log-superset')).toHaveCount(1);
  await expect(page.locator('.log-superset-head')).toContainText('Superset · 30 sec between · 2 min after round');
  await expect(page.locator('.log-superset-members > li.log-exercise')).toHaveCount(2);
  expect(await headings(page)).toEqual([`A1 ${names[0]}`,`A2 ${names[1]}`,names[2]]);
  await expect(page.getByRole('button',{name:'Reorder superset',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:`Reorder ${names[0]}`,exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Reorder ${names[1]}`,exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Reorder ${names[2]}`,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Unlink superset',exact:true})).toBeVisible();
  await context.close();
 });
}

test('member card content stays at least 300px at 360px',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 await openActive(page);
 const widths=await page.evaluate(()=>[...document.querySelectorAll('.log-superset-members .log-exercise-card')].map(c=>{const s=getComputedStyle(c);return c.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);}));
 expect(widths).toHaveLength(2);
 for(const w of widths)expect(w).toBeGreaterThanOrEqual(300);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await context.close();
});

test('unlink removes the frame and gives both cards Reorder (reduced motion)',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 const {names}=await openActive(page);
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('li.log-superset')).toHaveCount(0);
 expect(await headings(page)).toEqual(names);
 for(const n of names)await expect(page.getByRole('button',{name:`Reorder ${n}`,exact:true})).toBeVisible();
 await expect(page.locator('.log-exercises > li.log-exercise')).toHaveCount(3);
 await context.close();
});

test('unlink animates the frame closed before removing it',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference'});const page=await context.newPage();
 const {names}=await openActive(page);
 await page.getByRole('button',{name:'Unlink superset',exact:true}).click();
 await expect(page.locator('li.log-superset.is-closed')).toHaveCount(1);
 await expect(page.locator('li.log-superset')).toHaveCount(0);
 expect(await headings(page)).toEqual(names);
 await expect(page.locator('.log-exercises > li.log-exercise')).toHaveCount(3);
 await context.close();
});

test('keyboard and menu move the pair as one block',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});const page=await context.newPage();
 const {names}=await openActive(page);
 const pairHandle=page.getByRole('button',{name:'Reorder superset',exact:true});
 await pairHandle.focus();await page.keyboard.press('ArrowDown');
 expect(await headings(page)).toEqual([names[2],`A1 ${names[0]}`,`A2 ${names[1]}`]);
 await expect(pairHandle).toBeFocused();
 await page.keyboard.press('ArrowDown');
 expect(await headings(page)).toEqual([names[2],`A1 ${names[0]}`,`A2 ${names[1]}`]);
 await page.keyboard.press('ArrowUp');
 expect(await headings(page)).toEqual([`A1 ${names[0]}`,`A2 ${names[1]}`,names[2]]);
 // The single card steps over the whole pair.
 await page.getByRole('button',{name:`Reorder ${names[2]}`,exact:true}).focus();await page.keyboard.press('ArrowUp');
 expect(await headings(page)).toEqual([names[2],`A1 ${names[0]}`,`A2 ${names[1]}`]);
 await pairHandle.click();
 await page.getByRole('group',{name:'Reorder options'}).getByRole('button',{name:'Move up'}).click();
 expect(await headings(page)).toEqual([`A1 ${names[0]}`,`A2 ${names[1]}`,names[2]]);
 await pairHandle.click();
 await expect(page.getByRole('group',{name:'Reorder options'}).getByRole('button',{name:'Move up'})).toBeDisabled();
 await page.getByRole('group',{name:'Reorder options'}).getByRole('button',{name:'Move down'}).click();
 expect(await headings(page)).toEqual([names[2],`A1 ${names[0]}`,`A2 ${names[1]}`]);
 await context.close();
});

test('dragging the pair moves it as one block and never lands between members',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});const page=await context.newPage();
 const {names}=await openActive(page);
 const box=await page.locator('.log-superset-head .superset-title').boundingBox();
 await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.down();
 const first=await page.locator('.log-superset-members > li').first().boundingBox();
 await page.mouse.move(box.x+10,first.y+first.height*0.75,{steps:5});
 expect(await page.locator('.sort-placeholder').count()).toBe(1);
 const single=await page.locator('.log-exercises > li.log-exercise').boundingBox();
 await page.mouse.move(box.x+10,single.y+single.height*0.75,{steps:8});
 await page.mouse.up();
 expect(await headings(page)).toEqual([names[2],`A1 ${names[0]}`,`A2 ${names[1]}`]);
 await expect(page.locator('li.log-superset .log-exercise')).toHaveCount(2);
 await context.close();
});

test('swap on A2 keeps the frame; add appends an unpaired card; removing A1 dissolves the frame',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});const page=await context.newPage();
 const {names,spare}=await openActive(page);
 await page.getByRole('button',{name:`Swap exercise A2 ${names[1]}`,exact:true}).or(page.getByRole('button',{name:`Swap exercise ${names[1]}`,exact:true})).click();
 const combo=page.locator('.log-superset-members > li').nth(1).getByRole('combobox',{name:'Exercise'});
 await combo.fill(spare.name);
 await page.getByRole('option',{name:new RegExp(spare.name)}).first().click();
 await expect(page.locator('li.log-superset')).toHaveCount(1);
 expect(await headings(page)).toEqual([`A1 ${names[0]}`,`A2 ${spare.name}`,names[2]]);
 await expect(page.locator('.log-superset-members > li').nth(1).locator('.log-last-time')).toContainText(/Last time|No history/);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByRole('combobox',{name:'Exercise'}).last().fill(names[2]);
 await page.getByRole('option',{name:new RegExp(names[2])}).first().click();
 await expect(page.locator('.log-exercise')).toHaveCount(4);
 expect(await headings(page)).toEqual([`A1 ${names[0]}`,`A2 ${spare.name}`,names[2],names[2]]);
 await expect(page.locator('.log-exercises > li.log-exercise')).toHaveCount(2);
 await page.getByRole('button',{name:`Remove exercise ${names[0]}`,exact:true}).click();
 await expect(page.locator('li.log-superset')).toHaveCount(0);
 expect(await headings(page)).toEqual([spare.name,names[2],names[2]]);
 await context.close();
});

test('finished log shows the frame without Unlink or Reorder',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});const page=await context.newPage();
 await login(page);await resetWorkouts(page);
 const {template}=await makeTemplate(page);
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-3600000),makeId,template});
 log.status='finished';log.finishedAt=new Date().toISOString();
 for(const e of log.exercises)for(const s of e.sets){s.done=true;s.reps=8;}
 const r=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 await expect(page.locator('li.log-superset')).toHaveCount(1);
 await expect(page.locator('.log-superset-head')).toContainText('Superset · 30 sec between');
 await expect(page.getByRole('button',{name:'Unlink superset'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Reorder superset'})).toHaveCount(0);
 await context.close();
});
