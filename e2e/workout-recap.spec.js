import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

test.use({viewport:{width:390,height:844},hasTouch:true});
const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const blockApi=page=>page.route('**/api/**',route=>route.abort('internetdisconnected'));
async function reconnect(page){await page.unroute('**/api/**');await page.evaluate(()=>dispatchEvent(new Event('online')));}

/** An active log of the linked template; returns its id and exercise names. */
async function start(page,{focus=true}={}){
 await login(page);await resetWorkouts(page);await page.reload();await expect(page.locator('#shell')).toBeVisible();
 const {id}=await createLinkedTemplate(page,'Recap day');
 const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const log=createWorkoutLog({id:crypto.randomUUID(),now:new Date(Date.now()-40*60000),makeId:()=>crypto.randomUUID(),template});
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

test('a Focus finish shows an honest recap, hands off the note and Done goes to History',async({page})=>{
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
 await expect(page).toHaveURL(/#\/workouts$/);await expect(page.locator('.workout-history-row')).toHaveCount(1);
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
 await expect(recap(page)).not.toContainText('Saved to your history.');
 await expect(recap(page).getByRole('button',{name:'Add workout note',exact:true})).toHaveCount(0);
 await expect(recap(page).locator('.logger-status')).not.toHaveText('');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
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
