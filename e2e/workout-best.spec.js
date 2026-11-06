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
  await page.locator('.log-exercise').first().scrollIntoViewIfNeeded();
  await expect(page.getByRole('textbox',{name:'Set 1 weight, Bench '+a.id,exact:true})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('populated-tracker.png'),fullPage:true});
 });
 });
}
