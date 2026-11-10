import {test,expect} from '@playwright/test';
import {login,resetWorkouts,headers} from './workout-helper.js';
const set=(weightKg,reps,kind='working')=>({id:crypto.randomUUID(),kind,weightKg,reps,rir:null,done:true,note:''});
const exercise=(id,target=null,sets=[set(50,8)])=>({id,variantId:'v1',referenceId:'r1',name:'Bench '+id,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],note:'',target,sets});
const target={sets:3,warmupSets:0,repRange:{min:8,max:12},restSeconds:90};
async function save(page,id,{status='finished',exercises=[exercise('e')],note=''}={}){
 const log={id,logVersion:2,status,name:'Best fixture',note,startedAt:'2026-11-01T10:00:00Z',finishedAt:status==='finished'?'2026-11-01T11:00:00Z':null,source:{kind:'blank'},exercises};
 const response=await page.request.put('/api/workouts/'+id,{headers,data:{revision:0,log}});expect(response.ok(),await response.text()).toBeTruthy();
}
test.beforeEach(async({page})=>{await login(page);await resetWorkouts(page);await page.reload();});

test('Best renders ranges, BW, empty history, cache and refresh after deletion',async({page})=>{
 await save(page,'older',{exercises:[exercise('old',null,[set(200,10,'warmup'),set(100,8),set(95,12),set(110,5)])]});
 await save(page,'current-fixture',{status:'active',exercises:[exercise('ranged',target,[set(150,10)]),exercise('all'),exercise('empty',{...target,repRange:{min:20,max:30}}),{...exercise('unlinked'),variantId:null,referenceId:null}]});
 await page.goto('/#/workouts/current-fixture');
 const best=page.locator('.log-best');await expect(best.nth(0)).toHaveText('Best (8–12 reps) · 100 kg × 8 · 1 Nov 2026');
 await expect(best.nth(1)).toHaveText('Best · 110 kg × 5 · 1 Nov 2026');
 await expect(best.nth(2)).toHaveText('Best (20–30 reps) · No qualifying performance');
 await expect(best.nth(3)).toHaveText('Best · No qualifying performance');
 await expect(page.getByRole('textbox',{name:'Set 1 weight, Bench all',exact:true})).toHaveAttribute('placeholder','100');
 await expect(best.nth(0).locator('time')).toHaveAttribute('datetime','2026-11-01T11:00:00Z');
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));await page.reload();await expect(best.nth(0)).toContainText('100 kg × 8');
 await page.unroute('**/api/**');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 const r=(await (await page.request.get('/api/workouts/older')).json()).record;
 await page.request.delete('/api/workouts/older?revision='+r.revision,{headers});
 await page.reload();await expect(best.nth(0)).toContainText('No qualifying performance');
});

test('Best loading and failures do not block note edits or logging',async({page})=>{
 await save(page,'current-fixture',{status:'active'});
 await page.route('**/api/workouts/best?**',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{message:'Denied'}})}));
 await page.goto('/#/workouts/current-fixture');await expect(page.locator('.log-best')).toHaveText('Best unavailable');
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();await page.getByLabel('Workout note',{exact:true}).fill('still editable');
 await expect(page.getByLabel('Workout note',{exact:true})).toHaveValue('still editable');
});

test('Best shows BW, unknown offline and a true loading state',async({page})=>{
 await save(page,'bw',{exercises:[exercise('old',null,[set(null,8),set(0,12)])]});
 await save(page,'current-fixture',{status:'active'});
 let release;const gate=new Promise(r=>{release=r;});
 await page.route('**/api/workouts/best?**',async route=>{await gate;await route.continue();});
 await page.goto('/#/workouts/current-fixture');await expect(page.locator('.log-best')).toHaveText('Loading best…');
 release();await expect(page.locator('.log-best')).toHaveText('Best · BW × 12 · 1 Nov 2026');
 await page.unroute('**/api/workouts/best?**');
 await page.evaluate(()=>{const mirror=JSON.parse(localStorage.getItem('gpb.activeWorkout'));delete mirror.bestPerformance;localStorage.setItem('gpb.activeWorkout',JSON.stringify(mirror));});
 await page.route('**/api/workouts/best?**',route=>route.abort('internetdisconnected'));await page.reload();
 await expect(page.locator('.log-best')).toHaveText('Best unavailable offline');
});

