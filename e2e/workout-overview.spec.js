import {test,expect} from '@playwright/test';
import {mountFocusFixture} from './workout-focus-helper.js';
import {focusFixture} from '../test/fixtures/workout-focus.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function mount(page,log,{viewed}={}){await mountFocusFixture(page,{log});await page.evaluate(async viewed=>{const {mountWorkoutOverview}=await import('/src/workout-overview.js');window.jumps=[];window.overview=mountWorkoutOverview({port,onJump:ref=>{jumps.push(ref);focusView.jump(ref,{animate:true,focus:true});},onActivity:v=>focusView.suspend(v)});if(viewed)focusView.jump(viewed);overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));},viewed);return page.getByRole('dialog',{name:'Workout overview'});}
const act=async(page,d,name,item)=>{await d.getByRole('button',{name:`Actions, ${name}`,exact:true}).click();await page.getByRole('button',{name:item,exact:true}).click();};
test('each exercise shows one chip per set with its state',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0].sets[1],{weightKg:80,reps:8,rir:2,done:true});const d=await mount(page,log,{viewed:{exerciseId:'straight',setId:'s2'}});await page.screenshot({path:'.superpowers/sdd/2026-11-12-workout-flow/overview-390.png'});
 await expect(d.getByRole('group',{name:'Sets, Bench press',exact:true}).locator('.overview-chip')).toHaveText(['W —','80×8','—']);
 const done=d.getByRole('button',{name:'Working set 1, Bench press, 80 kg × 8, 2 RIR, complete',exact:true});await expect(done).toHaveClass(/is-done/);await expect(done.locator('svg')).toHaveCount(1);
 const cur=d.getByRole('button',{name:/^Working set 2, Bench press/});await expect(cur).toHaveAttribute('aria-current','step');await expect(cur).toBeFocused();
 await expect(d.getByRole('button',{name:/^Warm-up 1, Bench press.*, up next$/})).toHaveCount(1);
 await expect(d.getByRole('button',{name:/^Working set 2, Single-arm.*, no partner set this round$/})).toHaveCount(1);
 await expect(d.getByRole('heading',{name:/^(Round 1|Warm-ups|Working sets)$/})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Remove (Working set|Warm-up)/})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Set note,/})).toHaveCount(0);
 for(const c of await d.locator('.overview-chip').all()){const r=await c.boundingBox();expect(r.height).toBeGreaterThanOrEqual(44);expect(r.width).toBeGreaterThanOrEqual(56);}
});
test('a chip jumps to its set and the viewed chip only closes',async({page})=>{
 const d=await mount(page,undefined,{viewed:{exerciseId:'straight',setId:'s1'}});
 await d.getByRole('button',{name:'Working set 2, Bench press',exact:true}).click();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});
 await page.evaluate(()=>{overview.update(port.read(),focusView.visibleRef());overview.open(document.querySelector('.focus-overview'));});await page.getByRole('dialog',{name:'Workout overview'}).getByRole('button',{name:'Working set 2, Bench press',exact:true}).click();await expect(d).toHaveCount(0);
 expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'straight',setId:'s2'});await expect(page.locator('.focus-overview')).toBeFocused();
});
test('zero-set exercise remains manageable and escape restores opener',async({page})=>{
 const d=await mount(page);await expect(d.locator('p:not([hidden])',{hasText:'No sets'})).toBeVisible();await act(page,d,'Cable raise','Add set');expect(await page.evaluate(()=>port.read().log.exercises.at(-1).sets.length)).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.focus-overview')).toBeFocused();
});
test('reorder moves pairs as blocks and unlink preserves set identity',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a2'}));
 await d.getByRole('button',{name:/Reorder superset/}).press('ArrowUp');expect(await page.evaluate(()=>port.read().log.exercises.slice(0,2).map(e=>e.id))).toEqual(['a','b']);
 expect(await page.evaluate(()=>({ref:focusView.visibleRef(),top:document.querySelector('.focus-feed').scrollTop,rows:[...document.querySelectorAll('.focus-feed .focus-card')].map(r=>[r.dataset.setId,r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)])}))).toMatchObject({ref:{exerciseId:'a',setId:'a2'}});
 await expect(d.getByRole('button',{name:/^Actions, /})).toHaveCount(4);await expect(d.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(1);await d.getByRole('button',{name:'Unlink superset',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].superset)).toBeUndefined();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'a',setId:'a2'});
 await expect(d.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(0);await expect(d.getByRole('button',{name:/^Actions, /})).toHaveCount(4);
});
test('note editing uses canonical scope and removing a paired member dissolves pair',async({page})=>{
 const d=await mount(page);await act(page,d,'Bench press','Exercise note');await d.getByRole('textbox',{name:'Note, Bench press',exact:true}).fill('Overview note');await act(page,d,'Chest-supported row','Remove exercise');
 expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='straight').note)).toBe('Overview note');expect(await page.evaluate(()=>port.read().log.exercises.find(e=>e.id==='a').superset)).toBeUndefined();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.focus-overview')).toBeFocused();
});
test('picker lives in the dialog and closes without leaking its popover',async({page})=>{
 const d=await mount(page);await act(page,d,'Bench press','Swap exercise');await expect(d.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
 await d.getByRole('button',{name:'Close overview',exact:true}).click();await expect(page.locator('.exercise-options')).toHaveCount(0);
});
test('catalog swap keeps pair and sets while clearing its target',async({page})=>{
 const d=await mount(page);await act(page,d,'Chest-supported row','Swap exercise');await d.getByRole('combobox',{name:'Exercise',exact:true}).fill('Incline');await page.getByRole('option',{name:/Incline press/}).click();
 expect(await page.evaluate(()=>{const l=port.read().log;return {target:l.exercises[2].target,pair:!!l.exercises[1].superset,sets:l.exercises[2].sets.map(s=>s.id)};})).toEqual({target:null,pair:true,sets:['bw','b1']});
});
test('limits count warmups and working sets together',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log,ex=l.exercises[0];ex.sets=Array.from({length:20},(_,i)=>({...ex.sets[i%3],id:'cap'+i,kind:i<5?'warmup':'working'}));logger.setLog(l);});
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await expect(page.getByRole('button',{name:'Add set',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Add warm-up',exact:true})).toBeDisabled();
});
test('canceling completed-exercise removal keeps overview and log intact',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].done=true;l.exercises[0].sets[1].reps=8;logger.setLog(l);});await act(page,d,'Bench press','Remove exercise');await page.getByRole('dialog',{name:'Remove exercise?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>port.read().log.exercises.length)).toBe(4);await expect(d).toBeVisible();
});
test('blank workouts can add catalog exercises and forty is the cap',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises=[];logger.setLog(l);});await d.getByRole('button',{name:'Add exercise',exact:true}).click();await d.getByRole('combobox',{name:'Exercise',exact:true}).fill('Incline');await page.getByRole('option',{name:/Incline press/}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].name)).toBe('Incline press');
 await page.evaluate(()=>{const l=port.read().log;l.exercises=Array.from({length:40},(_,i)=>({...l.exercises[0],id:'ex'+i,sets:[]}));logger.setLog(l);});await expect(d.getByRole('button',{name:'Add exercise',exact:true})).toBeDisabled();
});
test('repeated variants jump by exercise and set IDs',async({page})=>{
 const d=await mount(page);await page.evaluate(()=>{const l=port.read().log;l.exercises[0].variantId=l.exercises[3].variantId='v9';l.exercises[3].name=l.exercises[0].name;l.exercises[3].sets=[{...l.exercises[0].sets[1],id:'repeat'}];logger.setLog(l);});await d.getByRole('button',{name:/^Working set 1, Bench press/}).last().click();expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'empty',setId:'repeat'});
});
test('reorder menu remains operable inside the native dialog',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Reorder Bench press',exact:true}).click();await page.getByRole('button',{name:'Move down',exact:true}).click();expect(await page.evaluate(()=>port.read().log.exercises[0].id)).toBe('a');
});

