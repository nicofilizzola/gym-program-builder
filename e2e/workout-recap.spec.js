import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,saveFinishedLog,openStartSheet,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

test.use({viewport:{width:390,height:844},hasTouch:true});
const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const blockApi=page=>page.route('**/api/**',route=>route.abort('internetdisconnected'));
async function reconnect(page){await page.unroute('**/api/**');await page.evaluate(()=>dispatchEvent(new Event('online')));}

/** An active log of the linked template; returns its id and exercise names. */
async function start(page,{focus=true,mutate=()=>{}}={}){
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#shell')).toBeVisible();
 const {id}=await createLinkedTemplate(page,'Recap day');
 const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const log=createWorkoutLog({id:crypto.randomUUID(),now:new Date(Date.now()-40*60000),makeId:()=>crypto.randomUUID(),template});mutate(log);
 const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 if(focus)await expect(page.locator('.workout-focus')).toBeVisible();else await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 return {id:log.id,names:log.exercises.map(e=>e.name),sets:log.exercises[0].sets.filter(s=>s.kind!=='warmup').length,count:log.exercises.length};
}
async function finishWithOneSet(page,name){
 await page.getByLabel(`Set 1 reps, ${name}`,{exact:true}).fill('8');
 await page.getByRole('button',{name:`Mark set 1 done, ${name}`,exact:true}).click();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
}
const recap=page=>page.locator('.workout-recap');

test('a Focus finish shows an honest recap, hands off the note and Done goes to Home',async({page})=>{
 const {id,names:[first],sets,count}=await start(page);
 await finishWithOneSet(page,first);
 await expect(recap(page)).toBeVisible();await expect(page).toHaveURL(new RegExp(`#/workouts/${id}$`));
 await expect(page.getByRole('heading',{name:'Good work.'})).toBeFocused();
 // The post-pruning record: one exercise with one of its working sets; the rest were not logged.
 await expect(recap(page).locator('.recap-exercise')).toHaveCount(1);
 await expect(recap(page).locator('.recap-exercise')).toContainText(`1 of ${sets} working sets logged`);
 if(count>1)await expect(recap(page).locator('.recap-skipped')).toHaveText(`${count-1} planned ${count===2?'exercise was':'exercises were'} not logged.`);
 await expect(recap(page)).not.toContainText(/^\s*\d+\s*$/);
 await expect(recap(page).locator('.recap-sync')).toHaveText('Saved to your history.');
 await expect(page.locator('.workout-focus')).toHaveCount(0);await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeHidden();
 expect((await serverRecord(page,id)).log.status).toBe('finished');
 // The note is edited through the finished-log autosave once acknowledged.
 await recap(page).getByRole('button',{name:'Add workout note',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Workout note',exact:true});await note.fill('Felt strong');
 await expect.poll(async()=>(await serverRecord(page,id)).log.note).toBe('Felt strong');
 await expect(note).toBeFocused();
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page).toHaveURL(/#\/home$/);await expect(page.locator('.home-history .workout-history-row')).toHaveCount(1);
});

test('Done lands on Home at the top with the workout first',async({page})=>{
 await login(page);await resetWorkouts(page);for(let i=0;i<52;i++)await saveFinishedLog(page,{name:'Previous workout '+i,startedAt:Date.now()-(i+1)*86400000});
 const name='Workout started from Home';await createLinkedTemplate(page,name);await page.goto('/#/home');await page.reload();
 await expect(page.locator('.home-history .workout-history-row')).toHaveCount(30);await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await expect(page.locator('.home-history .workout-history-row')).toHaveCount(52);await page.evaluate(()=>scrollTo(0,800));await openStartSheet(page);
 await page.getByRole('tab',{name:'Template',exact:true}).click();await page.getByRole('button',{name:'Start '+name,exact:true}).click();
 await expect(page.locator('.workout-focus')).toBeVisible();
 await expect(page.locator('.logger-status')).toHaveText('Saved');
 const {record}=await (await page.request.get('/api/workouts/active')).json();await finishWithOneSet(page,record.log.exercises[0].name);
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page).toHaveURL(/#\/home$/);await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 const row=page.locator('.home-history .workout-history-row').first();await expect(row).toContainText(name);expect((await row.boundingBox()).y).toBeLessThan((await page.getByRole('navigation',{name:'Main'}).boundingBox()).y);
 await expect(page.locator('.home-history .workout-history-row')).toHaveCount(30);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true}).click();await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Home',exact:true}).click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('.home-history .workout-history-row')).toHaveCount(30);
});

test('View workout opens the regular finished record; reload never replays the recap',async({page})=>{
 const {id,names:[first]}=await start(page);
 await finishWithOneSet(page,first);await expect(recap(page).locator('.recap-sync')).toHaveText('Saved to your history.');
 await page.getByRole('button',{name:'View workout',exact:true}).click();
 await expect(recap(page)).toHaveCount(0);await expect(page.getByLabel('Date',{exact:true})).toBeVisible();
 await expect(page).toHaveURL(new RegExp(`#/workouts/${id}$`));
 await page.reload();await expect(page.getByLabel('Date',{exact:true})).toBeVisible();await expect(recap(page)).toHaveCount(0);
});