test('finished workout notes save online, exclude their own Best and never copy forward',async({page})=>{
 await save(page,'finished',{note:'Finished context'});
 await page.goto('/#/workouts/finished');await expect(page.locator('.log-best')).toHaveText('Best · No qualifying performance');
 await page.getByRole('button',{name:'Edit workout note',exact:true}).click();const input=page.getByLabel('Workout note',{exact:true});
 await input.fill('Edited finished context');await page.getByLabel('Workout name',{exact:true}).focus();
 await expect.poll(async()=>(await (await page.request.get('/api/workouts/finished')).json()).record.log.note).toBe('Edited finished context');
 await page.reload();await expect(page.getByRole('button',{name:'Edit workout note',exact:true})).toHaveText('Edited finished context');
 await save(page,'current-fixture',{status:'active'});await page.goto('/#/workouts/current-fixture');await expect(page.getByRole('button',{name:'Add workout note',exact:true})).toBeVisible();
});

test('workout note closes inertly, reverses safely and settles on reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await save(page,'current-fixture',{status:'active'});await page.goto('/#/workouts/current-fixture');
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();const input=page.getByRole('textbox',{name:'Workout note',exact:true});await input.fill('Motion note');
 await page.getByLabel('Workout name',{exact:true}).focus();
 expect(await page.locator('.logger-note textarea').evaluate(el=>el.closest('.log-note-part').inert)).toBe(true);
 await page.getByRole('button',{name:'Edit workout note',exact:true}).click();await expect(input).toBeFocused();await expect(input).toHaveValue('Motion note');
 await page.getByLabel('Workout name',{exact:true}).focus();await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('.logger-note textarea')).toHaveCount(0);await expect(page.getByLabel('Workout name',{exact:true})).toBeFocused();
});

for(const status of ['active','finished'])test(`Best refreshes add and swap and ignores delayed old variant (${status})`,async({page})=>{
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const [replacement,added]=entries.filter(e=>!e.archived&&e.equipment).slice(0,2);
 await save(page,'current-fixture',{status});
 let release;const gate=new Promise(r=>{release=r;});let oldRequested=false;
 await page.route('**/api/workouts/best?**',async route=>{
  const ids=new URL(route.request().url()).searchParams.get('variantIds').split(',');
  if(ids.includes('v1')){oldRequested=true;await gate;}
  const bestPerformance=Object.fromEntries(ids.map(id=>[id,[{weightKg:id===replacement.id?70:id===added.id?60:999,reps:8,logId:'old',finishedAt:'2026-11-01T11:00:00Z'}]]));
  await route.fulfill({json:{bestPerformance}});
 });
 await page.goto('/#/workouts/current-fixture');await expect.poll(()=>oldRequested).toBe(true);
 await page.getByRole('button',{name:'Swap exercise Bench e',exact:true}).click();const combo=page.getByRole('combobox',{name:'Exercise'});
 await combo.fill(replacement.name);await page.getByRole('option').filter({hasText:replacement.name}).first().click();
 await expect(page.locator('.log-best')).toContainText('70 kg × 8');
 release();await expect(page.locator('.log-best')).toContainText('70 kg × 8');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await combo.fill(added.name);await page.getByRole('option').filter({hasText:added.name}).first().click();
 await expect(page.locator('.log-best').nth(1)).toContainText('60 kg × 8');
});