test.describe('chip motion',()=>{
 test.use({reducedMotion:'no-preference'});
 test('added and removed chips fade',async({page})=>{
  await mount(page);
  const added=await page.evaluate(async()=>{await port.command({type:'add-set',exerciseId:'straight'});const c=[...document.querySelectorAll('.workout-overview [aria-label="Sets, Bench press"] .overview-chip')].at(-1),entering=c.classList.contains('is-entering');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return [entering,c.classList.contains('is-entering')];});
  expect(added).toEqual([true,false]);
  const removed=await page.evaluate(async()=>{const c=document.querySelector('.workout-overview [data-set-id="s2"]');await port.command({type:'remove-set',ref:{exerciseId:'straight',setId:'s2'}});return [c.classList.contains('is-removing'),c.inert,c.isConnected];});
  expect(removed).toEqual([true,true,true]);await page.waitForTimeout(250);expect(await page.evaluate(()=>!!document.querySelector('.workout-overview [data-set-id="s2"]'))).toBe(false);
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(async()=>{await port.command({type:'add-set',exerciseId:'straight'});const c=[...document.querySelectorAll('.workout-overview [aria-label="Sets, Bench press"] .overview-chip')].at(-1);await port.command({type:'remove-set',ref:{exerciseId:'straight',setId:c.dataset.setId}});return c.isConnected;})).toBe(false);
 });
});
test('a done chip keeps its check and refreshes its text on re-render',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0].sets[1],{weightKg:80,reps:8,done:true});const d=await mount(page,log);
 const chip=d.locator('.overview-chip[data-set-id="s1"]');await expect(chip).toHaveText('80×8');
 await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].weightKg=85;logger.setLog(l);});
 await expect(chip).toHaveText('85×8');await expect(chip.locator('svg path')).toHaveCount(1);
 await page.evaluate(()=>{const l=port.read().log;l.exercises[0].sets[1].done=false;logger.setLog(l);});
 await expect(chip.locator('svg')).toHaveCount(0);await expect(chip).toHaveText('85×8');
});

