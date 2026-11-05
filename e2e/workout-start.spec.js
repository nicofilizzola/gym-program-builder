import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';

const serverRecord=async(page,id)=>{const response=await page.request.get(`/api/workouts/${id}`);return response.ok()?(await response.json()).record:null;};
const activeRecord=async page=>(await (await page.request.get('/api/workouts/active')).json()).record;
const logId=page=>new URL(page.url()).hash.split('/').at(-1);
let T='Push A';
const bar=page=>page.locator('.workout-bar');

/** A program 'PPL' with one Monday occurrence of the linked template `${T}`. */
async function setup(page){
 await login(page);await resetWorkouts(page);
 // Reboot so the workout controller does not hold a log left by an earlier test.
 await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 T='Push '+crypto.randomUUID().slice(0,6);
 const template=await createLinkedTemplate(page,`${T}`);
 const programId=crypto.randomUUID();
 const response=await page.request.post('/api/documents',{headers,data:{id:programId,kind:'program',document:{name:'PPL',mode:'schedule',goals:{},workouts:[{id:'occ',templateId:template.id,day:0}]}}});
 expect(response.ok()).toBeTruthy();
 return {templateId:template.id,programId};
}
async function expectLogger(page,name){
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue(name);
 return logId(page);
}
async function discardFromLogger(page){
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
}

test('start from a program card, a template card, the template editor and blank',async({page})=>{
 const {templateId,programId}=await setup(page);
 // Program card: icon action first in the card's action group.
 await page.goto('/#/programs/'+programId);
 const start=page.getByRole('button',{name:`Start workout ${T}`,exact:true});
 await expect(start).toBeVisible();
 await expect(page.locator('[data-workout="occ"] .item-actions button').first()).toHaveAttribute('aria-label',`Start workout ${T}`);
 await start.click();
 const programLog=await expectLogger(page,`${T}`);
 await expect(page.locator('.log-exercise')).toHaveCount(2);
 await expect.poll(async()=>(await serverRecord(page,programLog))?.log.source).toMatchObject({kind:'program',programId,occurrenceId:'occ',templateId,programName:'PPL',templateName:`${T}`});
 const first=await page.locator('.log-exercise h2').first().textContent();
 await page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true}).click();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Finish workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(page.locator('.workout-history-row').first()).toContainText(`PPL · ${T}`);
 // Template library card.
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 const templateLog=await expectLogger(page,`${T}`);
 await expect.poll(async()=>(await serverRecord(page,templateLog))?.log.source).toEqual({kind:'template',templateId,templateName:`${T}`});
 await discardFromLogger(page);
 // Template editor: starts from the unsaved in-memory state.
 await page.goto('/#/templates/'+templateId);
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 await page.getByLabel('Sets',{exact:true}).first().fill('4');
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 const editorLog=await expectLogger(page,`${T}`);
 await expect(page.locator('.log-exercise').first().locator('.log-set')).toHaveCount(4);
 await expect.poll(async()=>(await serverRecord(page,editorLog))?.log.source.kind).toBe('template');
 await discardFromLogger(page);
 // Program workout page records a program source.
 await page.goto(`/#/programs/${programId}/workouts/occ`);
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 const occurrenceLog=await expectLogger(page,`${T}`);
 await expect.poll(async()=>(await serverRecord(page,occurrenceLog))?.log.source).toMatchObject({kind:'program',programId,occurrenceId:'occ'});
 await discardFromLogger(page);
 // Blank from History.
 await page.getByRole('button',{name:'Start workout',exact:true}).click();await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 const blankLog=await expectLogger(page,'Workout');
 await expect(page.locator('.log-exercise')).toHaveCount(0);
 await expect.poll(async()=>(await serverRecord(page,blankLog))?.log.source).toEqual({kind:'blank'});
 await discardFromLogger(page);
 // An unknown log shows the not-found message.
 await page.goto('/#/workouts/'+crypto.randomUUID());
 await expect(page.getByText('Page not found. Choose Programs or Session templates.')).toBeVisible();
});

