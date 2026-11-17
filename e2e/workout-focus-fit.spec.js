import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

// Heights are visible browser viewports (browser UI already subtracted), not device screen sizes.
const PAIR=['Single-arm incline dumbbell chest press','Chest-supported dumbbell row'];
async function open(browser,{width,height,history=false,previousNote=true,tags=null,paired=false}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,baseURL:'http://127.0.0.1:3199'}),page=await context.newPage();
 await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Fit');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const make=()=>createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});
 if(history){
  const past=make(),start=new Date(Date.now()-86400000);past.status='finished';past.startedAt=start.toISOString();past.finishedAt=new Date(start.getTime()+3600000).toISOString();
  if(previousNote)past.exercises[0].note='Brace hard, slow eccentric, pause at the bottom of every rep.';
  for(const ex of past.exercises)for(const set of ex.sets)Object.assign(set,{weightKg:62.5,reps:10,done:true});
  const r=await page.request.put('/api/workouts/'+past.id,{headers,data:{revision:0,log:past}});expect(r.ok(),await r.text()).toBeTruthy();
 }
 const log=make();
 // A representative pair: wrapped names, one tag row on A1 and the ordinary Last time/Best from the history log.
 if(paired){Object.assign(log.exercises[0],{name:PAIR[0],superset:{restBetweenSeconds:30,restAfterRoundSeconds:90},brand:'Hammer',focusTags:['Upper chest','Stretch']});log.exercises[1].name=PAIR[1];}
 if(tags)Object.assign(log.exercises[0],tags);const r=await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}});expect(r.ok(),await r.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);await expect(page.locator('.workout-focus')).toBeVisible();
 return {page,context};
}
const fits=(page,i=0)=>page.evaluate(i=>{const f=document.querySelector('.focus-feed'),card=f.querySelectorAll('.focus-card')[i],done=card.querySelector('.log-done');
 const fb=f.getBoundingClientRect(),cb=card.getBoundingClientRect(),db=done.getBoundingClientRect();
 return {doneInside:db.top>=fb.top-0.5&&db.bottom<=fb.bottom+0.5,preview:Math.round(fb.bottom-cb.bottom),overflowX:document.documentElement.scrollWidth>innerWidth};},i);

// Visible pixels, at rest, of everything after the viewed page: later sets of its group, later groups (their name rows), rounds and the review.
const leak=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),viewed=f.querySelector('.focus-card.is-viewed'),at=viewed?viewed.closest('.focus-round')??viewed:f.querySelector('.focus-review');
 const later=[...f.querySelectorAll('.focus-card,.focus-feed>li')].filter(el=>(at.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&!at.contains(el)&&!el.contains(at));
 return Math.max(0,...later.map(el=>{const b=el.getBoundingClientRect();return Math.min(fb.bottom,b.bottom)-Math.max(fb.top,b.top);}));});