test('the actions menu holds every exercise command',async({page})=>{
 const d=await mount(page);const names=['Add set','Add warm-up','Exercise note','Swap exercise','Move up','Move down','Remove last set','Remove last warm-up','Remove exercise'],ids=()=>page.evaluate(()=>port.read().log.exercises[0].sets.map(s=>s.id));
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();const g=page.getByRole('group',{name:'Exercise actions',exact:true});await expect(g.getByRole('button')).toHaveText(names);
 await g.getByRole('button',{name:'Remove last set',exact:true}).click();expect(await ids()).toEqual(['sw','s1']);
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await page.getByRole('button',{name:'Remove last warm-up',exact:true}).click();expect(await ids()).toEqual(['s1']);
 await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await expect(page.getByRole('button',{name:'Remove last warm-up',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await d.getByRole('button',{name:'Actions, Cable raise',exact:true}).click();await expect(page.getByRole('button',{name:/^Remove last/})).toHaveCount(0);
});
test('rows show reorder, name, tags and actions; pairs show one header',async({page})=>{
 const log=focusFixture();Object.assign(log.exercises[0],{brand:'Hammer',focusTags:['Upper chest']});const d=await mount(page,log);
 const line=d.locator('.overview-line').first();await expect(line.getByRole('button',{name:'Reorder Bench press',exact:true})).toBeVisible();await expect(line.locator('.overview-name')).toContainText('Bench press');
 await expect(line.locator('.overview-tags')).toHaveText('Tags: Hammer · Upper chest');await expect(line.locator('.overview-tags .visually-hidden')).toHaveText('Tags:');await expect(line.getByRole('button',{name:'Actions, Bench press',exact:true})).toBeVisible();
 await expect(d.locator('.overview-tags')).toHaveCount(1);
 const pair=d.locator('.overview-block.is-pair');await expect(pair.getByRole('button',{name:'Reorder superset Single-arm incline dumbbell chest press + Chest-supported row',exact:true})).toHaveCount(1);
 await expect(pair.locator('.overview-pair-head')).toContainText('30 sec between · 1 min 30 sec after round');await expect(pair.getByRole('button',{name:'Unlink superset',exact:true})).toHaveCount(1);
 await expect(pair.locator('.overview-member')).toHaveText(['A1','A2']);await expect(pair.locator('.overview-line .reorder-action')).toHaveCount(0);
 await d.getByRole('button',{name:'Unlink superset',exact:true}).focus();await expect(page.getByRole('tooltip')).toHaveText('Unlink superset');
});
for(const fallback of [false,true])test(`six exercises with four sets fit without scrolling at 390x844 (${fallback?'explicitly blocked':'default policy'} fonts)`,async({page})=>{
 if(fallback)await page.route('**/e2e/fixtures/fonts/fonts.css',r=>r.abort());
 const log=focusFixture(),base=log.exercises[0],set=(id,kind,done,w,r)=>({id,kind,weightKg:w,reps:r,rir:null,done,note:''});
 log.exercises=Array.from({length:6},(_,i)=>({...base,id:'r'+i,name:`Row ${i+1}`,sets:[set('w','warmup',true,40,10),set('a','working',true,80,8),set('b','working',true,80,8),set('c','working',false,null,null)]}));
 const d=await mount(page,log);const m=await d.evaluate(dlg=>({top:dlg.scrollTop,bottom:dlg.getBoundingClientRect().bottom,last:[...dlg.querySelectorAll('.overview-chips')].at(-1).getBoundingClientRect().bottom,h:[...dlg.querySelectorAll('.overview-chips')].map(c=>c.getBoundingClientRect().height)}));
 expect(m.top).toBe(0);expect(m.last).toBeLessThanOrEqual(m.bottom);for(const h of m.h)expect(h).toBeLessThanOrEqual(45);
});
test('removing an exercise from its menu keeps focus in the sheet',async({page})=>{
 const d=await mount(page);await act(page,d,'Cable raise','Remove exercise');await page.waitForTimeout(250);
 await expect(d.getByRole('button',{name:'Actions, Single-arm incline dumbbell chest press',exact:true})).toBeFocused();
});
test('removing either member of a pair from its menu keeps focus on an actions button',async({page})=>{
  for(const [gone,next] of [['Chest-supported row','Cable raise'],['Single-arm incline dumbbell chest press','Chest-supported row']]){
   const d=await mount(page);await act(page,d,gone,'Remove exercise');await page.waitForTimeout(250);
   await expect(d.getByRole('button',{name:/^Actions, /}).and(page.locator(':focus'))).toHaveCount(1);
   await expect(d.getByRole('button',{name:`Actions, ${next}`,exact:true})).toBeFocused();
   await page.reload();
  }
 });

async function startOverviewDrag(page,pair=false){
 const source=page.locator(`.workout-overview .overview-blocks > .overview-block${pair?'[data-block-id=a]':':is([data-block-id=straight],[data-block-id=long0])'}`).first();
 const name=source.locator('.overview-name > span').first();await name.scrollIntoViewIfNeeded();const box=await name.boundingBox();
 await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(box.x+23,box.y+23);await page.evaluate(p=>window.dragPointer=p,{x:box.x+23,y:box.y+23});
 return source;
}
for(const motion of ['reduce','no-preference'])for(const pair of [false,true])test(`modal drag paints above the overview and commits once (${pair?'pair':'single'}, ${motion})`,async({page})=>{
 const log=focusFixture();for(const ex of log.exercises)Object.assign(ex,{brand:'Hammer',focusTags:['Upper chest']});
 await page.emulateMedia({reducedMotion:motion});const d=await mount(page,log);await page.waitForTimeout(motion==='reduce'?0:250);await page.evaluate(()=>{window.saved=[];window.beforeIds=port.read().log.exercises.map(e=>[e.id,e.sets.map(s=>s.id)]);});
 const selector=`.workout-overview .overview-blocks > [data-block-id=${pair?'a':'straight'}]`;
 const geometry=el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.overview-name,.overview-tags,.overview-chip,.action-button')].filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return [b.x-r.x,b.y-r.y,b.width,b.height];});};
 const before=await page.locator(selector).evaluate(geometry),source=await startOverviewDrag(page,pair),copy=page.locator('.sort-drag-copy');
 const box=await copy.locator('.overview-name').first().boundingBox(),clip={x:Math.ceil(box.x),y:Math.ceil(box.y),width:Math.floor(box.width)-2,height:Math.floor(box.height)-2};
 const painted=await page.screenshot({clip,animations:'disabled'});await copy.evaluate(el=>el.style.visibility='hidden');const hidden=await page.screenshot({clip,animations:'disabled'});
 expect(painted.equals(hidden)).toBe(false);await copy.evaluate(el=>el.style.removeProperty('visibility'));
 await page.screenshot({path:`.superpowers/verification/2026-11-15-workout-overview-interactions/drag-${pair?'pair':'single'}-${motion}.png`});
 const after=await copy.evaluate(geometry);expect(after.length).toBe(before.length);after.forEach((r,i)=>r.forEach((v,j)=>expect(Math.abs(v-before[i][j]),JSON.stringify({i,j,before:before[i],after:r})).toBeLessThanOrEqual(1)));
 await expect(page.locator('.sort-drag-host:popover-open')).toHaveCount(1);
 expect(await page.locator('.sort-drag-host').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,maxWidth:s.maxWidth,maxHeight:s.maxHeight,overflow:s.overflow};})).toEqual({background:'rgba(0, 0, 0, 0)',maxWidth:'none',maxHeight:'none',overflow:'visible'});
 expect(await source.evaluate(el=>el.hasPointerCapture(1))).toBe(true);
 expect(await copy.evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true')).toBe(true);
 expect(await page.locator('.sort-drag-host').evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true')).toBe(true);
 const first=await copy.boundingBox();const pointer=await page.evaluate(()=>window.dragPointer);await page.mouse.move(pointer.x+32,pointer.y+22);const moved=await copy.boundingBox();expect(Math.abs(moved.x-first.x-32)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>saved.length)).toBe(0);
 const target=await d.locator('.overview-block:not(.sort-source)').last().boundingBox();await page.mouse.move(target.x+50,target.y+target.height-2);await page.mouse.up();
 expect(await page.evaluate(()=>saved.length)).toBe(1);
 expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(pair?['straight','empty','a','b']:['a','b','empty','straight']);
 expect(await page.evaluate(()=>port.read().log.exercises.map(e=>[e.id,e.sets.map(s=>s.id)]).sort())).toEqual(log.exercises.map(e=>[e.id,e.sets.map(s=>s.id)]).sort());
 await expect(page.locator('.sort-drag-host,.sort-placeholder,.sort-source')).toHaveCount(0);await expect(d.locator('.overview-order-status')).toHaveText('');
});

for(const motion of ['reduce','no-preference'])for(const cancel of ['Escape','pointercancel','lostpointercapture','outside','blur','close','resize','remove','destroy'])test(`overview drag cancellation ${cancel} (${motion})`,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});await mount(page);await page.waitForTimeout(motion==='reduce'?0:250);await page.evaluate(()=>window.saved=[]);const source=await startOverviewDrag(page);
 if(cancel==='Escape')await page.keyboard.press('Escape');
 else if(cancel==='outside')await page.mouse.move(1,1);
 else if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 else if(cancel==='close')expect(await page.evaluate(()=>{overview.close();return document.querySelectorAll('.sort-drag-host').length;})).toBe(0);
 else if(cancel==='resize'){await page.setViewportSize({width:412,height:844});await expect(page.locator('.sort-drag-host')).toHaveCount(0);}
 else if(cancel==='remove')await source.evaluate(el=>el.remove());
 else if(cancel==='destroy')await page.evaluate(()=>overview.destroy());
 else await source.dispatchEvent(cancel,{pointerId:1});
 await page.mouse.up();await expect(page.locator('.sort-drag-host,.sort-placeholder,.sort-source,.is-hold-armed')).toHaveCount(0);
 expect(await page.evaluate(()=>saved.length)).toBe(0);expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(['straight','a','b','empty']);
});

