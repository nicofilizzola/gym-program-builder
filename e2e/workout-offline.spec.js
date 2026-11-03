import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';

const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const activeRecord=async page=>(await (await page.request.get('/api/workouts/active')).json()).record;
const status=page=>page.locator('.logger-status');
let T='Push A';
const OFFLINE='Offline · saved on this device';
const blockApi=page=>page.route('**/api/**',route=>route.abort('internetdisconnected'));
async function reconnect(page){await page.unroute('**/api/**');await page.evaluate(()=>dispatchEvent(new Event('online')));}

/** Starts a workout from the template library card and waits until it is saved. */
async function start(page){
 await login(page);await resetWorkouts(page);
 // Reboot so the workout controller does not hold a log left by an earlier test.
 await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 T='Push '+crypto.randomUUID().slice(0,6);
 await createLinkedTemplate(page,`${T}`);
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 await expect(status(page)).toHaveText('Saved');
 const id=new URL(page.url()).hash.split('/').at(-1);
 const names=await page.locator('.log-exercise h2').allTextContents();
 return {id,names};
}
const done=(page,n,name)=>page.getByRole('button',{name:`Mark set ${n} done, ${name}`,exact:true});

test('offline logging survives reload and syncs on reconnect',async({page})=>{
 const {id,names:[first]}=await start(page);
 await blockApi(page);
 await done(page,1,first).click();await done(page,2,first).click();
 await expect(status(page)).toHaveText(OFFLINE);
 await page.reload();
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue(`${T}`);
 await expect(done(page,1,first)).toHaveAttribute('aria-pressed','true');
 await expect(done(page,2,first)).toHaveAttribute('aria-pressed','true');
 await expect(status(page)).toHaveText(OFFLINE);
 await reconnect(page);
 await expect(status(page)).toHaveText('Saved');
 const record=await serverRecord(page,id);
 expect(record.log.exercises[0].sets.slice(0,2).map(s=>s.done)).toEqual([true,true]);
});

test('finishing offline shows a pending History row and syncs later',async({page})=>{
 const {id,names:[first]}=await start(page);
 await blockApi(page);
 await done(page,1,first).click();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(page.getByRole('heading',{level:1,name:'Workouts'})).toBeVisible();
 await expect(page.locator('.workout-history-row')).toHaveCount(1);
 await expect(page.locator('.workout-history-row')).toContainText('Not synced yet');
 await expect(page.getByText('Workouts could not be loaded. Connect to see your history.')).toBeVisible();
 await expect(page.locator('.workout-bar')).toBeHidden();
 // A new start waits for the finished workout to sync.
 await page.getByRole('button',{name:'Start blank workout',exact:true}).click();
 await expect(page.locator('#app-message')).toHaveText('Your finished workout has not synced yet. Connect to sync it before starting a new workout.');
 await reconnect(page);
 await expect.poll(async()=>(await serverRecord(page,id))?.log.status).toBe('finished');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
 await page.reload();
 await expect(page.locator('.workout-history-row')).toHaveCount(1);
 await expect(page.locator('.workout-history-row')).not.toContainText('Not synced yet');
});

test('discarding needs a connection once the workout is on the server',async({page})=>{
 const {id}=await start(page);
 await blockApi(page);
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page.locator('.logger-message')).toHaveText('Connect to discard this workout.');
 await expect(page).toHaveURL(new RegExp(`#/workouts/${id}$`));
 await reconnect(page);
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 expect((await page.request.get(`/api/workouts/${id}`)).status()).toBe(404);
});

test('conflicts offer Keep this device’s version or Use saved version',async({page})=>{
 const {id,names:[first]}=await start(page);
 const dialog=page.getByRole('dialog',{name:'Workout changed elsewhere'});
 const changeOnServer=async name=>{
  const record=await serverRecord(page,id);
  const response=await page.request.put(`/api/workouts/${id}`,{headers,data:{revision:record.revision,log:{...record.log,name}}});
  expect(response.ok()).toBeTruthy();
 };
 // Keep this device's version.
 await blockApi(page);
 await done(page,1,first).click();
 await expect(status(page)).toHaveText(OFFLINE);
 await changeOnServer('Server copy');
 await reconnect(page);
 await expect(dialog).toContainText('This workout was changed on another device.');
 await expect(dialog.getByRole('button',{name:'Use saved version'})).toBeVisible();
 await dialog.getByRole('button',{name:"Keep this device's version"}).click();
 await expect(status(page)).toHaveText('Saved');
 await expect.poll(async()=>(await serverRecord(page,id)).log.exercises[0].sets[0].done).toBe(true);
 expect((await serverRecord(page,id)).log.name).toBe(`${T}`);
 // Use saved version, after a confirmation.
 await blockApi(page);
 await done(page,2,first).click();
 await expect(status(page)).toHaveText(OFFLINE);
 await changeOnServer('Server copy');
 await reconnect(page);
 await dialog.getByRole('button',{name:'Use saved version'}).click();
 const confirm=page.getByRole('dialog',{name:'Use saved version?'});
 await expect(confirm).toContainText('Your changes on this device will be discarded.');
 await confirm.getByRole('button',{name:'Use saved version'}).click();
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue('Server copy');
 await expect(done(page,2,first)).toHaveAttribute('aria-pressed','false');
 await expect(status(page)).toHaveText('Saved');
 // An offline-started log while another device starts one.
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await blockApi(page);
 await page.getByRole('button',{name:'Start blank workout',exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 const local=new URL(page.url()).hash.split('/').at(-1);
 await expect(status(page)).toHaveText(OFFLINE);
 const other=crypto.randomUUID();
 const log={id:other,logVersion:1,status:'active',name:'Legs',startedAt:new Date().toISOString().replace('Z','+00:00'),finishedAt:null,source:{kind:'blank'},exercises:[]};
 expect((await page.request.put(`/api/workouts/${other}`,{headers,data:{revision:0,log}})).ok()).toBeTruthy();
 await reconnect(page);
 await expect(dialog).toContainText('Another workout is already in progress on another device.');
 await expect(dialog.getByRole('button',{name:'Use saved version'})).toBeVisible();
 await dialog.getByRole('button',{name:"Keep this device's version"}).click();
 await expect(status(page)).toHaveText('Saved');
 expect((await activeRecord(page)).id).toBe(local);
 expect((await page.request.get(`/api/workouts/${other}`)).status()).toBe(404);
});