test('finished-route navigation discards a delayed Best rejection',async({page})=>{
 await save(page,'first');await save(page,'next');let release;const gate=new Promise(r=>{release=r;});let requested=false;
 await page.route('**/api/workouts/best?**',async route=>{
  if(new URL(route.request().url()).searchParams.get('exclude')==='first'){
   requested=true;await gate;await route.fulfill({status:403,json:{error:{message:'Obsolete history denied'}}});
  }else await route.fulfill({json:{bestPerformance:{v1:[]}}});
 });
 await page.goto('/#/workouts/first');await expect.poll(()=>requested).toBe(true);
 await page.evaluate(()=>{location.hash='#/workouts/next';});await expect(page.locator('.log-best')).toHaveText('Best · No qualifying performance');
 release();await page.waitForResponse(response=>response.url().includes('/workouts/best?')&&response.status()===403);
 await expect(page.locator('#app-message')).not.toContainText('Obsolete history denied');await expect(page.locator('.log-best')).toHaveText('Best · No qualifying performance');
});

test('a delayed finish acknowledgement preserves the edited note until navigation',async({page})=>{
 await save(page,'current-fixture',{status:'active',note:'Initial context'});await page.goto('/#/workouts/current-fixture');
 let releaseFirst,releaseSecond;const firstGate=new Promise(r=>{releaseFirst=r;}),secondGate=new Promise(r=>{releaseSecond=r;});let saves=0;
 await page.route('**/api/workouts/current-fixture',async route=>{
  if(route.request().method()!=='PUT'||route.request().postDataJSON().log.status!=='finished')return route.continue();
  const number=++saves,response=await route.fetch();await(number===1?firstGate:secondGate);await route.fulfill({response});
 });
 await page.getByRole('button',{name:'Finish',exact:true}).click();
 await expect.poll(()=>saves).toBe(1);await page.getByRole('button',{name:'Edit workout note',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Workout note',exact:true});await input.fill('Edited while finishing');
 await input.evaluate(el=>{window.finishingNote=el;el.setSelectionRange(4,4);});releaseFirst();await expect.poll(()=>saves).toBe(2);
 await expect(input).toBeFocused();expect(await input.evaluate(el=>[el===window.finishingNote,el.selectionStart,el.selectionEnd])).toEqual([true,4,4]);
 releaseSecond();await expect(page).toHaveURL(/#\/workouts$/);
 expect((await (await page.request.get('/api/workouts/current-fixture')).json()).record.log.note).toBe('Edited while finishing');
});

for(const [width,height,touch,zoom] of [[360,800,true,1],[390,844,true,1],[768,1024,true,1],[1366,768,false,1],[1440,900,false,1],[1440,900,true,1],[1920,1080,false,1],[390,844,true,2]]){
 test.describe(`viewport ${width} text ${zoom} touch ${touch}`,()=>{
 test.use({viewport:{width,height},hasTouch:touch});
 test(`populated tracker layout ${width}×${height} text ${zoom}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height});
  const a=exercise('A long exercise name that wraps on small screens',target,[set(999.75,100)]),b=exercise('B long exercise name',target);
  a.superset={restBetweenSeconds:30,restAfterRoundSeconds:90};
  await save(page,'current-fixture',{status:'active',note:('Long workout context with line breaks.\n').repeat(45),exercises:[a,b]});
  await page.goto('/#/workouts/current-fixture');
  if(zoom===2)await page.addStyleTag({content:'html {font-size:200% !important}'});
  await expect(page.locator('.log-best').first()).toContainText('No qualifying performance');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const saved=page.getByRole('button',{name:'Edit workout note',exact:true});await expect(saved).toBeVisible();
  const finish=page.getByRole('button',{name:'Finish',exact:true});await expect(finish).toBeVisible();
  // Phones show the set inside the Focus feed rather than the compact card.
  const weight=page.getByRole('textbox',{name:'Set 1 weight, Bench '+a.id,exact:true});
  await weight.scrollIntoViewIfNeeded();
  await expect(weight).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('populated-tracker.png'),fullPage:true});
 });
 });
}
