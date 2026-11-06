import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate} from './workout-helper.js';

const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const status=page=>page.locator('.logger-status');
let T='Push A';

/** Starts a workout from the template library card and waits until it is saved. */
async function start(page,{fresh=true}={}){
 if(fresh){
  await login(page);await resetWorkouts(page);
  await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
  T='Push '+crypto.randomUUID().slice(0,6);
  await createLinkedTemplate(page,T);
 }
 await page.getByRole('link',{name:/^(Session templates|Templates)$/}).click();
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 await expect(status(page)).toHaveText('Saved');
 return {id:new URL(page.url()).hash.split('/').at(-1),names:await page.locator('.log-exercise h2').allTextContents()};
}
const done=(page,n,name)=>page.getByRole('button',{name:`Mark set ${n} done, ${name}`,exact:true});
const noteOf=async(page,id)=>(await serverRecord(page,id)).log.exercises[0].note;
const editName=exercise=>new RegExp('^Edit note, '+exercise.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+': ');
const blur=page=>page.getByLabel('Workout name',{exact:true}).focus();
const finish=async page=>{
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
};

for(const [label,viewport,hasTouch] of [['390 touch',{width:390,height:800},true],['1366',{width:1366,height:768},false]]){
 test.describe(label,()=>{
  test.use({viewport,hasTouch});

  test('exercise notes open, save, reopen, clear and carry over as last time',async({page})=>{
   const {id,names:[first]}=await start(page);
   const add=page.getByRole('button',{name:`Add note, ${first}`,exact:true});
   await expect(add).toHaveText('✎ Add note');
   expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(31.5);
   await add.click();
   const input=page.getByLabel(`Note, ${first}`,{exact:true});
   await expect(input).toBeFocused();
   await input.fill('Seat 4');
   await input.press('Enter');await input.pressSequentially('top pin');
   await expect(input).toHaveValue('Seat 4\ntop pin');
   await input.fill('Seat 4');
   await blur(page);
   const text=page.getByRole('button',{name:editName(first)});
   await expect(text).toHaveText('✎ Seat 4');
   await expect(status(page)).toHaveText('Saved');
   expect(await noteOf(page,id)).toBe('Seat 4');
   await text.click();
   await expect(input).toBeFocused();
   expect(await input.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([6,6]);
   await input.fill('   ');await blur(page);
   await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toHaveText('✎ Add note');
   await expect(status(page)).toHaveText('Saved');
   expect(await noteOf(page,id)).toBe('');
   // Note again, finish, then start the same template: the note shows as read-only last-time text, not copied.
   await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
   await input.fill('Seat 4');await blur(page);
   await done(page,1,first).click();
   await expect(status(page)).toHaveText('Saved');
   await finish(page);
   const next=await start(page,{fresh:false});
   const card=page.locator('.log-exercise').filter({has:page.getByRole('heading',{name:first,exact:true})});
   await expect(card.locator('p.log-last-note')).toContainText('Seat 4');
   await expect(card.locator('p.log-last-note')).toHaveAttribute('title','Seat 4');
   await expect(card.locator('p.log-last-note .visually-hidden')).toHaveText('Last time note:');
   await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toBeVisible();
   expect(await noteOf(page,next.id)).toBe('');
  });

  test('a finished workout edits its note through autosave',async({page})=>{
   const {id,names:[first]}=await start(page);
   await done(page,1,first).click();
   await expect(status(page)).toHaveText('Saved');
   await finish(page);
   await page.goto('/#/workouts/'+id);
   await expect(page.getByLabel('Start time',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
   await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Felt heavy');
   await blur(page);
   await expect.poll(()=>noteOf(page,id)).toBe('Felt heavy');
  });

  test('a long note wraps without horizontal scroll',async({page})=>{
   await page.setViewportSize({width:360,height:800});
   const {names:[first]}=await start(page);
   await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
   await page.getByLabel(`Note, ${first}`,{exact:true}).fill('word '.repeat(200).trim().slice(0,1000));
   await blur(page);
   const text=page.getByRole('button',{name:editName(first)});
   await expect(text).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await text.boundingBox()).width).toBeLessThanOrEqual(360);
  });
 });
}

test('a note typed offline survives reload and syncs once restored',async({page})=>{
 const {id,names:[first]}=await start(page);
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Seat 4');await blur(page);
 await page.reload();
 await expect(page.getByRole('button',{name:editName(first)})).toHaveText('✎ Seat 4');
 await page.unroute('**/api/**');await page.evaluate(()=>dispatchEvent(new Event('online')));
 await expect(status(page)).toHaveText('Saved');
 expect(await noteOf(page,id)).toBe('Seat 4');
});

test('the read-only history view shows the note as text with no add button',async({page})=>{
 const {names:[first,second]}=await start(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await page.getByLabel(`Note, ${first}`,{exact:true}).fill('Seat 4');await blur(page);
 await expect(status(page)).toHaveText('Saved');
 await done(page,1,first).click();
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));
 await finish(page);
 await page.locator('.workout-history-row').first().click();
 await expect(page.getByLabel('Start time',{exact:true})).toBeHidden();
 await expect(page.locator('.log-note').filter({hasText:'Seat 4'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^(Add|Edit) note/})).toHaveCount(0);
 await expect(page.locator('.log-exercise').filter({hasText:second}).locator('.log-note')).toBeHidden();
});

test('the note editor animates under normal motion and survives rapid reversal',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const {names:[first]}=await start(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toBeFocused();
 await blur(page);
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:`Add note, ${first}`,exact:true})).toBeVisible();
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await blur(page);
 await page.getByRole('button',{name:`Add note, ${first}`,exact:true}).click();
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toHaveCount(1);
 await expect(page.getByLabel(`Note, ${first}`,{exact:true})).toBeFocused();
});