test('resizing keeps the recap and never revives active controls',async({page})=>{
 const {names:[first]}=await start(page);
 await finishWithOneSet(page,first);await expect(recap(page)).toBeVisible();
 await page.setViewportSize({width:761,height:844});await page.setViewportSize({width:760,height:844});
 await expect(recap(page)).toBeVisible();await expect(page.locator('.workout-focus')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeHidden();
});

test('an offline finish is described as local, keeps the note read-only and syncs later',async({page})=>{
 const {id,names:[first]}=await start(page);
 await blockApi(page);
 await finishWithOneSet(page,first);
 await expect(recap(page)).toBeVisible();
 await expect(recap(page).locator('.recap-sync')).toHaveText('Finished on this device. It will sync automatically.');
 await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();
 await expect(recap(page)).not.toContainText('Saved to your history.');
 await expect(recap(page).getByRole('button',{name:'Add workout note',exact:true})).toHaveCount(0);
 await expect(recap(page).locator('.logger-status')).not.toHaveText('');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page).toHaveURL(/#\/home$/);
 await expect(page.locator('.workout-history-row')).toHaveCount(1);await expect(page.locator('.workout-history-row')).toContainText('Not synced yet');
 await reconnect(page);
 await expect.poll(async()=>(await serverRecord(page,id))?.log.status).toBe('finished');
});

test('desktop Finish keeps the regular navigation to History',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 const {names:[first]}=await start(page,{focus:false});
 await finishWithOneSet(page,first);
 await expect(page).toHaveURL(/#\/workouts$/);await expect(recap(page)).toHaveCount(0);
});

test('same-name exercises read with their tags in the recap',async({page})=>{
 await login(page);await resetWorkouts(page);
 const exercise=(name,brand='')=>({name,brand,focusTags:[],sets:1,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:['Chest'],secondaryMuscles:[]});
 const log=createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template:{id:'same-name',document:{name:'Same names',exercises:[exercise('Chest press','Hammer'),exercise('Chest press','Technogym'),exercise('Lateral raise')]}}});
 for(const ex of log.exercises)Object.assign(ex.sets[0],{reps:8,done:true});
 const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await expect(recap(page).locator('.recap-exercise-name')).toHaveText(['Chest press · Hammer','Chest press · Technogym','Lateral raise']);
});

test('pending recap retains Home before and after acknowledgement with one writer',async({page})=>{
 const {id,names:[first]}=await start(page);let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r),writes=[];
 await page.route('**/api/workouts/'+id,async route=>{if(route.request().method()!=='PUT')return route.continue();const log=route.request().postDataJSON().log;writes.push(log.status);if(log.status==='finished'){seen();await held;}await route.continue();});
 await finishWithOneSet(page,first);await requested;await expect(recap(page)).toBeVisible();await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();await expect(recap(page).locator('.recap-sync')).toHaveText('Finished on this device. It will sync automatically.');await expect(recap(page).getByRole('button',{name:'Add workout note',exact:true})).toHaveCount(0);
 release();await expect(recap(page).locator('.recap-sync')).toHaveText('Saved to your history.');await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
 await recap(page).getByRole('button',{name:'Add workout note',exact:true}).click();await page.getByRole('textbox',{name:'Workout note',exact:true}).fill('One finished writer');await expect.poll(async()=>(await serverRecord(page,id)).log.note).toBe('One finished writer');
 await page.getByRole('link',{name:'Back to Home',exact:true}).click();await expect(page.getByRole('navigation',{name:'Main'})).toBeVisible();await expect(page.locator('.home-history .workout-history-row')).toHaveCount(1);expect(writes.filter(status=>status==='finished')).toHaveLength(2);expect((await (await page.request.get('/api/workouts/active')).json()).record).toBeNull();
});

test('finishing a partial superset round prunes, dissolves the broken pair and keeps one truthful writer',async({page})=>{
 const {id,names:[first,second],sets}=await start(page,{mutate:l=>{l.exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:90};}});let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r),writes=[];
 await page.route('**/api/workouts/'+id,async route=>{if(route.request().method()!=='PUT')return route.continue();const log=route.request().postDataJSON().log;writes.push(log.status);if(log.status==='finished'){seen();await held;}await route.continue();});
 // Only A1 of round 1 is logged; A2 never is.
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('8');await page.locator('.focus-round').first().getByRole('button',{name:'Log A1 & switch to A2',exact:true}).click();
 await expect(page.locator('.focus-round').first().locator('.focus-partner').nth(1)).toHaveAttribute('aria-current','step');
 await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 await requested;await expect(recap(page)).toBeVisible();await expect(recap(page).locator('.recap-sync')).toHaveText('Finished on this device. It will sync automatically.');
 await expect(recap(page).getByRole('button',{name:'Add workout note',exact:true})).toHaveCount(0);await expect(page.locator('.workout-focus')).toHaveCount(0);
 await expect(recap(page).locator('.recap-exercise')).toHaveCount(1);await expect(recap(page).locator('.recap-exercise')).toContainText(first);await expect(recap(page).locator('.recap-exercise')).toContainText(`1 of ${sets} working sets logged`);
 await expect(recap(page)).not.toContainText(second);await expect(recap(page).locator('.recap-skipped')).toHaveText('1 planned exercise was not logged.');
 release();await expect(recap(page).locator('.recap-sync')).toHaveText('Saved to your history.');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
 const {log}=await serverRecord(page,id);expect(log.status).toBe('finished');expect(log.exercises.map(e=>e.name)).toEqual([first]);expect(log.exercises[0]).not.toHaveProperty('superset');
 expect(log.exercises[0].sets.map(s=>[s.done,s.reps])).toEqual([[true,8]]);expect(writes.filter(s=>s==='finished')).toHaveLength(1);expect((await (await page.request.get('/api/workouts/active')).json()).record).toBeNull();
});
