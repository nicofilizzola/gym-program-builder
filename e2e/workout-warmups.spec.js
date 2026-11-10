import {test,expect} from '@playwright/test';
import {login,resetWorkouts,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

const makeId=()=>crypto.randomUUID();

/** A template whose first exercise has 2 warm-ups and 3 sets. */
async function makeTemplate(page){
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const e=entries.find(x=>!x.archived&&x.equipment);
 const exercises=[e,entries.find(x=>!x.archived&&x.equipment&&x.id!==e.id)].map((e,i)=>({name:e.name,sets:3,warmupSets:i?0:2,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:[...e.primaryMuscles],secondaryMuscles:[...e.secondaryMuscles],catalogId:e.id,familyId:e.familyId,catalogRevision:e.revision,equipment:e.equipment}));
 const id=makeId();
 const r=await page.request.post('/api/documents',{headers,data:{id,kind:'template',document:{name:'Warm A',exercises,goals:{},extraMinutes:5,bufferPercent:10}}});
 expect(r.ok(),await r.text()).toBeTruthy();
 return {template:(await (await page.request.get(`/api/documents/${id}`)).json()).record,exName:e.name};
}
async function openActive(page){
 await login(page);await resetWorkouts(page);
 const {template,exName}=await makeTemplate(page);
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template});
 const r=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 return {log,exName};
}
const doneSet=async(page,label,exName,reps)=>{
 await page.getByLabel(`${label} reps, ${exName}`,{exact:true}).fill(reps);
 await page.getByRole('button',{name:`Mark ${label.toLowerCase()} done, ${exName}`,exact:true}).click();
};

