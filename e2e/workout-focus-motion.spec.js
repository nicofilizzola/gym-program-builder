import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});
async function prepare(page,clock=true){if(clock)await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});}
test('only explicit completion animates keyed progress then advances to context',async({page})=>{
 await prepare(page,false);await expect(page.locator('.is-celebrating')).toHaveCount(0);await page.evaluate(()=>{logger.setBestPerformance({});logger.setStatus('Saved');});await expect(page.locator('.is-celebrating')).toHaveCount(0);
 await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.focus-progress-segment.is-celebrating')).toHaveCount(1);
 await expect.poll(()=>page.locator('.focus-progress-segment.is-celebrating .focus-progress-fill').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m11)).toBeGreaterThan(0);const scale=await page.locator('.focus-progress-segment.is-celebrating .focus-progress-fill').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m11);expect(scale).toBeLessThan(1);
 await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
});
test('note opening cancels auto-next and undo recheck does not replay celebration',async({page})=>{
 // Paused: real time spent performing the click must not reach the 650ms advance.
 await prepare(page);await page.clock.pauseAt(new Date(Date.now()+60000));const card=page.locator('.focus-card[data-set-id="s1"]');await card.locator('.log-done').click();await page.clock.runFor(600);await card.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true}).click();await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
 await page.evaluate(async()=>{await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});});await expect(page.locator('.is-celebrating')).toHaveCount(0);
});
test('warmup completion advances without filling working progress',async({page})=>{
 await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>{focusView.jump({exerciseId:'straight',setId:'sw'});port.command({type:'patch',ref:{exerciseId:'straight',setId:'sw'},patch:{reps:5}});});await page.locator('.focus-card[data-set-id="sw"] .log-done').click();await expect(page.locator('.focus-progress-segment.is-done')).toHaveCount(0);await page.clock.runFor(650);await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});
test('reduced motion is instant and browsing old sets never advances',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await page.locator('.focus-card[data-set-id="s1"] .log-done').click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});await expect(page.locator('.is-celebrating')).toHaveCount(0);
 await page.evaluate(()=>{focusView.jump({exerciseId:'straight',setId:'s1'});port.command({type:'patch',ref:{exerciseId:'straight',setId:'s1'},patch:{reps:9}});});expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});
test('smooth auto-next settles on the destination without changing the viewed ID',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[0].done=true;l.exercises[0].sets[0].reps=8;logger.setLog(l);focusView.jump({exerciseId:'straight',setId:'s1'});});
 await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
 await expect.poll(()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),r=document.querySelector('.focus-card[data-set-id="s2"]');return {gap:Math.round(f.scrollTop-(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0))),viewed:focusView.visibleRef(),heights:[...f.children].map(n=>n.offsetHeight)};})).toMatchObject({gap:0,viewed:{exerciseId:'straight',setId:'s2'}});
});
test('a missing-partner round earns round feedback and advances forward past earlier holes',async({page})=>{
 await page.clock.install();await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));const card=page.locator('.focus-card[data-set-id="a2"]');await card.locator('.log-done').click();await expect(card.locator('.focus-feedback')).toHaveText('Round 2 complete. Strong work.');await page.clock.runFor(1000);
 // Nothing unfinished follows round 2, so the review card; the open straight, warm-up and round-1 sets stay as they were.
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef())).toBe(null);
 expect(await page.evaluate(()=>port.read().log.exercises.flatMap(e=>e.sets).filter(s=>s.done).map(s=>s.id))).toEqual(['a2']);
});
test('undo burst cancels advancement and delayed history stays inert',async({page})=>{
 await prepare(page);await page.evaluate(async()=>{await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});await port.command({type:'toggle',ref:{exerciseId:'straight',setId:'s1'}});logger.setBestPerformance({});logger.setStatus('Saved');});await page.clock.runFor(1200);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});await expect(page.locator('.is-celebrating')).toHaveCount(0);
});
test('virtual ruler activation keeps every card height stable',async({page})=>{
 await mountFocusFixture(page);const heights=()=>page.locator('.focus-card').evaluateAll(nodes=>nodes.map(n=>n.offsetHeight));const before=await heights();await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));expect(await heights()).toEqual(before);
});
test('presentation switches stop animation and pending advancement',async({page})=>{
 await prepare(page);await page.locator('.focus-card[data-set-id="s1"] .log-done').click();await expect(page.locator('.is-celebrating')).toHaveCount(2);expect(await page.evaluate(()=>{focusView.setEnabled(false);focusView.setEnabled(true);return document.querySelectorAll('.is-celebrating').length;})).toBe(0);await page.clock.runFor(1000);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s1'});
});