function longOverview(){const log=focusFixture(),base=log.exercises[0];log.exercises=Array.from({length:18},(_,i)=>({...base,id:'long'+i,name:'Exercise '+i,sets:base.sets.map(s=>({...s,id:i+'-'+s.id}))}));return log;}
test('scrolling overview drag reaches every block and rejects clipped drops',async({page})=>{
 const d=await mount(page,longOverview());await page.evaluate(()=>window.saved=[]);await startOverviewDrag(page);
 const rect=await d.boundingBox();await page.mouse.move(rect.x+90,rect.y+rect.height-8);
 await expect.poll(()=>d.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop),{timeout:10000}).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>scrollY)).toBe(0);
 await page.mouse.move(rect.x+90,rect.y+8);await expect.poll(()=>d.evaluate(el=>el.scrollTop),{timeout:10000}).toBe(0);
 await page.mouse.move(rect.x+90,rect.y+rect.height+4);await page.mouse.up();expect(await page.evaluate(()=>saved.length)).toBe(0);
});

test('overview drag sanitizes ID references before connection',async({page})=>{
 await mount(page);await page.evaluate(()=>{const el=document.querySelector('.overview-name');el.id='source-name';for(const a of ['for','list','form','headers','aria-labelledby','aria-describedby','aria-controls','aria-details','aria-errormessage','aria-owns','aria-activedescendant','aria-flowto'])el.setAttribute(a,'source-name');});
 await startOverviewDrag(page);expect(await page.locator('.sort-drag-copy').evaluate(el=>el.querySelectorAll('[id],[for],[list],[form],[headers],[aria-labelledby],[aria-describedby],[aria-controls],[aria-details],[aria-errormessage],[aria-owns],[aria-activedescendant],[aria-flowto]').length)).toBe(0);
 await page.keyboard.press('Escape');await page.mouse.up();
});
for(const motion of ['reduce','no-preference'])test(`overview touch hold owns drag and cancels cleanly (${motion})`,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});await mount(page);await page.waitForTimeout(250);await page.evaluate(()=>window.saved=[]);
 const b=await page.locator('.overview-name').first().boundingBox(),client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+10,y:b.y+10}]});await expect(page.locator('.overview-blocks > .overview-block').first()).toHaveClass(/is-hold-armed/);
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+30,y:b.y+30}]});await expect(page.locator('.sort-drag-host:popover-open')).toHaveCount(1);
 await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('.sort-drag-host,.sort-placeholder,.sort-source,.is-hold-armed')).toHaveCount(0);
 expect(await page.evaluate(()=>saved.length)).toBe(0);await page.getByRole('button',{name:'Actions, Bench press',exact:true}).tap();await expect(page.getByRole('group',{name:'Exercise actions',exact:true})).toBeVisible();
});