test('a second start asks to Resume, Finish or Discard the current workout',async({page})=>{
 const {programId}=await setup(page);
 await page.goto('/#/programs/'+programId);
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 const firstLog=await expectLogger(page,`${T}`);
 await expect.poll(async()=>(await activeRecord(page))?.id).toBe(firstLog);
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Workout in progress'});
 // Cancel changes nothing.
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await expect(dialog).toContainText(`Resume, finish or discard ${T} before starting a new workout.`);
 await expect(dialog.getByRole('button',{name:'Resume current'})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Finish current'})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Discard current'})).toHaveClass(/confirm-destructive/);
 await dialog.getByRole('button',{name:'Cancel'}).click();
 await expect(page).toHaveURL(/#\/templates$/);
 // Resume current opens the existing log.
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await dialog.getByRole('button',{name:'Resume current'}).click();
 await expect(page).toHaveURL(new RegExp(`#/workouts/${firstLog}$`));
 // Finish current with no done sets is refused and starts nothing.
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await dialog.getByRole('button',{name:'Finish current'}).click();
 await expect(page.locator('#app-message')).toHaveText('Log at least one set, or discard the workout.');
 await expect(page).toHaveURL(/#\/templates$/);
 expect((await activeRecord(page)).id).toBe(firstLog);
 // Discard current confirms, deletes the old log and opens the new one.
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 await dialog.getByRole('button',{name:'Discard current'}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 const secondLog=await expectLogger(page,`${T}`);
 expect(secondLog).not.toBe(firstLog);
 await expect.poll(async()=>(await page.request.get(`/api/workouts/${firstLog}`)).status()).toBe(404);
 await expect.poll(async()=>(await activeRecord(page))?.id).toBe(secondLog);
 await discardFromLogger(page);
});

test('active workout bar on other routes',async({page})=>{
 const {programId}=await setup(page);
 await page.goto('/#/programs/'+programId);
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 const id=await expectLogger(page,`${T}`);
 await expect(bar(page)).toBeHidden();
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await expect(bar(page)).toBeVisible();
 await expect(bar(page)).toContainText(`Workout in progress · ${T} · 0 min`);
 // Content reserves the bar's height.
 const reserved=await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom));
 const height=(await bar(page).boundingBox()).height;
 expect(reserved).toBeGreaterThanOrEqual(height-1);
 const resume=bar(page).getByRole('link',{name:'Resume'});
 await expect(resume).toHaveAttribute('href','#/workouts/'+id);
 await resume.click();
 await expect(page).toHaveURL(new RegExp(`#/workouts/${id}$`));
 await expect(bar(page)).toBeHidden();
 // A reload on another route shows the bar without an entrance animation.
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/#/templates');await page.reload();
 await expect(page.getByRole('heading',{name:'Session templates',exact:true})).toBeVisible();
 await expect(bar(page)).toBeVisible();
 expect(await bar(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
 // Finishing from another route slides the bar out.
 await bar(page).getByRole('link',{name:'Resume'}).click();
 const first=await page.locator('.log-exercise h2').first().textContent();
 await page.getByRole('button',{name:`Mark set 1 done, ${first}`,exact:true}).click();
 await expect(page.locator('.logger-status')).toHaveText('Saved');
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await expect(bar(page)).toBeVisible();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:`Start workout ${T}`,exact:true}).click();
 // Record the bar's state at the moment it starts closing, while still on Session templates.
 await page.evaluate(()=>{
  const el=document.querySelector('.workout-bar');window.barClosing=[];
  new MutationObserver(()=>{if(el.getAttribute('aria-hidden')==='true')window.barClosing.push({hash:location.hash,inert:el.inert,hidden:el.hidden,open:el.classList.contains('is-open')});}).observe(el,{attributes:true,attributeFilter:['aria-hidden']});
 });
 await page.getByRole('dialog',{name:'Workout in progress'}).getByRole('button',{name:'Finish current'}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 expect(logId(page)).not.toBe(id);
 // Closing started off the logger route: inert and aria-hidden at once, still displayed while it slides out.
 expect(await page.evaluate(()=>window.barClosing[0])).toMatchObject({hash:'#/templates',inert:true,hidden:false,open:false});
 await expect.poll(async()=>(await serverRecord(page,id))?.log.status).toBe('finished');
 await expect(bar(page)).toBeHidden();
 // Finishing from the logger, then visiting other routes, leaves the bar hidden.
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await expect(bar(page)).toBeVisible();
 await bar(page).getByRole('link',{name:'Resume'}).click();
 const next=await page.locator('.log-exercise h2').first().textContent();
 await page.getByRole('button',{name:`Mark set 1 done, ${next}`,exact:true}).click();
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(bar(page)).toBeHidden();
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 await expect(bar(page)).toBeHidden();
 await expect(bar(page)).toHaveAttribute('aria-hidden','true');
 // A log started on another device shows the bar after a reload.
 const other=crypto.randomUUID(),now=new Date();
 const log={id:other,logVersion:1,status:'active',name:'Legs',startedAt:now.toISOString().replace('Z','+00:00'),finishedAt:null,source:{kind:'blank'},exercises:[]};
 expect((await page.request.put(`/api/workouts/${other}`,{headers,data:{revision:0,log}})).ok()).toBeTruthy();
 await page.reload();
 await expect(bar(page)).toContainText('Workout in progress · Legs · 0 min');
 await bar(page).getByRole('link',{name:'Resume'}).click();
 await expectLogger(page,'Legs');
 await discardFromLogger(page);
});
