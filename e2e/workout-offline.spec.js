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
 await page.getByRole('button',{name:'Start workout',exact:true}).click();await page.getByRole('button',{name:'Blank workout',exact:true}).click();
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
  const response=await page.request.put(`/api/workouts/${id}`,{headers,data:{revision:record.revision,log:{...record.log,name,note:'Server workout note'}}});
  expect(response.ok()).toBeTruthy();
 };
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 await page.getByLabel('Workout note',{exact:true}).fill('Local workout note');await page.getByLabel('Workout name',{exact:true}).focus();
 await expect(status(page)).toHaveText('Saved');
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
 expect((await serverRecord(page,id)).log.note).toBe('Local workout note');
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
 await expect(page.getByRole('button',{name:'Edit workout note',exact:true})).toHaveText('Server workout note');
 await expect(done(page,2,first)).toHaveAttribute('aria-pressed','false');
 await expect(status(page)).toHaveText('Saved');
 // An offline-started log while another device starts one.
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await blockApi(page);
 await page.getByRole('button',{name:'Start workout',exact:true}).click();await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 const local=new URL(page.url()).hash.split('/').at(-1);
 await expect(status(page)).toHaveText(OFFLINE);
 const other=crypto.randomUUID();
 const log={id:other,logVersion:1,status:'active',name:'Legs',startedAt:new Date().toISOString().replace('Z','+00:00'),finishedAt:null,source:{kind:'blank'},exercises:[]};
 expect((await page.request.put(`/api/workouts/${other}`,{headers,data:{revision:0,log}})).ok()).toBeTruthy();
 await reconnect(page);
 // The dialog names the other workout and what each choice discards; Keep asks before deleting it.
 await expect(dialog).toContainText('Legs is in progress on another device. Only one workout can be in progress.');
 await expect(dialog.getByRole('button',{name:'Switch to Legs (discards Workout)',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Keep Workout (discards Legs)',exact:true}).click();
 const discard=page.getByRole('dialog',{name:'Discard Legs?'});
 await expect(discard).toContainText('Legs and its sets will be deleted. This cannot be undone.');
 expect((await page.request.get(`/api/workouts/${other}`)).status()).toBe(200);
 await discard.getByRole('button',{name:'Discard workout',exact:true}).click();
 await expect(status(page)).toHaveText('Saved');
 expect((await activeRecord(page)).id).toBe(local);
 expect((await page.request.get(`/api/workouts/${other}`)).status()).toBe(404);
});

test('Keep over a workout finished on another device finishes this device’s log',async({page})=>{
 const {id,names:[first]}=await start(page);
 await blockApi(page);
 await done(page,1,first).click();await done(page,2,first).click();
 await expect(status(page)).toHaveText(OFFLINE);
 // Another device finishes the saved copy (one done set, renamed).
 const record=await serverRecord(page,id);
 const ex=record.log.exercises[0];
 const finished={...record.log,name:'Finished elsewhere',status:'finished',finishedAt:new Date(Date.parse(record.log.startedAt)+60000).toISOString().replace('Z','+00:00'),
  exercises:[{...ex,sets:[{...ex.sets[0],reps:5,done:true}]}]};
 expect((await page.request.put(`/api/workouts/${id}`,{headers,data:{revision:record.revision,log:finished}})).ok()).toBeTruthy();
 await reconnect(page);
 const dialog=page.getByRole('dialog',{name:'Workout changed elsewhere'});
 await expect(dialog).toContainText("This workout was finished on another device. Keep this device's version to finish it with this device's sets.");
 await dialog.getByRole('button',{name:"Keep this device's version"}).click();
 const warning=page.getByRole('dialog',{name:'Finish workout?'});
 await expect(warning).toContainText('sets not completed — finish anyway? Uncompleted sets will be removed.');
 await warning.getByRole('button',{name:'Finish workout'}).click();
 await expect.poll(async()=>(await serverRecord(page,id)).log.name).toBe(T);
 const saved=(await serverRecord(page,id)).log;
 expect(saved.status).toBe('finished');expect(saved.exercises.map(e=>e.sets.length)).toEqual([2]);
 await expect(page.locator('.logger-finish')).toBeHidden();
 await expect(page.locator('.workout-bar')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
});

test('a copy finished elsewhere with nothing done here offers only Use saved version',async({page})=>{
 const {id}=await start(page);
 await page.getByLabel('Workout name',{exact:true}).fill('Renamed here');await page.getByLabel('Workout name',{exact:true}).press('Tab');
 await expect.poll(async()=>(await serverRecord(page,id)).log.name).toBe('Renamed here');
 await blockApi(page);
 await page.getByLabel('Workout name',{exact:true}).fill('Renamed offline');await page.getByLabel('Workout name',{exact:true}).press('Tab');
 await expect(status(page)).toHaveText(OFFLINE);
 const record=await serverRecord(page,id);const ex=record.log.exercises[0];
 const finished={...record.log,status:'finished',finishedAt:new Date(Date.parse(record.log.startedAt)+60000).toISOString().replace('Z','+00:00'),exercises:[{...ex,sets:[{...ex.sets[0],reps:5,done:true}]}]};
 expect((await page.request.put(`/api/workouts/${id}`,{headers,data:{revision:record.revision,log:finished}})).ok()).toBeTruthy();
 await reconnect(page);
 const dialog=page.getByRole('dialog',{name:'Workout changed elsewhere'});
 await expect(dialog).toContainText('This workout was finished on another device.');
 await expect(dialog.getByRole('button')).toHaveText(['Cancel','Use saved version']);
 await dialog.getByRole('button',{name:'Use saved version'}).click();
 await page.getByRole('dialog',{name:'Use saved version?'}).getByRole('button',{name:'Use saved version'}).click();
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue('Renamed here');
 await expect(page.locator('.logger-finish')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).toBeNull();
});

test('a paused save failure shows Retry in the logger',async({page})=>{
 const {id}=await start(page);
 await page.route(`**/api/workouts/${id}`,route=>route.request().method()==='PUT'?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Rejected.'})}):route.continue());
 await page.getByLabel('Workout name',{exact:true}).fill('Retry me');await page.getByLabel('Workout name',{exact:true}).press('Tab');
 await expect(status(page)).toHaveText('Couldn’t save');
 const retry=page.locator('.logger-meta').getByRole('button',{name:'Retry',exact:true});
 await expect(retry).toBeVisible();
 await page.unroute(`**/api/workouts/${id}`);
 await retry.click();
 await expect(status(page)).toHaveText('Saved');await expect(retry).toBeHidden();
 expect((await serverRecord(page,id)).log.name).toBe('Retry me');
});

test('after Log out an offline reload still asks for the password',async({page})=>{
 await start(page);
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await page.getByRole('button',{name:'Log out',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 // Log out keeps the mirrored workout.
 expect(await page.evaluate(()=>localStorage.getItem('gpb.activeWorkout'))).not.toBeNull();
 await blockApi(page);
 await page.reload();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await expect(page.locator('#shell')).toBeHidden();
 await expect(page.locator('.workout-logger')).toHaveCount(0);
 // Signing in again clears the flag and recovers the workout.
 await page.unroute('**/api/**');
 await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workout-bar')).toContainText(`Workout in progress · ${T}`);
 expect(await page.evaluate(()=>localStorage.getItem('gpb.signedOut'))).toBeNull();
});