const actionGroup=page=>page.getByRole('group',{name:'Exercise actions',exact:true});
test('movement handles share the exercise actions menu',async({page})=>{
 const d=await mount(page),handle=d.getByRole('button',{name:'Reorder Bench press',exact:true}),more=d.getByRole('button',{name:'Actions, Bench press',exact:true});
 await more.click();const g=actionGroup(page);await expect(g.getByRole('button')).toHaveText(['Add set','Add warm-up','Exercise note','Swap exercise','Move up','Move down','Remove last set','Remove last warm-up','Remove exercise']);
 await expect(g.getByRole('button',{name:'Add set',exact:true})).toBeFocused();await expect(g.getByRole('button',{name:'Move up',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(more).toBeFocused();
 await handle.press('Enter');await expect(g.getByRole('button',{name:'Move down',exact:true})).toBeFocused();await expect(page.getByRole('group',{name:'Reorder options',exact:true})).toHaveCount(0);
 await page.keyboard.press('Space');await expect(handle).toBeFocused();expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(['a','b','straight','empty']);
 await expect(d.getByRole('status')).toHaveText('Bench press moved to position 2 of 3.');await handle.press('ArrowDown');await expect(handle).toBeFocused();await expect(d.getByRole('status')).toHaveText('Bench press moved to position 3 of 3.');
 await handle.press('ArrowUp');await expect(d.getByRole('status')).toHaveText('Bench press moved to position 2 of 3.');await handle.click();await expect(g.getByRole('button',{name:'Move up',exact:true})).toBeFocused();await page.keyboard.press('Escape');
 await more.click();await g.getByRole('button',{name:'Move up',exact:true}).click();await expect(more).toBeFocused();
 await page.evaluate(()=>{const l=port.read().log;l.exercises=[l.exercises.find(e=>e.id==='straight')];logger.setLog(l);});await handle.click();await expect(g.getByRole('button',{name:'Move up',exact:true})).toBeDisabled();await expect(g.getByRole('button',{name:'Move down',exact:true})).toBeDisabled();await expect(g.getByRole('button',{name:'Add set',exact:true})).toBeFocused();
});
for(const member of ['Single-arm incline dumbbell chest press','Chest-supported row'])test(`either member moves the whole superset from its actions: ${member}`,async({page})=>{
 const d=await mount(page);await act(page,d,member,'Move superset up');expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(['a','b','straight','empty']);await expect(d.getByRole('status')).toHaveText('Superset moved to position 1 of 3.');
 await d.getByRole('button',{name:/Reorder superset/}).click();await expect(actionGroup(page).getByRole('button',{name:'Move superset down',exact:true})).toBeFocused();await expect(actionGroup(page).getByRole('button',{name:'Move superset up',exact:true})).toBeDisabled();await expect(actionGroup(page).getByRole('button',{name:'Swap exercise',exact:true})).toBeVisible();
});
test('movement resolves live blocks and ignores removed targets',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();
 await page.evaluate(()=>{const choice=[...document.querySelectorAll('.workout-overview .reorder-menu button')].find(b=>b.textContent==='Move down'),l=port.read().log;l.exercises=[l.exercises[1],l.exercises[2],l.exercises[0],l.exercises[3]];logger.setLog(l);window.saved=[];choice.click();});expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(['a','b','empty','straight']);expect(await page.evaluate(()=>saved.length)).toBe(1);
 await d.getByRole('button',{name:'Actions, Chest-supported row',exact:true}).click();await page.evaluate(()=>{const choice=[...document.querySelectorAll('.workout-overview .reorder-menu button')].find(b=>b.textContent==='Move superset down'),l=port.read().log;delete l.exercises[0].superset;logger.setLog(l);window.saved=[];choice.click();});expect(await page.evaluate(()=>port.read().log.exercises.map(e=>e.id))).toEqual(['a','empty','b','straight']);await expect(d.getByRole('status')).toHaveText('Chest-supported row moved to position 3 of 4.');
 await d.getByRole('button',{name:'Actions, Cable raise',exact:true}).click();await page.evaluate(()=>{window.staleMove=[...document.querySelectorAll('.reorder-menu button')].find(b=>b.textContent==='Move down');const l=port.read().log;l.exercises=l.exercises.filter(e=>e.id!=='empty');logger.setLog(l);window.saved=[];staleMove.click();});expect(await page.evaluate(()=>saved.length)).toBe(0);
});

test.describe('overview popup motion',()=>{
 test.use({reducedMotion:'no-preference'});
 test('overview popup fade restores focus and survives rapid reopening',async({page})=>{
  const d=await mount(page);await page.waitForTimeout(250);const first=d.getByRole('button',{name:'Actions, Bench press',exact:true}),second=d.getByRole('button',{name:'Actions, Chest-supported row',exact:true});await first.click();
  const popup=page.locator('.workout-overview .reorder-menu');expect(await popup.evaluate(el=>getComputedStyle(el).transitionDuration.split(',').map(s=>s.trim()))).toEqual(['0.15s','0.15s','0.15s']);await page.waitForTimeout(180);await page.screenshot({path:'.superpowers/verification/2026-11-15-workout-overview-interactions/menu-open.png'});
  const state=await page.evaluate(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const p=document.querySelector('.workout-overview .reorder-menu');return {inert:p.inert,focused:document.activeElement.getAttribute('aria-label'),open:p.matches(':popover-open'),display:getComputedStyle(p).display,animations:p.getAnimations().map(a=>[a.transitionProperty,a.effect.getTiming().duration])};});
  expect(state).toMatchObject({inert:true,focused:'Actions, Bench press',open:false,display:'flex'});expect(state.animations).toContainEqual(['opacity',150]);await expect(d).toBeVisible();
  await second.click();await page.waitForTimeout(200);await expect(actionGroup(page).getByRole('button',{name:'Add set',exact:true})).toBeFocused();expect(await popup.evaluate(el=>el.inert)).toBe(false);await expect(actionGroup(page).getByRole('button',{name:'Move superset down',exact:true})).toBeVisible();await page.screenshot({path:'.superpowers/verification/2026-11-15-workout-overview-interactions/menu-reopened.png'});
  await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));await expect(popup).toBeVisible();await page.keyboard.press('Escape');await expect(second).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});await first.click();expect(await popup.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await d.getByRole('heading',{name:'Workout overview',exact:true}).click();await expect(popup).toBeHidden();await first.click();await page.evaluate(()=>overview.close());await expect(page.locator('.workout-overview .reorder-menu')).toHaveCount(0);
 });
});