const cardFit=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),card=f.querySelector('.focus-card');return {cardH:card.getBoundingClientRect().height,feedH:f.getBoundingClientRect().height};});
for(const [width,height] of [[360,660],[390,664],[393,659],[412,660],[412,760],[412,839],[412,850],[393,750],[440,770],[390,844],[430,932]])
 test(`whole card fits with no peek at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false});
  await expect(page.locator('.focus-feed .focus-group').first().locator('.log-best')).toBeVisible();
  await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
  expect(await leak(page)).toBeLessThanOrEqual(0.5);
  await context.close();
 });
test('card with Last time, previous note and Best still fits at 412x760',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:760,history:true});
 await expect(page.locator('.focus-feed .focus-group').first().locator('.log-last-note')).toBeVisible();
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 expect((await fits(page)).preview).toBeGreaterThanOrEqual(0);
 await context.close();
});
async function enlarged(browser,options={}){
 const opened=await open(browser,{width:390,height:664,...options});
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
 const pinned=()=>page.evaluate(()=>[...document.querySelectorAll('.focus-feed .focus-card')].filter(r=>getComputedStyle(r.querySelector('.focus-complete')).position==='sticky').map(r=>r.dataset.setId));
 await expect.poll(async()=>(await pinned()).length).toBe(1);
 expect((await pinned())[0]).toBe(await page.locator('.focus-feed .focus-card').first().getAttribute('data-set-id'));
 await context.close();
});
test('a focused reps input is not hidden under the pinned Complete',async({browser})=>{
 const {page,context}=await enlarged(browser);
 const card=page.locator('.focus-feed .focus-card').first(),reps=card.locator('[data-field="reps"]');await reps.focus();
 await expect.poll(async()=>{const [i,c]=await Promise.all([reps.boundingBox(),card.locator('.focus-complete').boundingBox()]);return i.y+i.height<=c.y+1;}).toBe(true);
 await context.close();
});
test('opening the keyboard keeps the focused reps input above the pinned Complete',async({browser})=>{
 const {page,context}=await open(browser,{width:390,height:664});
 const card=page.locator('.focus-feed .focus-card').first(),reps=card.locator('[data-field="reps"]');await reps.click();
 await page.setViewportSize({width:390,height:380});
 await expect.poll(async()=>{const [i,c,f]=await Promise.all([reps.boundingBox(),card.locator('.focus-complete').boundingBox(),page.locator('.focus-feed').boundingBox()]);return i.y>=f.y-1&&i.y+i.height<=Math.min(c.y,f.y+f.height)+1;}).toBe(true);
 await expect(reps).toBeFocused();
 await context.close();
});
const toSet=(page,i)=>page.locator('.focus-feed').evaluate((f,i)=>{const r=f.querySelectorAll('.focus-card')[i];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});},i);
// The input's top against the pinned block's bottom: the details, or the name row alone under the fallback.
const clearOfPin=(page,input)=>input.evaluate(el=>{const g=el.closest('.focus-group'),pin=g.querySelector(g.classList.contains('is-name-only')?'.focus-group-name':'.focus-group-details');return el.getBoundingClientRect().top-pin.getBoundingClientRect().bottom;});
test('200% text pins only the name row and keeps Complete reachable at the second set',async({browser})=>{
 const {page,context}=await enlarged(browser);await toSet(page,1);
 await expect(page.locator('.focus-feed .focus-group').first()).toHaveClass(/is-name-only/);
 await expect.poll(async()=>(await fits(page,1)).doneInside).toBe(true);
 await context.close();
});
// Set 1 of a name-only group snaps under the whole block; when the details are taller than the feed, its Complete is reached by scrolling within the set.
test('200% text with tall details lets the user scroll to set 1 Complete and back to the details',async({browser})=>{
 const {page,context}=await enlarged(browser,{history:true,tags:{...oneLine,note:'Keep the elbows tucked, pause one second at the bottom. '.repeat(5).trim()}});
 const feed=page.locator('.focus-feed'),group=feed.locator('.focus-group').first();await expect(group.locator('.log-best')).toBeVisible();await expect(group).toHaveClass(/is-name-only/);
 await toSet(page,0);
 const read=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),row=f.querySelector('.focus-card'),d=row.querySelector('.log-done').getBoundingClientRect(),g=row.closest('.focus-group'),det=g.querySelector('.focus-group-details').getBoundingClientRect(),name=g.querySelector('.focus-group-name').getBoundingClientRect();
  return {doneInside:d.top>=fb.top-.5&&d.bottom<=fb.bottom+.5,detailsTop:Math.round(det.top-name.bottom),viewed:row.classList.contains('is-viewed'),scrollTop:f.scrollTop};});
 let r=await read();expect(r.doneInside,JSON.stringify(r)).toBe(false); // the scenario: set 1 starts below the fold
 const box=await feed.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<20&&!(r=await read()).doneInside;i++){await page.mouse.wheel(0,60);await page.waitForTimeout(250);}
 await page.waitForTimeout(600);r=await read();
 expect(r.doneInside,JSON.stringify(r)).toBe(true);expect(r.viewed,JSON.stringify(r)).toBe(true);
 for(let i=0;i<20&&Math.abs((r=await read()).detailsTop)>1;i++){await page.mouse.wheel(0,-60);await page.waitForTimeout(250);}
 await page.waitForTimeout(600);r=await read();expect(Math.abs(r.detailsTop),JSON.stringify(r)).toBeLessThanOrEqual(1); // the details start right under the name row again
 await context.close();
});
// The feed never drops below 180px, so only enlarged text makes the Complete margin push the input under the name row; the top edge wins.
test('opening the keyboard at the second set at 200% text keeps the reps input clear of the pinned block',async({browser})=>{
 const {page,context}=await enlarged(browser);await toSet(page,1);
 const reps=page.locator('.focus-feed .focus-card').nth(1).locator('[data-field="reps"]');await reps.click();
 await page.setViewportSize({width:390,height:380});
 await expect.poll(()=>clearOfPin(page,reps)).toBeGreaterThanOrEqual(-1);
 await expect(reps).toBeFocused();
 await context.close();
});
// Vertical gaps between consecutive set page sections, top to bottom; the last one runs to the card's separator. The block keeps a fixed gap under the history.
const rhythm=page=>page.evaluate(()=>{const card=document.querySelector('.focus-feed .focus-card'),group=card.closest('.focus-group'),box=s=>(card.querySelector(s)||group.querySelector(s)).getBoundingClientRect(),R=Math.round;
 const [details,hist,ctx,ctl,rir,done]=['.focus-group-details','.focus-history','.focus-context','.focus-number-controls','.focus-rir-strip','.log-done'].map(box);
 return {ctxToControls:R(ctl.top-ctx.bottom),controlsToRir:R(rir.top-ctl.bottom),rirToDone:R(done.top-rir.bottom),doneToEnd:R(card.getBoundingClientRect().bottom-1-done.bottom),historyToEdge:R(details.bottom-1-hist.bottom)};});
for(const [width,height] of [[360,660],[390,664],[393,659],[393,750],[412,660],[412,760],[412,839],[412,850],[440,770],[390,844],[430,932]])
 test(`consistent rhythm at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false});
  await expect(page.locator('.focus-feed .focus-group').first().locator('.log-best')).toBeVisible();
  const r=await rhythm(page),g=Object.values(r),page4=g.slice(0,4);
  expect(Math.min(...g),JSON.stringify(r)).toBeGreaterThanOrEqual(6);
  expect(Math.max(...page4)-Math.min(...page4),JSON.stringify(r)).toBeLessThanOrEqual(16);
  expect(r.historyToEdge,JSON.stringify(r)).toBeLessThanOrEqual(20);
  expect(r.rirToDone,JSON.stringify(r)).toBeGreaterThanOrEqual(r.controlsToRir);
  await context.close();
 });
