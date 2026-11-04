import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';
import {addExercise,finishWorkout} from '../src/workout-edit.js';

const makeId=()=>crypto.randomUUID();
const serverRecord=async(page,id)=>(await (await page.request.get(`/api/workouts/${id}`)).json()).record;
const status=page=>page.getByTestId('save-status');

/** A finished 10:00–10:45 workout with two exercises: 80×8 @2 (one set) and 50×10 (one set). */
async function setup(page){
 await login(page);await resetWorkouts(page);
 await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const {id:templateId}=await createLinkedTemplate(page,'Push '+makeId().slice(0,6));
 const template=(await (await page.request.get(`/api/documents/${templateId}`)).json()).record;
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const spare=entries.find(e=>!e.archived&&e.equipment&&!template.document.exercises.some(x=>x.catalogId===e.id));
 let log=createWorkoutLog({id:makeId(),now:new Date(2026,9,5,10,0),makeId,template});
 log=addExercise(log,spare,makeId);
 log={...log,name:'Upper day',exercises:[
  {...log.exercises[0],sets:[{id:makeId(),weightKg:80,reps:8,rir:2,done:true}]},
  {...log.exercises[2],sets:[{id:makeId(),weightKg:50,reps:10,rir:null,done:true}]}]};
 log=finishWorkout(log,new Date(2026,9,5,10,45)).log;
 const response=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(response.ok(),await response.text()).toBeTruthy();
 return {log,names:log.exercises.map(e=>e.name),variantId:log.exercises[0].variantId};
}
const open=async(page,id)=>{await page.goto('/#/workouts/'+id);await expect(page.getByLabel('Start time',{exact:true})).toBeVisible();};

test('a finished workout edits online with autosave',async({page})=>{
 const {log,names:[first,second],variantId}=await setup(page);
 await open(page,log.id);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeHidden();
 await expect(page.getByRole('button',{name:/^Mark set/})).toHaveCount(0);
 await expect(page.getByLabel('Date',{exact:true})).toHaveValue('2026-10-05');
 await expect(page.getByLabel('Start time',{exact:true})).toHaveValue('10:00');
 await expect(page.getByLabel('End time',{exact:true})).toHaveValue('10:45');
 await expect(page.locator('.logger-elapsed')).toHaveText('45 min');
 for(const field of ['Date','Start time','End time']){
  const box=await page.getByLabel(field,{exact:true}).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(32);
 }

 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('9');
 await expect(status(page)).toHaveText('Saved');
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.exercises[0].sets[0].reps).toBe(9);
 await page.reload();
 await expect(page.getByLabel(`Set 1 reps, ${first}`,{exact:true})).toHaveValue('9');
 const last=(await (await page.request.get('/api/workouts/last?variantIds='+variantId)).json()).lastTime;
 expect(last[variantId].sets[0]).toMatchObject({weightKg:80,reps:9});

 await page.getByLabel('Start time',{exact:true}).fill('23:30');
 await page.getByLabel('End time',{exact:true}).fill('00:40');
 await expect(page.locator('.logger-elapsed')).toHaveText('1 h 10 min');
 await expect(status(page)).toHaveText('Saved');
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.finishedAt.slice(0,16)).toBe('2026-10-06T00:40');
 const revision=(await serverRecord(page,log.id)).revision;
 await page.getByLabel('End time',{exact:true}).fill('23:30');
 await expect(page.locator('.logger-message')).toHaveText('End time must be after the start time.');
 await expect(status(page)).toHaveText('Saved');
 expect((await serverRecord(page,log.id)).revision).toBe(revision);

 // Clearing reps asks for reps and does not touch the save status until fixed.
 await page.getByLabel('End time',{exact:true}).fill('00:40');
 await expect(page.locator('.logger-message')).toHaveText('');
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('');
 await expect(page.locator('.log-exercise').first().locator('.log-set-error')).toHaveText('Enter reps');
 await page.waitForTimeout(700);
 await expect(status(page)).toHaveText('Saved');
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('10');
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.exercises[0].sets[0].reps).toBe(10);

 // Add set copies the previous row as a done set.
 await page.getByRole('button',{name:`Add set, ${first}`,exact:true}).click();
 await expect(page.getByLabel(`Set 2 weight, ${first}`,{exact:true})).toHaveValue('80');
 await expect(page.getByLabel(`Set 2 reps, ${first}`,{exact:true})).toHaveValue('10');
 await expect(page.getByRole('group',{name:`Set 2 RIR, ${first}`}).getByRole('button',{name:'2',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>{const s=(await serverRecord(page,log.id)).log.exercises[0].sets;return s.length+':'+s[1]?.done;}).toBe('2:true');

 // Removing the last set of an exercise removes the exercise after confirming.
 await page.getByRole('button',{name:`Remove set 1, ${second}`,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Remove exercise?'});
 await expect(dialog).toContainText(`Remove ${second} and its logged sets?`);
 await dialog.getByRole('button',{name:'Remove exercise'}).click();
 await expect(page.getByRole('heading',{name:second,exact:true})).toHaveCount(0);
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.exercises.length).toBe(1);
 await expect(page.getByRole('heading',{name:first,exact:true})).toBeFocused();

 // The last exercise cannot be removed.
 await page.getByRole('button',{name:`Remove exercise ${first}`,exact:true}).click();
 await expect(page.locator('.logger-message')).toHaveText('A workout needs at least one exercise. Delete the workout instead.');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:`Remove set 2, ${first}`,exact:true}).click();
 await page.getByRole('button',{name:`Remove set 1, ${first}`,exact:true}).click();
 await expect(page.locator('.logger-message')).toHaveText('A workout needs at least one exercise. Delete the workout instead.');
 await expect(page.getByRole('heading',{name:first,exact:true})).toBeVisible();
});

