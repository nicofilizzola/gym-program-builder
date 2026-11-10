import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

// Heights are visible browser viewports (browser UI already subtracted), not device screen sizes.
async function open(browser,{width,height,history=false}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,baseURL:'http://127.0.0.1:3199'}),page=await context.newPage();
 await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Fit');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const make=()=>createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});
 if(history){
  const past=make(),start=new Date(Date.now()-86400000);past.status='finished';past.startedAt=start.toISOString();past.finishedAt=new Date(start.getTime()+3600000).toISOString();
  past.exercises[0].note='Brace hard, slow eccentric, pause at the bottom of every rep.';
  for(const ex of past.exercises)for(const set of ex.sets)Object.assign(set,{weightKg:62.5,reps:10,done:true});
  const r=await page.request.put('/api/workouts/'+past.id,{headers,data:{revision:0,log:past}});expect(r.ok(),await r.text()).toBeTruthy();
 }
 const log=make();const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();
 return {page,context};
}
const fits=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),card=f.querySelector(':scope>.log-set'),done=card.querySelector('.log-done');
 const fb=f.getBoundingClientRect(),cb=card.getBoundingClientRect(),db=done.getBoundingClientRect();
 return {doneInside:db.top>=fb.top-0.5&&db.bottom<=fb.bottom+0.5,preview:Math.round(fb.bottom-cb.bottom),overflowX:document.documentElement.scrollWidth>innerWidth};});

for(const [width,height,minPreview] of [[360,660,24],[390,664,24],[412,660,24],[412,760,48],[390,844,48],[430,932,48]])
 test(`whole card and preview fit at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height});
  await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
  expect((await fits(page)).preview).toBeGreaterThanOrEqual(minPreview);
  await context.close();
 });
test('card with Last time, previous note and Best still fits at 412x760',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:760,history:true});
 await expect(page.locator('.focus-feed>.log-set').first().locator('.log-last-note')).toBeVisible();
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 expect((await fits(page)).preview).toBeGreaterThanOrEqual(0);
 await context.close();
});
