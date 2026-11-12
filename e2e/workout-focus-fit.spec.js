import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

// Heights are visible browser viewports (browser UI already subtracted), not device screen sizes.
async function open(browser,{width,height,history=false,previousNote=true}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,baseURL:'http://127.0.0.1:3199'}),page=await context.newPage();
 await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Fit');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const make=()=>createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});
 if(history){
  const past=make(),start=new Date(Date.now()-86400000);past.status='finished';past.startedAt=start.toISOString();past.finishedAt=new Date(start.getTime()+3600000).toISOString();
  if(previousNote)past.exercises[0].note='Brace hard, slow eccentric, pause at the bottom of every rep.';
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

// The next card shows its whole header (set label, eyebrow, marker) or nothing; never any title.
const peek=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),[card,next]=f.querySelectorAll(':scope>.log-set'),fb=f.getBoundingClientRect();
 const visible=el=>{const b=el.getBoundingClientRect();return Math.max(0,Math.min(fb.bottom,b.bottom)-Math.max(fb.top,b.top));},header=next.querySelector('.focus-context');
 return {titlePx:visible(next.querySelector('.focus-exercise-title')),headerPx:visible(header),headerH:header.getBoundingClientRect().height,peekless:card.classList.contains('is-peekless'),cardH:card.getBoundingClientRect().height,feedH:fb.height};});
for(const [width,height,peekless] of [[360,660,false],[390,664,null],[393,659,false],[412,660,null],[412,760,null],[412,839,false],[412,850,false],[393,750,null],[440,770,null],[390,844,false],[430,932,false]])
 test(`whole card fits with a clean peek at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false});
  await expect(page.locator('.focus-feed>.log-set').first().locator('.log-best')).toBeVisible();
  await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
  const p=await peek(page);
  expect(p.titlePx,JSON.stringify(p)).toBeLessThanOrEqual(1);
  expect(p.headerPx===0||Math.abs(p.headerPx-p.headerH)<=1,JSON.stringify(p)).toBe(true);
  if(peekless!==null)expect(p.peekless,JSON.stringify(p)).toBe(peekless);
  if(peekless)expect(p.cardH,JSON.stringify(p)).toBeLessThanOrEqual(p.feedH+1); // fits without the sticky fallback
  await context.close();
 });
test('card with Last time, previous note and Best still fits at 412x760',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:760,history:true});
 await expect(page.locator('.focus-feed>.log-set').first().locator('.log-last-note')).toBeVisible();
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 expect((await fits(page)).preview).toBeGreaterThanOrEqual(0);
 await context.close();
});
async function enlarged(browser){
 const opened=await open(browser,{width:390,height:664});
 await opened.page.addStyleTag({content:'html{font-size:200%}'});await opened.page.evaluate(()=>window.dispatchEvent(new Event('resize')));
 return opened;
}
test('200% text keeps Complete inside the feed',async({browser})=>{
 const {page,context}=await enlarged(browser);
 await expect.poll(async()=>(await fits(page)).doneInside).toBe(true);
 await context.close();
});
test('only the viewed card pins Complete',async({browser})=>{
 const {page,context}=await enlarged(browser);
 const pinned=()=>page.evaluate(()=>[...document.querySelectorAll('.focus-feed>.log-set')].filter(r=>getComputedStyle(r.querySelector('.focus-complete')).position==='sticky').map(r=>r.dataset.setId));
 await expect.poll(async()=>(await pinned()).length).toBe(1);
 expect((await pinned())[0]).toBe(await page.locator('.focus-feed>.log-set').first().getAttribute('data-set-id'));
 await context.close();
});
test('a focused reps input is not hidden under the pinned Complete',async({browser})=>{
 const {page,context}=await enlarged(browser);
 const card=page.locator('.focus-feed>.log-set').first(),reps=card.locator('[data-field="reps"]');await reps.focus();
 await expect.poll(async()=>{const [i,c]=await Promise.all([reps.boundingBox(),card.locator('.focus-complete').boundingBox()]);return i.y+i.height<=c.y+1;}).toBe(true);
 await context.close();
});
test('opening the keyboard keeps the focused reps input above the pinned Complete',async({browser})=>{
 const {page,context}=await open(browser,{width:390,height:664});
 const card=page.locator('.focus-feed>.log-set').first(),reps=card.locator('[data-field="reps"]');await reps.click();
 await page.setViewportSize({width:390,height:380});
 await expect.poll(async()=>{const [i,c,f]=await Promise.all([reps.boundingBox(),card.locator('.focus-complete').boundingBox(),page.locator('.focus-feed').boundingBox()]);return i.y>=f.y-1&&i.y+i.height<=Math.min(c.y,f.y+f.height)+1;}).toBe(true);
 await expect(reps).toBeFocused();
 await context.close();
});
// Vertical gaps between consecutive card sections, top to bottom; the last one runs to the card's separator.
const rhythm=page=>page.evaluate(()=>{const card=document.querySelector('.focus-feed>.log-set'),box=s=>card.querySelector(s).getBoundingClientRect(),R=Math.round;
 const [ctx,id,hist,ctl,rir,done]=['.focus-context','.focus-identity','.focus-history','.focus-number-controls','.focus-rir-strip','.log-done'].map(box);
 return {ctxToTitle:R(id.top-ctx.bottom),titleToHistory:R(hist.top-id.bottom),historyToControls:R(ctl.top-hist.bottom),controlsToRir:R(rir.top-ctl.bottom),rirToDone:R(done.top-rir.bottom),doneToEnd:R(card.getBoundingClientRect().bottom-1-done.bottom)};});
for(const [width,height] of [[360,660],[390,664],[393,659],[393,750],[412,660],[412,760],[412,839],[412,850],[440,770],[390,844],[430,932]])
 test(`consistent rhythm at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false});
  await expect(page.locator('.focus-feed>.log-set').first().locator('.log-best')).toBeVisible();
  const r=await rhythm(page),g=Object.values(r);
  expect(Math.min(...g),JSON.stringify(r)).toBeGreaterThanOrEqual(6);
  expect(Math.max(...g)-Math.min(...g),JSON.stringify(r)).toBeLessThanOrEqual(16);
  expect(r.rirToDone,JSON.stringify(r)).toBeGreaterThanOrEqual(r.controlsToRir);
  await context.close();
 });