test('overview actions dismiss only when their anchor scrolls',async({page})=>{
 const d=await mount(page,longOverview()),trigger=d.getByRole('button',{name:'Actions, Exercise 0',exact:true});await trigger.click();
 await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));await expect(actionGroup(page)).toBeVisible();await d.evaluate(el=>el.scrollTop+=24);await expect(actionGroup(page)).toBeHidden();await expect(trigger).toBeFocused();
});
test('removing through the pair handle actions restores focus to its partner',async({page})=>{
 const d=await mount(page);await d.getByRole('button',{name:/Reorder superset/}).click();await actionGroup(page).getByRole('button',{name:'Remove exercise',exact:true}).click();await expect(d.getByRole('button',{name:'Actions, Chest-supported row',exact:true})).toBeFocused();
});

test.describe('native popup reversal',()=>{
 test.use({reducedMotion:'no-preference'});
 test('rapid popup reopening reverses the current opacity without a flash',async({page})=>{
  const d=await mount(page);await page.waitForTimeout(250);await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();await page.waitForTimeout(180);
  const opacity=await page.evaluate(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const p=document.querySelector('.workout-overview .reorder-menu');getComputedStyle(p).opacity;document.querySelector('[aria-label="Actions, Chest-supported row"]').click();return Number(getComputedStyle(p).opacity);});expect(opacity).toBeGreaterThan(.5);
 });
});

