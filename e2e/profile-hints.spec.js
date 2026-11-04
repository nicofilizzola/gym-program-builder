import {test,expect} from '@playwright/test';
const headers={origin:'http://127.0.0.1:3199'};
const LIMITS={maxTrainingDaysPerWeek:1,availableWeekdays:[0],maxSessionsPerDay:1,maxSessionMinutes:20};

async function login(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
}
async function saveProfile(page,profile){
 const {revision}=await (await page.request.get('/api/profile')).json();
 expect((await page.request.put('/api/profile',{headers,data:{revision,profile}})).ok()).toBeTruthy();
}
const exercise=(name,sets,restSeconds)=>({name,sets,warmupSets:0,restSeconds,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]});
/** Mon: Long (30 min) + Short; Wed: Short. Week mode. */
async function seed(page){
 const create=async(kind,document)=>{const response=await page.request.post('/api/documents',{headers,data:{id:crypto.randomUUID(),kind,document}});expect(response.ok()).toBeTruthy();return (await response.json()).record;};
 const long=await create('template',{name:'Long push',goals:{},extraMinutes:0,bufferPercent:0,exercises:[exercise('Bench',5,300)]});
 const short=await create('template',{name:'Short pull',goals:{},extraMinutes:0,bufferPercent:0,exercises:[exercise('Row',1,60)]});
 const program=await create('program',{name:'Hint week',mode:'schedule',goals:{},workouts:[{id:'mon-long',templateId:long.id,day:0},{id:'mon-short',templateId:short.id,day:0},{id:'wed-short',templateId:short.id,day:2}]});
 return {program,long,short};
}
const day=(page,name)=>page.locator('.day-section').filter({has:page.getByRole('heading',{level:2,name,exact:true})});
const dayHint=(page,name)=>day(page,name).locator('[data-day-limit-hints] [data-limit-hint]');
const longCard=page=>page.locator('[data-workout="mon-long"]');

test.afterEach(async({page})=>{await saveProfile(page,{});});

test('program hints show long sessions, day limits and training days, and Sequence keeps only session length',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await login(page);await saveProfile(page,LIMITS);const {program}=await seed(page);
 await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
 const duration=longCard(page).locator('[data-workout-duration]');
 await expect(duration).toHaveText('Estimated duration ~30 min · over 20 min max (set in Profile)');
 await expect(page.locator('[data-workout="mon-short"] [data-workout-duration]')).toHaveText('Estimated duration ~2 min');
 const hint=duration.locator('[data-limit-hint]');
 // Keyboard, touch and screen-reader users get the Profile source as text; the visible text stays unchanged.
 await expect(hint.locator('.visually-hidden')).toHaveText('(set in Profile)');
 expect(await hint.evaluate(el=>el.innerText.replace(el.querySelector('.visually-hidden').innerText,'').trim())).toBe('over 20 min max');
 expect(await hint.locator('.visually-hidden').evaluate(el=>{const r=el.getBoundingClientRect();return r.width<=1&&r.height<=1;})).toBe(true);
 await hint.hover();await expect(page.getByRole('tooltip')).toHaveText('Longer than your max session length (Profile)');
 await page.mouse.move(0,0);
 await expect(dayHint(page,'Wednesday')).toHaveText('Not an available day');
 await expect(dayHint(page,'Monday')).toHaveText('2 sessions · max 1');
 await expect(dayHint(page,'Tuesday')).toHaveCount(0);
 const weekly=page.locator('[data-weekly-panel] [data-limit-hint]');
 await expect(weekly).toHaveText('2 training days · max 1');
 // Hints never transition and carry text, not just colour.
 for(const el of [hint,weekly,dayHint(page,'Wednesday')])await expect(el).toHaveCSS('transition-duration','0s');
 expect(await page.locator('.program-file-actions [data-limit-hint]').count()).toBe(0);

 await page.locator('label').filter({hasText:'Sequence'}).click();
 await expect(page.locator('.week-agenda')).toHaveCount(0);
 await expect(page.locator('[data-day-limit-hints]')).toHaveCount(0);
 await expect(weekly).toHaveCount(0);
 await expect(duration).toHaveText('Estimated duration ~30 min · over 20 min max (set in Profile)');
});