test('feeds of 560px and taller use the large inputs',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:839});
 expect(await page.locator('.focus-feed').evaluate(f=>f.clientHeight)).toBeGreaterThanOrEqual(560);
 await expect(page.locator('.focus-feed .focus-card').first().locator('[data-field="reps"]')).toHaveCSS('font-size','52px');
 await context.close();
});
test('the help row and kg-steps select are gone',async({browser})=>{
 const {page,context}=await open(browser,{width:412,height:839});
 await expect(page.locator('.focus-input-help')).toHaveCount(0);await expect(page.locator('.focus-increment')).toHaveCount(0);
 await context.close();
});
test('an out-of-target caption still fits at 360x660',async({browser})=>{
 const {page,context}=await open(browser,{width:360,height:660,history:true,previousNote:false});
 const card=page.locator('.focus-feed .focus-card').first(),reps=card.locator('[data-field="reps"]');
 await reps.fill('2');await expect(card.locator('.focus-control-label.is-outside')).toContainText('below');
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 await context.close();
});
for(const [width,height,ruler] of [[412,839,56],[412,760,48],[360,660,44]])
 test(`rulers are ${ruler}px tall at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height});
  const strip=page.locator('.focus-feed .focus-card').first().locator('.workout-ruler').first();
  await expect(strip).toHaveCSS('height',ruler+'px');await expect(strip.locator('.workout-ruler-track')).toHaveCSS('height',ruler+'px');
  await context.close();
 });
const long='L'.repeat(80),oneLine={brand:'Hammer',focusTags:['Upper chest','Stretch']},twoLines={brand:'Hammer Strength',focusTags:[long,'Upper chest','Stretch','Lower chest','Mid chest','Long head','Short head']};
test('one line of tags fits at 360x660',async({browser})=>{
 const {page,context}=await open(browser,{width:360,height:660,history:true,previousNote:false,tags:oneLine});
 await expect(page.locator('.focus-feed .focus-group').first().locator('.focus-tags')).toBeVisible();
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 const p=await cardFit(page);expect(p.cardH,JSON.stringify(p)).toBeLessThanOrEqual(p.feedH+1);expect(await leak(page)).toBeLessThanOrEqual(0.5);
 await context.close();
});
test('two lines of tags still fit, then pin Complete',async({browser})=>{
 // Hidden nested tabs reclaim 56px; keep the same constrained-height scenario.
 let o=await open(browser,{width:393,height:694,history:true,previousNote:false,tags:twoLines});
 await expect(o.page.locator('.focus-feed .focus-group').first().locator('.focus-tags')).toBeVisible();
 await expect.poll(async()=>(await fits(o.page)).doneInside).toBe(true);
 const p=await cardFit(o.page);expect(p.cardH,JSON.stringify(p)).toBeLessThanOrEqual(p.feedH+1);await o.context.close();
 o=await open(browser,{width:360,height:660,history:true,previousNote:false,tags:twoLines});
 const {page,context}=o;await expect(page.locator('.focus-feed .focus-group').first().locator('.focus-tags')).toBeVisible();
 await expect.poll(()=>fits(page)).toMatchObject({doneInside:true,overflowX:false});
 const tags=await page.locator('.focus-feed .focus-group').first().evaluate(group=>{const l=group.querySelector('.focus-tags'),long=[...l.children].find(li=>li.textContent.includes('LLLL'));return {h:l.getBoundingClientRect().height,clipped:long.scrollWidth>long.clientWidth};});
 expect(tags.h).toBeLessThanOrEqual(44);expect(tags.clipped).toBe(true);
 await context.close();
});
// At an exercise boundary nothing of the next group shows at rest: neither its name row nor its details.
for(const [width,height] of [[390,844],[412,760]])
 test(`the last set of an exercise shows nothing of the next one at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false});
  await expect(page.locator('.focus-feed .focus-group').first().locator('.log-best')).toBeVisible();
  await page.locator('.focus-feed').evaluate(f=>{const r=f.querySelectorAll('.focus-card')[2];f.scrollTo({top:r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0),behavior:'instant'});});
  const read=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),r=f.querySelectorAll('.focus-card')[2],next=f.querySelectorAll('.focus-group')[1];
   const visible=el=>{const b=el.getBoundingClientRect();return Math.max(0,Math.min(fb.bottom,b.bottom)-Math.max(fb.top,b.top));};
   return {anchored:Math.abs(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)-f.scrollTop)<2,namePx:visible(next.querySelector('.focus-group-name')),detailsPx:visible(next.querySelector('.focus-group-details'))};});
  await expect.poll(async()=>(await read()).anchored).toBe(true);
  const p=await read();expect(p.namePx,JSON.stringify(p)).toBeLessThanOrEqual(0.5);expect(p.detailsPx,JSON.stringify(p)).toBeLessThanOrEqual(0.5);
  await expect.poll(()=>leak(page)).toBeLessThanOrEqual(0.5);
  await context.close();
 });