for(const width of [360,390,412])for(const scale of [1,2])test(`compact overview controls preserve framed chips and touch targets (${width}px, ${scale*100}% text)`,async({page})=>{
 await page.setViewportSize({width,height:844});const log=focusFixture();Object.assign(log.exercises[0].sets[1],{done:true,weightKg:80,reps:8,rir:2});
 for(const ex of log.exercises)Object.assign(ex,{name:ex.name+' with a deliberately long wrapping exercise name',brand:'Hammer strength equipment with a long brand name',focusTags:['Upper chest focus with a long label','Second focus']});
 const d=await mount(page,log,{viewed:{exerciseId:'straight',setId:'s1'}});await page.evaluate(scale=>document.documentElement.style.fontSize=16*scale+'px',scale);
 const close=d.getByRole('button',{name:'Close overview',exact:true});await expect(close.locator('svg')).toHaveCount(1);await expect(close).toHaveText('');
 const metrics=await d.locator('.action-button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {w:r.width,h:r.height,b:s.borderTopWidth,bg:s.backgroundColor};}));
 for(const m of metrics){expect(m.w).toBeGreaterThanOrEqual(44);expect(m.h).toBeGreaterThanOrEqual(44);expect(m.b).toBe('0px');expect(m.bg).toBe('rgba(0, 0, 0, 0)');}
 const chips=d.locator('.overview-chip');for(const chip of await chips.all()){const m=await chip.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {w:r.width,h:r.height,b:parseFloat(s.borderTopWidth),bg:s.backgroundColor};});expect(m.w).toBeGreaterThanOrEqual(56);expect(m.h).toBeGreaterThanOrEqual(44);expect(m.b).toBeGreaterThan(0);expect(m.bg).not.toBe('rgba(0, 0, 0, 0)');}
 await expect(d.locator('.overview-chip.is-done svg')).toHaveCount(1);await expect(d.locator('.overview-chip[aria-current=step]')).toHaveCSS('outline-width','2px');await expect(d.locator('.overview-chip.is-next')).toHaveCount(1);await expect(d.locator('.overview-chip.is-warmup').first()).toHaveText('W —');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const name of await d.locator('.overview-name').all())expect(await name.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await chips.last().scrollIntoViewIfNeeded();await expect(chips.last()).toBeInViewport();const lastAction=d.locator('.overview-more').last();await lastAction.scrollIntoViewIfNeeded();await expect(lastAction).toBeInViewport();await close.scrollIntoViewIfNeeded();await expect(close).toBeInViewport();await close.focus();await expect(close).toHaveCSS('outline-style','solid');await d.evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`.superpowers/verification/2026-11-15-workout-overview-interactions/layout-${width}-${scale}.png`});
 await close.click();await expect(d).toHaveCount(0);
});