for(const [width,height] of [[1366,768],[1440,900]]){
 test(`Week day hints sit in the content column and add at most one hint line at ${width}x${height} (regression: label-column wrap)`,async({page})=>{
  await page.setViewportSize({width,height});
  await login(page);await saveProfile(page,{});const {program}=await seed(page);
  await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
  const rowHeight=name=>day(page,name).evaluate(el=>el.getBoundingClientRect().height);
  const plain={Monday:await rowHeight('Monday'),Wednesday:await rowHeight('Wednesday')};
  await saveProfile(page,LIMITS);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(dayHint(page,'Wednesday')).toHaveText('Not an available day');
  await expect(dayHint(page,'Monday')).toHaveText('2 sessions · max 1');
  for(const name of ['Monday','Wednesday']){
   const m=await day(page,name).evaluate(section=>{
    const hints=section.querySelector('[data-day-limit-hints]'),hint=hints.querySelector('[data-limit-hint]'),label=section.querySelector('h2'),list=section.querySelector('.workout-list');
    const r=el=>el.getBoundingClientRect(),style=getComputedStyle(hint);
    return {row:r(section).height,line:parseFloat(style.lineHeight),padding:parseFloat(getComputedStyle(hints).paddingBottom),
     hintHeight:r(hint).height,hintLeft:r(hints).left,hintRight:r(hints).right,labelRight:r(label).right,listLeft:r(list).left,sectionRight:r(section).right,
     overflow:hints.scrollWidth>hints.clientWidth||hint.scrollWidth>hint.clientWidth};
   });
   // Single line, in the content column (aligned with the cards, right of the label), never overflowing.
   expect(m.hintHeight).toBeLessThan(m.line*1.5);
   expect(m.hintLeft).toBeGreaterThanOrEqual(m.labelRight);
   expect(Math.abs(m.hintLeft-m.listLeft)).toBeLessThanOrEqual(1);
   expect(m.hintRight).toBeLessThanOrEqual(m.sectionRight+0.5);
   expect(m.overflow).toBe(false);
   // At most one hint line (plus the hints' bottom padding) taller than the same row without hints.
   expect(m.row-plain[name]).toBeLessThanOrEqual(m.line+m.padding+1);
  }
 });
}

test('shared editor duration readout shows the over-max suffix live without motion',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await login(page);await saveProfile(page,LIMITS);const {program}=await seed(page);
 await page.goto(`/#/programs/${program.id}/workouts/mon-long`);await expect(page.getByLabel('Session template name')).toHaveValue('Long push');
 const total=page.locator('.duration-toggle');
 await expect(total.locator('[data-duration-total]')).toHaveText('~30 min');
 const suffix=total.locator('[data-limit-hint]');
 await expect(suffix).toHaveText('over 20 min max (set in Profile)');await expect(suffix).toHaveCSS('transition-duration','0s');
 await expect(suffix.locator('.visually-hidden')).toHaveText('(set in Profile)');
 await expect(total).toHaveAccessibleDescription('~30 min over 20 min max (set in Profile)');
 await page.getByRole('button',{name:'Expand all',exact:true}).click();
 const sets=page.getByRole('slider',{name:'Sets',exact:true}).first();
 await sets.focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
 await expect(total.locator('[data-duration-total]')).toHaveText('~18 min');await expect(suffix).toHaveCount(0);
 await page.keyboard.press('ArrowRight');
 await expect(total.locator('[data-duration-total]')).toHaveText('~24 min');await expect(total.locator('[data-limit-hint]')).toHaveText('over 20 min max (set in Profile)');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 // Returning to the program reflects the edited duration.
 await page.goto('/#/programs/'+program.id);
 await expect(longCard(page).locator('[data-workout-duration]')).toHaveText('Estimated duration ~24 min · over 20 min max (set in Profile)');
});