// Travel: a page-side listener, added after mount, samples every scroll with the viewed set at that moment.
// A superset partner's page is its round.
const snapTop=(page,id)=>page.evaluate(id=>{const c=id&&document.querySelector(`.focus-card[data-set-id="${id}"]`),r=id?c.closest('.focus-round')??c:document.querySelector('.focus-review');return r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0);},id);
const record=page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed');window.samples=[];window.firstSample=new Promise(r=>f.addEventListener('scroll',r,{once:true}));f.addEventListener('scroll',()=>samples.push({top:f.scrollTop,viewed:focusView.visibleRef()?.setId??null}));return f.scrollTop;});
async function travelled(page,from,to){
 await expect.poll(()=>page.evaluate(()=>focusView.visibleRef()?.setId)).toBe(to);
 const end=await snapTop(page,to),{top,samples}=await page.evaluate(()=>({top:document.querySelector('.focus-feed').scrollTop,samples}));
 expect(Math.abs(top-end)).toBeLessThanOrEqual(1);
 const lo=Math.min(from,end)+1,hi=Math.max(from,end)-1;expect(samples.filter(s=>s.top>lo&&s.top<hi).length).toBeGreaterThanOrEqual(3);
 return {end,samples};
}
test('an overview chip travels through the sets in between',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(async()=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');window.overview=mountWorkoutOverview({port,onJump:ref=>focusView.jump(ref,{animate:true,focus:true}),onActivity:v=>focusView.suspend(v),onClose:()=>focusView.update(port.read())});focusView.jump({exerciseId:'straight',setId:'sw'});});
 const from=await record(page);await page.evaluate(()=>{overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));});
 await page.getByRole('dialog',{name:'Workout overview'}).getByRole('button',{name:'Working set 1, Single-arm incline dumbbell chest press',exact:true}).click();
 const {end,samples}=await travelled(page,from,'a1');for(const s of samples)if(Math.abs(s.top-end)>1)expect(s.viewed).toBe('sw');
 await expect(page.locator('.focus-card[data-set-id="a1"] .focus-context-text')).toBeFocused();
});
test('Back to current travels too',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>{const l=port.read().log;for(const s of l.exercises[0].sets.slice(0,2))Object.assign(s,{done:true,reps:8});logger.setLog(l);focusView.jump({exerciseId:'a',setId:'a2'});});
 const from=await record(page);await page.getByRole('button',{name:'Back to current',exact:true}).click();await travelled(page,from,'s2');
 await expect(page.locator('.focus-card[data-set-id="s2"] .focus-context-text')).toBeFocused();
});
test('a touch during travel stops at a set',async({page})=>{
 await mountFocusFixture(page);await record(page);
 await page.evaluate(()=>{const f=document.querySelector('.focus-feed');firstSample.then(()=>f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));focusView.jump({exerciseId:'a',setId:'a2'},{animate:true});});
 const settled=()=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),ref=focusView.visibleRef(),r=ref?document.querySelector(`.focus-card[data-set-id="${ref.setId}"]`):document.querySelector('.focus-review');return Math.abs(f.scrollTop-(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)))<=1;});
 await expect.poll(settled).toBe(true);await page.waitForTimeout(300);expect(await settled()).toBe(true);expect(await page.evaluate(()=>focusView.visibleRef()?.setId)).not.toBe('a2');
});
test('an interrupted travel never sticks',async({page})=>{
 await mountFocusFixture(page);const scrollTo=async id=>{const top=await snapTop(page,id);await page.evaluate(top=>document.querySelector('.focus-feed').scrollTo({top,behavior:'instant'}),top);};
 await record(page);await page.evaluate(async()=>{focusView.jump({exerciseId:'a',setId:'a2'},{animate:true});await firstSample;focusView.suspend(true);focusView.suspend(false);});
 await scrollTo('s2');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef()?.setId)).toBe('s2');
 await record(page);await page.evaluate(async()=>{focusView.jump({exerciseId:'a',setId:'a2'},{animate:true});await firstSample;await port.command({type:'remove-set',ref:{exerciseId:'a',setId:'a2'}});});
 await scrollTo('s1');await expect.poll(()=>page.evaluate(()=>focusView.visibleRef()?.setId)).toBe('s1');
});
test('reduced motion jumps at once',async({page})=>{
 await mountFocusFixture(page);await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.evaluate(()=>{focusView.jump({exerciseId:'a',setId:'a2'},{animate:true});const f=document.querySelector('.focus-feed'),r=document.querySelector('.focus-card[data-set-id="a2"]').closest('.focus-round');return {gap:Math.abs(f.scrollTop-(r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)))<=1,viewed:focusView.visibleRef()?.setId};})).toEqual({gap:true,viewed:'a2'});
});