test('feeds of 560px and taller use the large inputs',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:839});
 expect(await page.locator('.focus-feed').evaluate(f=>f.clientHeight)).toBeGreaterThanOrEqual(560);
 await expect(page.locator('.focus-feed>.log-set').first().locator('[data-field="reps"]')).toHaveCSS('font-size','52px');
 await context.close();
});
test('the help row and kg-steps select are gone',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:839});
 await expect(page.locator('.focus-input-help')).toHaveCount(0);await expect(page.locator('.focus-increment')).toHaveCount(0);
 await context.close();
});
test('an out-of-target caption still fits at 360x660',async({browser})=>{
 const {page,context}=await open(browser,{width:360,height:660,history:true,previousNote:false});
 const card=page.locator('.focus-feed>.log-set').first(),reps=card.locator('[data-field="reps"]');
 await reps.fill('2');await expect(card.locator('.focus-control-label.is-outside')).toContainText('below');
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 await context.close();
});
for(const [width,height,ruler] of [[412,839,56],[412,760,48],[360,660,44]])
 test(`rulers are ${ruler}px tall at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height});
  const strip=page.locator('.focus-feed>.log-set').first().locator('.workout-ruler').first();
  await expect(strip).toHaveCSS('height',ruler+'px');await expect(strip.locator('.workout-ruler-track')).toHaveCSS('height',ruler+'px');
  await context.close();
 });