test.describe('fine pointer compact overview',()=>{
 test.use({hasTouch:false,viewport:{width:1366,height:900}});
 test('compact icons retain keyboard focus and fine pointer hover',async({page})=>{
  const d=await mount(page),close=d.getByRole('button',{name:'Close overview',exact:true});await close.hover();await expect(close).toHaveCSS('color',await d.evaluate(el=>getComputedStyle(el).color));
  await close.focus();await expect(close).toHaveCSS('outline-width','2px');await expect(close).toHaveCSS('outline-style','solid');const r=await d.locator('.overview-chip').first().boundingBox();expect(r.height).toBe(32);
  await page.screenshot({path:'.superpowers/verification/2026-11-15-workout-overview-interactions/layout-desktop.png'});
 });
});
test('hybrid compact controls retain touch targets',async({page})=>{await page.setViewportSize({width:1000,height:900});const d=await mount(page);for(const b of await d.locator('.action-button,.overview-chip').all()){if(!await b.isVisible())continue;const r=await b.boundingBox();expect(r.height).toBeGreaterThanOrEqual(44);}await page.screenshot({path:'.superpowers/verification/2026-11-15-workout-overview-interactions/layout-hybrid.png'});});

test.describe('exact partner jump timing',()=>{
 test.use({reducedMotion:'no-preference'});
 for(const ref of [{exerciseId:'b',setId:'b1'},{exerciseId:'a',setId:'a1'}])test(`partner chips jump by exact ref only after sheet closure (${ref.exerciseId})`,async({page})=>{
  const d=await mount(page);await page.waitForTimeout(250);await d.locator(`.overview-exercise .overview-chip[data-set-id=${ref.setId}]`).click();
  expect(await page.evaluate(()=>window.jumps)).toEqual([]);await expect(d).toHaveClass(/is-closing/);expect(await d.locator('form').evaluate(el=>el.inert)).toBe(true);
  await expect(d).toHaveCount(0);expect(await page.evaluate(()=>window.jumps)).toEqual([ref]);
 });
});


test('a source removed before the drag threshold cannot promote a stale preview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mount(page);await page.evaluate(()=>window.saved=[]);
 const source=page.locator('.workout-overview [data-block-id=straight]'),name=await source.locator('.overview-name > span').first().boundingBox();await page.mouse.move(name.x+5,name.y+5);await page.mouse.down();await source.evaluate(el=>el.remove());await page.mouse.move(name.x+25,name.y+25);await page.mouse.up();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>saved.length)).toBe(0);await expect(page.locator('.sort-drag-host,.sort-placeholder,.sort-source')).toHaveCount(0);
});