// Superset rounds: either partner first; the first completion switches in place, the round's completion travels after 650ms.
const R={a1:{exerciseId:'a',setId:'a1'},b1:{exerciseId:'b',setId:'b1'},a2:{exerciseId:'a',setId:'a2'}};
async function round(page,first,clock=true){
 if(clock)await page.clock.install();await mountFocusFixture(page);
 await page.evaluate(async first=>{for(const [exerciseId,setId] of [['a','a1'],['b','b1']])await port.command({type:'patch',ref:{exerciseId,setId},patch:{reps:8}});focusView.jump(first);},first);
 if(clock)await page.clock.pauseAt(new Date(Date.now()+60000));
}
const viewedRef=page=>page.evaluate(()=>focusView.visibleRef());
const feedTop=page=>page.evaluate(()=>document.querySelector('.focus-feed').scrollTop);
const doneIds=page=>page.evaluate(()=>port.read().log.exercises.flatMap(e=>e.sets).filter(s=>s.done).map(s=>s.id));
for(const [first,second] of [['a1','b1'],['b1','a1']])test(`round ${first} first: logs one member and switches in place, then travels after the round`,async({page})=>{
 await round(page,R[first]);const top=await feedTop(page);
 await page.locator(`.focus-card[data-set-id="${first}"] .log-done`).click();
 expect(await viewedRef(page)).toEqual(R[second]);expect(await feedTop(page)).toBe(top);expect(await doneIds(page)).toEqual([first]);
 await expect(page.locator('.focus-progress-meta')).toContainText('1 / 5 working sets');
 await expect(page.locator(`.focus-card[data-set-id="${second}"] .focus-context-text`)).toBeFocused();
 await page.clock.runFor(1000);expect(await viewedRef(page)).toEqual(R[second]);expect(await feedTop(page)).toBe(top);
 await page.locator(`.focus-card[data-set-id="${second}"] .log-done`).click();
 await page.clock.runFor(649);expect(await viewedRef(page)).toEqual(R[second]);expect(await feedTop(page)).toBe(top);
 await page.clock.runFor(1);await expect(page.locator('.focus-card[data-set-id="a2"] .focus-context-text')).toBeFocused();
 await page.clock.resume();await expect.poll(()=>viewedRef(page)).toEqual(R.a2);
});
for(const how of ['pointer','key','wheel','input','note','dialog','resize','hidden','preference','undo','conflict','removal','destroy'])test(`a pending round advance cancels at 649ms (${how})`,async({page})=>{
 await round(page,R.a1);await page.locator('.focus-card[data-set-id="a1"] .log-done').click();await page.locator('.focus-card[data-set-id="b1"] .log-done').click();await page.clock.runFor(649);
 const b1=page.locator('.focus-card[data-set-id="b1"]');
 if(how==='key')await page.keyboard.press('Shift');
 if(how==='input')await b1.locator('[data-field="weight"]').fill('80');
 if(how==='note')await b1.getByRole('button',{name:'Add set note, Set 1, Chest-supported row',exact:true}).click();
 if(how==='preference'){const auto=page.getByLabel('Auto-next',{exact:true});await auto.uncheck();await auto.check();}
 await page.evaluate(async how=>{const f=document.querySelector('.focus-feed');
  if(how==='pointer')f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  if(how==='wheel')f.dispatchEvent(new WheelEvent('wheel',{deltaY:1,bubbles:true}));
  if(how==='dialog'){focusView.suspend(true);focusView.suspend(false);}
  if(how==='resize')dispatchEvent(new Event('resize'));
  if(how==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;}
  if(how==='undo')await port.command({type:'toggle',ref:{exerciseId:'a',setId:'a1'}});
  // A conflict restoring a version where A1 is open: no edit event, so only the firing-time check can stop it.
  if(how==='conflict'){const l=port.read().log;l.exercises[1].sets.find(s=>s.id==='a1').done=false;logger.setLog(l);}
  if(how==='removal')await port.command({type:'remove-set',ref:{exerciseId:'a',setId:'a2'}});
  if(how==='destroy')focusView.destroy();
 },how);
 const top=how==='destroy'?null:await feedTop(page);await page.clock.runFor(1000);
 expect(await viewedRef(page)).toEqual(R.b1);if(top!==null)expect(await feedTop(page)).toBe(top);
});
test('reduced motion switches partners and advances rounds at once',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await round(page,R.b1,false);
 await page.locator('.focus-card[data-set-id="b1"] .log-done').click();expect(await viewedRef(page)).toEqual(R.a1);
 await page.locator('.focus-card[data-set-id="a1"] .log-done').click();expect(await viewedRef(page)).toEqual(R.a2);
});
test('a rewarded set does not flourish again after undo and redo',async({page})=>{
 await round(page,R.a1,false);await page.getByLabel('Auto-next',{exact:true}).uncheck();const done=page.locator('.focus-card[data-set-id="a1"] .log-done');
 await done.click();await expect(page.locator('.is-celebrating')).toHaveCount(2);await expect(page.locator('.is-celebrating')).toHaveCount(0);
 await done.click();await done.click();await expect(page.locator('.focus-card[data-set-id="a1"]')).toHaveClass(/is-done/);await expect(page.locator('.is-celebrating')).toHaveCount(0);
});
