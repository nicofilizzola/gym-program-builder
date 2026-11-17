import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
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
 // The paused clock also freezes the 200ms partner entry; finish it as the elapsed second would, so the next click needs no scroll.
 await page.evaluate(()=>document.querySelectorAll('.focus-pair-pane,.focus-partner,.focus-partner-underline').forEach(n=>n.getAnimations().forEach(a=>a.finish())));
 await page.locator(`.focus-card[data-set-id="${second}"] .log-done`).click();
 await page.clock.runFor(649);expect(await viewedRef(page)).toEqual(R[second]);expect(await feedTop(page)).toBe(top);
 await page.clock.runFor(1);await expect(page.locator('.focus-card[data-set-id="a2"] .focus-context-text')).toBeFocused();
 await page.clock.resume();await expect.poll(()=>viewedRef(page)).toEqual(R.a2);
});
for(const how of ['pointer','key','body-key','wheel','input','note','dialog','resize','hidden','preference','undo','conflict','removal','destroy'])test(`a pending round advance cancels at 649ms (${how})`,async({page})=>{
 await round(page,R.a1);await page.locator('.focus-card[data-set-id="a1"] .log-done').click();await page.locator('.focus-card[data-set-id="b1"] .log-done').click();await page.clock.runFor(649);
 const b1=page.locator('.focus-card[data-set-id="b1"]');
 if(how==='key')await page.keyboard.press('Shift');
 // Focus outside Focus (body after a tap elsewhere) still cancels on a key.
 if(how==='body-key'){await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Shift');}
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
 if(!['removal','destroy'].includes(how))await expect(page.locator('.focus-card[data-set-id="a2"] .focus-context-text')).not.toBeFocused();
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

// Partner transitions (§4): one coordinated switch over the same pane/control nodes; latest selection wins.
const PAIR='.focus-pair-pane,.focus-partner,.focus-partner-check,.focus-partner-underline';
const pairMotion=page=>page.evaluate(sel=>[...document.querySelectorAll(sel)].flatMap(n=>n.getAnimations()).length,PAIR);
// Clicks a selector and reads the motion it started in the same task, so nothing has finished yet.
const switchTo=(page,index)=>page.evaluate(index=>{
 const round=document.querySelector('.focus-round'),buttons=round.querySelectorAll('.focus-partner'),boxes=()=>[round.querySelector('.focus-round-context'),...buttons].map(n=>JSON.stringify(n.getBoundingClientRect()));
 const before=boxes();buttons[index].click();
 const timing=a=>({duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing});
 const pane=round.querySelector('.focus-pair-pane:not(.is-inactive)'),[enter]=pane.getAnimations(),lines=round.querySelectorAll('.focus-partner-underline');
 return {anchored:boxes().every((b,i)=>b===before[i]),panes:[...round.querySelectorAll('.focus-pair-pane')].map(p=>({id:p.dataset.exerciseId,inert:p.inert,running:p.getAnimations().length})),
  enter:{...timing(enter),from:enter.effect.getKeyframes()[0]},
  lines:lines.length,lineHeight:lines[0].getBoundingClientRect().height,line:lines[0].getAnimations().map(timing),
  selectors:[...buttons].map(b=>b.getAnimations().map(timing))};
},index);
const EASE='cubic-bezier(0.22, 1, 0.36, 1)';
test('a partner switch slides details and controls in together while selectors stay anchored',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const forward=await switchTo(page,1);
 expect(forward).toMatchObject({anchored:true,lines:1,lineHeight:3,line:[{duration:200,easing:EASE}],enter:{duration:200,easing:EASE,from:{opacity:'0',transform:'translateX(12px)'}},selectors:[[{duration:180,easing:'ease-out'}],[{duration:180,easing:'ease-out'}]]});
 expect(forward.panes).toEqual([{id:'a',inert:true,running:0},{id:'b',inert:false,running:1}]);
 await expect.poll(()=>pairMotion(page)).toBe(0);
 const back=await switchTo(page,0);expect(back.enter.from).toMatchObject({opacity:'0',transform:'translateX(-12px)'});expect(back.anchored).toBe(true);
 // The selected selector carries the only underline, inside its 1px border on the bottom edge.
 await expect.poll(()=>pairMotion(page)).toBe(0);
 const line=await page.evaluate(()=>{const r=document.querySelector('.focus-round'),l=r.querySelector('.focus-partner-underline').getBoundingClientRect(),b=r.querySelector('.focus-partner[aria-current=step]').getBoundingClientRect();return [Math.round(l.left-b.left),Math.round(b.bottom-l.bottom),Math.round(b.right-l.right)];});
 expect(line).toEqual([1,1,1]);
});
test('manual selection keeps focus on the selector; completion and same-page jumps focus the context',async({page})=>{
 await round(page,R.a1,false);const group=page.locator('.focus-round').first().getByRole('group',{name:'Superset A partners'});
 await group.getByRole('button').nth(1).click();await expect(group.getByRole('button').nth(1)).toBeFocused();
 await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'},{animate:true,focus:true}));await expect(page.locator('.focus-card[data-set-id="a1"] .focus-context-text')).toBeFocused();
 // Playwright retries a click on a moving target with other scroll alignments, so let the entry finish first.
 await expect.poll(()=>pairMotion(page)).toBe(0);
 await page.locator('.focus-card[data-set-id="a1"] .log-done').click();await expect(page.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
 expect(await page.evaluate(()=>document.activeElement.matches('input'))).toBe(false);
});
test('rapid reversal leaves only the latest pane operable and nothing queued',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const mid=await page.evaluate(()=>{const round=document.querySelector('.focus-round'),b=round.querySelectorAll('.focus-partner');b[1].click();b[0].click();b[1].click();b[0].click();
  const panes=[...round.querySelectorAll('.focus-pair-pane')];return {panes:panes.map(p=>[p.inert,p.getAnimations().length]),line:document.querySelector('.focus-round .focus-partner-underline').getAnimations().length,viewed:focusView.visibleRef()};});
 expect(mid).toEqual({panes:[[false,1],[true,0]],line:1,viewed:{exerciseId:'a',setId:'a1'}});
 await page.waitForTimeout(400);
 expect(await page.evaluate(()=>[...document.querySelector('.focus-round').querySelectorAll('.focus-pair-pane')].map(p=>[p.inert,p.classList.contains('is-inactive')]))).toEqual([[false,false],[true,true]]);
 expect(await viewedRef(page)).toEqual(R.a1);await expect(page.locator('.focus-round').first().locator('.focus-partner').nth(0)).toHaveAttribute('aria-current','step');expect(await pairMotion(page)).toBe(0);
});
test('a logged member check fades in, persists unselected, and undo reverses it',async({page})=>{
 await round(page,R.a1,false);await page.getByLabel('Auto-next',{exact:true}).uncheck();
 const a=page.locator('.focus-round').first().locator('.focus-partner').nth(0),check=a.locator('.focus-partner-check');
 const read=()=>check.evaluate(n=>n.getAnimations().map(x=>({duration:x.effect.getTiming().duration,easing:x.effect.getTiming().easing,frames:x.effect.getKeyframes().map(f=>[f.opacity,f.transform])})));
 await page.evaluate(()=>port.row({exerciseId:'a',setId:'a1'}).querySelector('.log-done').click());
 expect(await read()).toEqual([{duration:160,easing:'ease-out',frames:[['0','scale(0.65)'],['1','scale(1)']]}]);
 await expect(check).toBeVisible();await page.locator('.focus-round').first().locator('.focus-partner').nth(1).click();await expect(check).toBeVisible();await expect(a).not.toHaveAttribute('aria-current');
 await a.click();await page.evaluate(()=>port.row({exerciseId:'a',setId:'a1'}).querySelector('.log-done').click());
 expect((await read())[0].frames).toEqual([['1','scale(1)'],['0','scale(0.65)']]);await expect(check).toBeVisible();await expect(a.locator('.focus-partner-member')).toHaveText('A1');
 await expect(check).toBeHidden();expect(await read()).toEqual([]);
});
test('stored completion, typing, acknowledgement, restore and hydration show final states without partner motion',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[1].sets[1],{done:true,reps:8});
 await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 await expect(page.locator('.focus-round').first().locator('.focus-partner').nth(0).locator('.focus-partner-check')).toBeVisible();expect(await pairMotion(page)).toBe(0);
 await page.locator('.focus-card[data-set-id="a1"] [data-field="weight"]').fill('82.5');expect(await pairMotion(page)).toBe(0);
 expect(await page.evaluate(()=>{logger.setStatus('Saved');logger.setBestPerformance({});focusView.setEnabled(false);focusView.setEnabled(true);
  const l=port.read().log;Object.assign(l.exercises[2].sets[1],{done:true,reps:8});logger.setLog(l);focusView.update(port.read());
  return [...document.querySelectorAll('.focus-partner-check')].flatMap(n=>n.getAnimations()).length;})).toBe(0);
 expect(await pairMotion(page)).toBe(0);await expect(page.locator('.focus-round').first().locator('.focus-partner').nth(1).locator('.focus-partner-check')).toBeVisible();
});
test('a press on a numeric input stills the entering pane; switching disables the old ruler and its readout',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const r=await page.evaluate(async()=>{const a=port.row({exerciseId:'a',setId:'a1'}),b=port.row({exerciseId:'b',setId:'b1'}),aw=a.querySelector('[data-field="weight"]'),bw=b.querySelector('[data-field="weight"]');
  aw.closest('.log-stepper').querySelector('.workout-ruler').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await new Promise(requestAnimationFrame);
  const readout=aw.getAnimations().length;document.querySelectorAll('.focus-round .focus-partner')[1].click();
  const pane=b.closest('.focus-pair-pane'),entering=pane.getAnimations().length;bw.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  return {readout,after:aw.getAnimations().length,entering,stilled:pane.getAnimations().length,rulers:[a,b].map(r=>r.querySelector('.workout-ruler').hidden),fresh:bw.getAnimations().length};});
 expect(r).toEqual({readout:1,after:0,entering:1,stilled:0,rulers:[true,false],fresh:0});
});
test('reduced motion mid-switch, suspension, disabling and destroying settle every partner effect',async({page})=>{
 await mountFocusFixture(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const start=i=>page.evaluate(i=>{document.querySelectorAll('.focus-round .focus-partner')[i].click();return document.querySelector('.focus-round .focus-pair-pane:not(.is-inactive)').getAnimations().length;},i);
 expect(await start(1)).toBe(1);await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>pairMotion(page)).toBe(0);await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await start(0)).toBe(1);await page.evaluate(()=>{focusView.suspend(true);focusView.suspend(false);});expect(await pairMotion(page)).toBe(0);
 // Focus inside the leaving pane reaches the destination before the pane is made inert; disabling leaves no focus in a hidden field.
 await page.locator('.focus-card[data-set-id="a1"] [data-field="reps"]').focus();expect(await start(1)).toBe(1);await expect(page.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
 expect(await page.evaluate(sel=>{const nodes=[...document.querySelectorAll(sel)];focusView.setEnabled(false);const a=document.activeElement;return [nodes.flatMap(n=>n.getAnimations()).length,Boolean(a.closest('[inert],[hidden],.is-inactive'))];},PAIR)).toEqual([0,false]);
 await page.evaluate(()=>focusView.setEnabled(true));expect(await start(0)).toBe(1);
 expect(await page.evaluate(sel=>{const nodes=[...document.querySelectorAll(sel)];focusView.destroy();return nodes.flatMap(n=>n.getAnimations()).length;},PAIR)).toBe(0);
});
test('the title ticker runs only for the selected visible partner and holds still through travel',async({page})=>{
 const log=focusFixture();log.exercises[2].name='Chest-supported row with a long neutral grip handle and a pause';
 await mountFocusFixture(page,{log});await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
 const ZERO='translate3d(0px, 0px, 0px)',track=id=>page.evaluate(id=>document.querySelector(`.focus-pair-pane[data-exercise-id="${id}"] .workout-title-track`).style.transform,id);
 await expect.poll(()=>track('a'),{timeout:4000}).not.toBe(ZERO);expect(await track('b')).toBe(ZERO);
 await page.locator('.focus-round').first().locator('.focus-partner').nth(1).click();const held=await track('a');
 await expect.poll(()=>track('b'),{timeout:4000}).not.toBe(ZERO);expect(await track('a')).toBe(held);
 // Until arrival the viewed set stays b1, so only travel's suspension keeps its title still.
 const samples=await page.evaluate(()=>new Promise(resolve=>{const f=document.querySelector('.focus-feed'),t=document.querySelector('.focus-pair-pane[data-exercise-id="b"] .workout-title-track'),seen=[];f.addEventListener('scroll',()=>seen.push(t.style.transform));f.addEventListener('scrollend',()=>resolve(seen),{once:true});focusView.jump({exerciseId:'straight',setId:'sw'},{animate:true});}));
 expect(samples.length).toBeGreaterThan(2);expect(new Set(samples).size).toBe(1);
});