test('saving the profile and returning shows fresh hints',async({page})=>{
 await login(page);await saveProfile(page,{});const {program}=await seed(page);
 await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await saveProfile(page,LIMITS);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('[data-weekly-panel] [data-limit-hint]')).toHaveText('2 training days · max 1');
 await expect(longCard(page).locator('[data-limit-hint]')).toHaveText('over 20 min max (set in Profile)');
});

test('a failed profile load renders no hints and editing still saves',async({page})=>{
 await login(page);await saveProfile(page,LIMITS);const {program}=await seed(page);
 await page.route('**/api/profile',route=>route.request().method()==='GET'?route.fulfill({status:500,json:{error:{message:'Profile unavailable'}}}):route.continue());
 await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
 await expect(longCard(page).locator('[data-workout-duration]')).toHaveText('Estimated duration ~30 min');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await expect(page.locator('#app-message')).toHaveText('');
 await page.getByLabel('Program name',{exact:true}).fill('Hint week edited');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.goto(`/#/programs/${program.id}/workouts/mon-long`);await expect(page.getByLabel('Session template name')).toHaveValue('Long push');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await page.getByLabel('Session template name').fill('Long push edited');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.unroute('**/api/profile');
});

test('an empty profile renders no hint elements',async({page})=>{
 await login(page);await saveProfile(page,{});const {program,long}=await seed(page);
 await page.goto('/#/programs/'+program.id);await expect(longCard(page).locator('[data-workout-duration]')).toHaveText('Estimated duration ~30 min');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await page.goto('/#/templates/'+long.id);await expect(page.getByLabel('Session template name')).toHaveValue('Long push');
 await expect(page.locator('[data-duration-total]')).toHaveText('~30 min');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
});

test('a hung profile request never blocks program or editor routes; hints appear once it settles',async({page})=>{
 await login(page);await saveProfile(page,LIMITS);const {program,long}=await seed(page);
 const held=[];
 await page.route('**/api/profile',route=>{if(route.request().method()!=='GET')return route.continue();held.push(route);});
 await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
 await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await page.getByLabel('Program name',{exact:true}).fill('Hint week held');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect.poll(()=>held.length).toBeGreaterThan(0);
 for(const route of held.splice(0))await route.continue();
 await expect(page.locator('[data-weekly-panel] [data-limit-hint]')).toHaveText('2 training days · max 1');
 await expect(longCard(page).locator('[data-limit-hint]')).toHaveText('over 20 min max (set in Profile)');
 await page.goto('/#/templates/'+long.id);await expect(page.getByLabel('Session template name')).toHaveValue('Long push');
 await expect(page.locator('[data-limit-hint]')).toHaveCount(0);
 await page.getByLabel('Session template name').fill('Long push held');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect.poll(()=>held.length).toBeGreaterThan(0);
 for(const route of held.splice(0))await route.continue();
 await expect(page.locator('.duration-toggle [data-limit-hint]')).toHaveText('over 20 min max (set in Profile)');
 await page.unroute('**/api/profile');
});

test('an older profile response never replaces a newer one',async({page})=>{
 await login(page);await saveProfile(page,LIMITS);const {program}=await seed(page);
 const held=[];
 await page.route('**/api/profile',route=>{if(route.request().method()==='GET'&&!held.length){held.push(route);return;}return route.continue();});
 await page.goto('/#/programs/'+program.id);await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Hint week');
 await expect.poll(()=>held.length).toBe(1);
 // A newer focus revalidation answers first with the saved limits.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('[data-weekly-panel] [data-limit-hint]')).toHaveText('2 training days · max 1');
 // The stale route-entry response (no limits) arrives last and must be ignored.
 await held[0].fulfill({json:{revision:0,profile:{}}});
 await page.waitForTimeout(300);
 await expect(page.locator('[data-weekly-panel] [data-limit-hint]')).toHaveText('2 training days · max 1');
 await expect(longCard(page).locator('[data-limit-hint]')).toHaveText('over 20 min max (set in Profile)');
 await page.unroute('**/api/profile');
});