// Superset rounds: the viewed round's selected inputs, RIR and Complete, measured against the feed.
const roundFit=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),card=f.querySelector('.focus-card.is-viewed'),round=card.closest('.focus-round'),rb=round.getBoundingClientRect();
 const inside=el=>{const b=el.getBoundingClientRect();return b.top>=fb.top-.5&&b.bottom<=fb.bottom+.5;};
 return {inputs:[...card.querySelectorAll('[data-field="weight"],[data-field="reps"]')].every(inside),rir:inside(card.querySelector('.focus-rir-strip')),done:inside(card.querySelector('.log-done')),
  // Not oversized: otherwise the sticky Complete covers the RIR row even though both lie inside the feed.
  whole:rb.height<=fb.height+1,top:Math.round(rb.top-fb.top),height:rb.height,scrollTop:f.scrollTop,compact:round.classList.contains('is-compact'),overflowX:document.documentElement.scrollWidth>innerWidth};});
const layoutMotion=page=>page.evaluate(()=>document.getAnimations().filter(a=>a.effect.getKeyframes().some(k=>['height','minHeight','top','marginTop','paddingTop'].some(p=>p in k))).length);
for(const [width,height] of [[360,660],[390,660],[360,740],[390,740],[360,844],[390,844],[390,664],[393,659],[412,660],[412,760],[412,839],[412,850],[393,750],[440,770],[430,932]])
 test(`a superset round shows its selected set through Complete with no peek at ${width}x${height}`,async({browser})=>{
  const {page,context}=await open(browser,{width,height,history:true,previousNote:false,paired:true});await page.emulateMedia({reducedMotion:'no-preference'});
  const round=page.locator('.focus-feed .focus-round').first();await expect(round.locator('.focus-pair-pane:not(.is-inactive) .log-best')).toBeVisible();
  await expect.poll(()=>roundFit(page)).toMatchObject({inputs:true,rir:true,done:true,whole:true,top:0,overflowX:false});
  expect(await leak(page)).toBeLessThanOrEqual(0.5);
  // Selecting the shorter partner, then the taller one, never moves the page or its bounds.
  const partners=round.locator('.focus-partner'),a=await roundFit(page);
  await partners.nth(1).click();const b=await roundFit(page);expect(await layoutMotion(page)).toBe(0);
  await partners.nth(0).click();const c=await roundFit(page);expect(await layoutMotion(page)).toBe(0);
  for(const r of [b,c]){const d={scroll:r.scrollTop-a.scrollTop,height:r.height-a.height,top:r.top-a.top};for(const v of Object.values(d))expect(Math.abs(v),JSON.stringify({a,r})).toBeLessThanOrEqual(1);}
  await expect.poll(()=>roundFit(page)).toMatchObject({inputs:true,rir:true,done:true});
  await context.close();
 });