// Active phone workouts use Focus; compact warm-up rows on touch remain above 760px.
for(const [label,opts] of [['touch',{viewport:{width:800,height:844},hasTouch:true}],['desktop',{viewport:{width:1366,height:768}}]]){
 test(`warm-up rows and Add warm-up (${label})`,async({browser})=>{
  const context=await browser.newContext({...opts,reducedMotion:'reduce'});const page=await context.newPage();
  const {exName}=await openActive(page);
  await expect(page.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','W2','1','2','3']);
  await expect(page.locator('.log-exercise').first().locator('.log-set.is-warmup')).toHaveCount(2);
  const xs=await page.evaluate(()=>[...document.querySelector('.log-exercise').querySelectorAll('.log-set')].map(li=>{const r=s=>li.querySelector(s).getBoundingClientRect().left;return [r('.log-set-number'),r('[data-kind="weight"]'),r('[data-kind="reps"]'),r('.log-done')].map(Math.round);}));
  for(const row of xs)expect(row).toEqual(xs[0]);
  const number=await page.evaluate(()=>{const n=document.querySelector('.log-set.is-warmup .log-set-number');return n.scrollWidth<=n.clientWidth+1;});
  expect(number).toBe(true);
  await expect(page.getByRole('button',{name:`Warm-up set 2 actions, ${exName}`,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:`Add set, ${exName}`,exact:true}).locator('xpath=..')).toHaveClass(/log-set-actions/);
  // Warm-ups never open the finish warning: with both done, only working sets are counted.
  await doneSet(page,'Warm-up set 1',exName,'10');await doneSet(page,'Warm-up set 2',exName,'8');await doneSet(page,'Set 1',exName,'8');
  const colors=await page.evaluate(()=>{const c=li=>getComputedStyle(li.querySelector('.log-set-number')).color,rows=[...document.querySelector('.log-exercise').querySelectorAll('.log-set')];
   const probe=document.createElement('i');probe.style.color='var(--muted)';document.body.append(probe);const muted=getComputedStyle(probe).color;probe.remove();
   return {warm:c(rows[0]),working:c(rows[2]),muted,warmClass:rows[0].classList.contains('is-warmup'),workingClass:rows[2].classList.contains('is-warmup'),
    fieldWarm:getComputedStyle(rows[0].querySelector('input')).color,fieldWork:getComputedStyle(rows[2].querySelector('input')).color};});
  expect(colors.warmClass).toBe(true);expect(colors.workingClass).toBe(false);
  expect(colors.warm).toBe(colors.muted);expect(colors.working).not.toBe(colors.muted);expect(colors.fieldWarm).toBe(colors.fieldWork);
  await page.getByRole('button',{name:'Finish',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('5 sets not completed');
  await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
  await page.getByRole('button',{name:`Add warm-up, ${exName}`,exact:true}).click();
  await expect(page.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','W2','W3','1','2','3']);
  await context.close();
 });
}

test('Add warm-up animates the collapse unless reduced motion',async({browser})=>{
 const context=await browser.newContext({viewport:{width:800,height:844},hasTouch:true,reducedMotion:'no-preference'});const page=await context.newPage();
 const {exName}=await openActive(page);
 await page.evaluate(()=>{window.__closed=false;new MutationObserver(rs=>{if(rs.some(r=>r.oldValue?.includes('is-closed')))window.__closed=true;}).observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});});
 await page.getByRole('button',{name:`Add warm-up, ${exName}`,exact:true}).click();
 await expect(page.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','W2','W3','1','2','3']);
 expect(await page.evaluate(()=>window.__closed)).toBe(true);
 await context.close();
 const reduced=await browser.newContext({viewport:{width:800,height:844},hasTouch:true,reducedMotion:'reduce'});const p2=await reduced.newPage();
 const {exName:n2}=await openActive(p2);
 await p2.evaluate(()=>{window.__closed=false;new MutationObserver(rs=>{if(rs.some(r=>r.oldValue?.includes('is-closed')||[...r.addedNodes].some(n=>n.classList?.contains('is-closed'))||r.target.classList?.contains('is-closed')))window.__closed=true;}).observe(document.body,{subtree:true,attributes:true,childList:true,attributeOldValue:true,attributeFilter:['class']});});
 await p2.getByRole('button',{name:`Add warm-up, ${n2}`,exact:true}).click();
 await expect(p2.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','W2','W3','1','2','3']);
 expect(await p2.evaluate(()=>window.__closed)).toBe(false);
 await reduced.close();
});

test('finishing logs only working sets and History counts them',async({page})=>{
 const {exName}=await openActive(page);
 const second=await page.locator('.log-exercise h2').nth(1).textContent();
 for(const n of [1,2,3])await doneSet(page,`Set ${n}`,exName,'8');
 for(const n of [1,2,3])await doneSet(page,`Set ${n}`,second,'8');
 await doneSet(page,'Warm-up set 1',exName,'10');
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 // Warm-up 2 is open but only working sets count: no warning, the log finishes.
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.goto('/#/workouts');
 await expect(page.getByText('6 sets',{exact:false}).first()).toBeVisible();
});

test('finished log: Add warm-up inherits; removing the last working set removes the exercise',async({page})=>{
 const {exName}=await openActive(page);
 await page.getByLabel(`Warm-up set 1 weight, ${exName}`,{exact:true}).fill('40');
 await doneSet(page,'Warm-up set 1',exName,'10');
 await doneSet(page,'Set 1',exName,'8');
 await page.getByLabel(`Set 1 reps, ${await page.locator('.log-exercise h2').nth(1).textContent()}`,{exact:true}).fill('8');
 await page.getByRole('button',{name:/^Mark set 1 done/}).nth(1).click();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Finish workout'}).click();
 await page.goto('/#/workouts');
 await page.locator('.workout-history-row a').first().click();
 await expect(page.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','1']);
 await page.getByRole('button',{name:`Add warm-up, ${exName}`,exact:true}).click();
 await expect(page.locator('.log-exercise').first().locator('.log-set-number')).toHaveText(['W1','W2','1']);
 await expect(page.getByLabel(`Warm-up set 2 weight, ${exName}`,{exact:true})).toHaveValue('40');
 await expect(page.getByLabel(`Warm-up set 2 reps, ${exName}`,{exact:true})).toHaveValue('10');
 const removeFrom=async label=>{await page.getByRole('button',{name:`${label} actions, ${exName}`,exact:true}).click();await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Remove set',exact:true}).click();};
 const numbers=page.locator('.log-exercise').first().locator('.log-set-number');
 // Removing a warm-up never asks to remove the exercise.
 await removeFrom('Warm-up set 2');
 await expect(numbers).toHaveText(['W1','1']);await expect(page.getByRole('dialog')).toHaveCount(0);
 // Removing a non-last working set does not either.
 await page.getByRole('button',{name:`Add set, ${exName}`,exact:true}).click();
 await expect(numbers).toHaveText(['W1','1','2']);
 await removeFrom('Set 2');
 await expect(numbers).toHaveText(['W1','1']);await expect(page.getByRole('dialog')).toHaveCount(0);
 // The last working set asks to remove the exercise and removes it with its warm-ups.
 await expect(page.locator('.log-exercise')).toHaveCount(2);
 await removeFrom('Set 1');
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Remove');
 await dialog.getByRole('button',{name:'Remove exercise'}).click();
 await expect(page.locator('.log-exercise')).toHaveCount(1);
 await expect(page.getByRole('button',{name:`Add warm-up, ${exName}`,exact:true})).toHaveCount(0);
});

test('a dirty version 1 mirror resumes with numbered working rows and syncs',async({page})=>{
 await login(page);await resetWorkouts(page);
 const {entries}=await (await page.request.get('/api/catalog')).json();const e=entries.find(x=>!x.archived&&x.equipment);
 const id=makeId();
 const log={id,logVersion:1,status:'active',name:'Legacy',startedAt:new Date(Date.now()-60000).toISOString(),finishedAt:null,source:{kind:'blank'},
  exercises:[{id:'e1',variantId:e.id,referenceId:e.familyId,name:e.name,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],target:null,sets:[{id:'s1',weightKg:50,reps:8,rir:null,done:false},{id:'s2',weightKg:null,reps:null,rir:null,done:false}]}]};
 await page.evaluate(m=>localStorage.setItem('gpb.activeWorkout',JSON.stringify(m)),{log,baseRevision:0,dirty:true,lastTime:null});
 await page.goto('/#/workouts/'+id);await page.reload();
 await expect(page.locator('.log-set .log-set-number')).toHaveText(['1','2']);
 await expect.poll(async()=>(await (await page.request.get('/api/workouts/active')).json()).record?.id).toBe(id);
 const saved=(await (await page.request.get('/api/workouts/active')).json()).record;
 expect(saved.log.logVersion).toBe(2);
 expect(saved.log.exercises[0].sets.map(s=>s.kind)).toEqual(['working','working']);
});