test('a new set with no derivable reps stays unsaved until reps are entered',async({page})=>{
 const {log}=await setup(page);
 await open(page,log.id);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByRole('combobox',{name:'Exercise'}).fill('curl');
 await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first().click();
 const added=page.locator('.log-exercise').last();
 await expect(added.locator('.log-set-error')).toHaveText('Enter reps');
 await page.waitForTimeout(700);
 await expect(status(page)).toHaveText('Saved');
 expect((await serverRecord(page,log.id)).log.exercises.length).toBe(2);
 await added.locator('input[data-field="reps"]').fill('12');
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.exercises.length).toBe(3);
});

test('valid edits save beside an incomplete set, and leaving asks before dropping it',async({page})=>{
 const {log,names:[first]}=await setup(page);
 await open(page,log.id);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByRole('combobox',{name:'Exercise'}).fill('curl');
 await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first().click();
 await expect(page.locator('.log-exercise').last().locator('.log-set-error')).toHaveText('Enter reps');
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('7');
 await expect.poll(async()=>(await serverRecord(page,log.id)).log.exercises[0].sets[0].reps).toBe(7);
 expect((await serverRecord(page,log.id)).log.exercises.length).toBe(2);
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Discard unsaved changes?'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel'}).click();
 await expect(page).toHaveURL(new RegExp('#/workouts/'+log.id));
 await expect(page.locator('.log-exercise').last().locator('.log-set-error')).toHaveText('Enter reps');
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard unsaved changes?'}).getByRole('button',{name:'Discard and leave'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
});

test('delete and conflict on finished workouts',async({page})=>{
 const {log,names:[first]}=await setup(page);
 await open(page,log.id);
 // Conflict: a newer revision saved elsewhere.
 const record=await serverRecord(page,log.id);
 const bumped=structuredClone(record.log);bumped.exercises[0].sets[0].reps=15;
 expect((await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:record.revision,log:bumped}})).ok()).toBeTruthy();
 await page.getByLabel(`Set 1 reps, ${first}`,{exact:true}).fill('11');
 await expect(status(page)).toHaveText('Conflict');
 await expect(page.getByRole('button',{name:'Reload saved version',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Save as copy',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Reload saved version',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Reload saved version'}).click();
 await expect(page.getByLabel(`Set 1 reps, ${first}`,{exact:true})).toHaveValue('15');
 await expect(status(page)).toHaveText('Saved');

 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Delete workout',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Delete workout?'});
 await expect(dialog).toContainText('This workout will be deleted. This cannot be undone.');
 await dialog.getByRole('button',{name:'Delete workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(page.locator('.workout-history-row')).toHaveCount(0);
 expect((await page.request.get(`/api/workouts/${log.id}`)).status()).toBe(404);
});