test('a crowded round names the exercise in its selector and moves the same note action into the round context and back',async({browser})=>{
 // A tall feed holds the full round; a 660px phone needs the compact one.
 const {page,context}=await open(browser,{width:390,height:1100,history:true,previousNote:false,paired:true});
 const round=page.locator('.focus-feed .focus-round').first(),pane=round.locator('.focus-pair-pane:not(.is-inactive)');await expect(pane.locator('.log-best')).toBeVisible();
 await expect(round).not.toHaveClass(/is-compact/);
 await page.evaluate(()=>{const pane=document.querySelector('.focus-round .focus-pair-pane:not(.is-inactive)');window.noteAction=pane.querySelector('.focus-exercise-note');window.setNote=pane.querySelector('.focus-card .focus-set-note');window.otherSetNote=document.querySelector('.focus-round .focus-pair-pane.is-inactive .focus-card .focus-set-note');});
 expect(await page.evaluate(()=>Boolean(noteAction.closest('.focus-pair-pane .focus-group-name')))).toBe(true);
 await page.setViewportSize({width:360,height:660});
 await expect(round).toHaveClass(/is-compact/);
 expect(await page.evaluate(()=>[noteAction.isConnected,noteAction.parentElement.classList.contains('focus-round-context'),setNote.parentElement.classList.contains('focus-round-context'),noteAction.nextElementSibling===setNote])).toEqual([true,true,true,true]);
 // A partner switch hands the context to the newly selected exercise's and set's own note actions.
 await round.locator('.focus-partner').nth(1).click();
 expect(await page.evaluate(()=>[setNote.closest('.focus-context')!==null,otherSetNote.parentElement.classList.contains('focus-round-context'),Boolean(noteAction.closest('.focus-group-name'))])).toEqual([true,true,true]);
 await round.locator('.focus-partner').nth(0).click();
 expect(await page.evaluate(()=>[setNote.parentElement.classList.contains('focus-round-context'),otherSetNote.closest('.focus-context')!==null])).toEqual([true,true]);
 await expect(round.locator('.focus-round-context').getByRole('button',{name:'Add exercise note, '+PAIR[0],exact:true})).toBeVisible();
 // The selected selector is the visible name; the large title stays one semantic heading, visually hidden.
 await expect(round.locator('.focus-partner[aria-current=step] .focus-partner-name')).toContainText(PAIR[0]);
 await expect(round.getByRole('heading',{name:PAIR[0],exact:true})).toHaveCount(1);
 expect(await pane.locator('.focus-group-name').evaluate(el=>getComputedStyle(el).clipPath)).toBe('inset(50%)');
 await expect.poll(()=>roundFit(page)).toMatchObject({inputs:true,rir:true,done:true,top:0,compact:true});
 // The note action still opens the selected exercise's note.
 await expect(round.locator('.focus-round-context').getByRole('button',{name:/^Add set note, Set 1, /})).toBeVisible();
 await round.locator('.focus-round-context .focus-exercise-note').click();const note=page.getByRole('textbox',{name:'Note, '+PAIR[0],exact:true});await expect(note).toBeFocused();
 await note.blur();await expect(note).toHaveCount(0);
 await page.setViewportSize({width:390,height:1100});
 await expect(round).not.toHaveClass(/is-compact/);
 expect(await page.evaluate(()=>[noteAction.isConnected,Boolean(noteAction.closest('.focus-pair-pane:not(.is-inactive) .focus-group-name')),setNote.parentElement.classList.contains('focus-context')])).toEqual([true,true,true]);
 expect(await pane.locator('.focus-group-name').evaluate(el=>getComputedStyle(el).clipPath)).toBe('none');
 await context.close();
});
test('an oversized round scrolls natively to Complete and back to its selectors, without an obsolete pin',async({browser})=>{
 const {page,context}=await enlarged(browser,{history:true,previousNote:false,paired:true,tags:{note:'Keep the elbows tucked, pause one second at the bottom. '.repeat(5).trim()}});
 const feed=page.locator('.focus-feed'),round=feed.locator('.focus-round').first();await expect(round.locator('.focus-pair-pane:not(.is-inactive) .log-best')).toBeVisible();
 const read=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),fb=f.getBoundingClientRect(),card=f.querySelector('.focus-card.is-viewed'),round=card.closest('.focus-round'),d=card.querySelector('.log-done').getBoundingClientRect(),p=round.querySelector('.focus-partners').getBoundingClientRect();
  return {doneInside:d.top>=fb.top-.5&&d.bottom<=fb.bottom+.5,partnersTop:Math.round(p.top-fb.top),oversized:round.getBoundingClientRect().height>fb.height+1,set:card.dataset.setId,
   sticky:[...f.querySelectorAll('.focus-card')].filter(r=>getComputedStyle(r.querySelector('.focus-complete')).position==='sticky').map(r=>r.dataset.setId)};});
 let r=await read();expect(r.oversized,JSON.stringify(r)).toBe(true);expect(r.sticky,JSON.stringify(r)).toEqual([r.set]);
 const set=r.set,box=await feed.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<30&&!(r=await read()).doneInside;i++){await page.mouse.wheel(0,60);await page.waitForTimeout(200);}
 await page.waitForTimeout(600);r=await read();expect(r.doneInside,JSON.stringify(r)).toBe(true);expect(r.set,JSON.stringify(r)).toBe(set);
 for(let i=0;i<30&&(r=await read()).partnersTop<0;i++){await page.mouse.wheel(0,-60);await page.waitForTimeout(200);}
 await page.waitForTimeout(600);r=await read();expect(r.partnersTop,JSON.stringify(r)).toBeGreaterThanOrEqual(0);expect(r.set,JSON.stringify(r)).toBe(set);
 // Focused pair controls keep the 64px Complete clearance and reserve no straight-exercise pin.
 const reps=round.locator('.focus-pair-pane:not(.is-inactive) [data-field="reps"]');await reps.focus();
 expect(await reps.evaluate(el=>[getComputedStyle(el).scrollMarginTop,getComputedStyle(el).scrollMarginBottom])).toEqual(['0px','64px']);
 // The keyboard shrinks the feed: the field stays above Complete, or at the feed's top edge when both cannot fit.
 await page.setViewportSize({width:390,height:380});
 await expect.poll(async()=>{const [i,c,f]=await Promise.all([reps.boundingBox(),round.locator('.focus-card.is-viewed .focus-complete').boundingBox(),feed.boundingBox()]);return i.y>=f.y-1&&(i.y+i.height<=c.y+1||i.y<=f.y+1);}).toBe(true);
 await expect(reps).toBeFocused();
 await context.close();
});
