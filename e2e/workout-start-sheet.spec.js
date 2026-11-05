import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,saveFinishedLog,headers} from './workout-helper.js';

/**
 * Mounts the start sheet on a bare page with fixture data (no sign-in, no API).
 * now = Wednesday 2026-11-04 10:00 local; PPL has Push A logged on Monday, so Up next is Legs A (Thu).
 */
async function mountSheet(page,opts={}){
 await page.goto('/');
 await page.evaluate(async opts=>{
  const {openWorkoutStartSheet}=await import('/src/workout-start-sheet.js');
  const {toLocalIso}=await import('/src/workout-log.js');
  const {durationLabel}=await import('/src/duration.js');
  document.body.innerHTML='<main><button id="opener" type="button">Start workout</button></main>';
  const long=opts.long?'x'.repeat(116)+' ':'';
  const ex=name=>({name,sets:3,repRange:{min:8,max:12},restSeconds:90,warmupSets:0,primaryMuscles:['Chest'],secondaryMuscles:[]});
  const w=(id,day,name)=>({id,templateId:'t-'+id,day,name,goals:{},exercises:[ex('A'),ex('B')],extraMinutes:5,bufferPercent:10});
  const resolved={
   ppl:{name:long+'PPL',mode:'schedule',goals:{},workouts:[w('push',0,long+'Push A'),w('pull',1,'Pull A'),w('legs',3,'Legs A'),w('arms',null,'Arms')]},
   loose:{name:'Loose',mode:'schedule',goals:{},workouts:[w('x',null,'X')]},
   cycle:{name:'Cycle',mode:'simple',goals:{},workouts:[w('a',null,'A'),w('b',null,'B'),w('c',null,'C')],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'},{type:'workout',workoutId:'c'}]}
  };
  window.expectedDuration=durationLabel(resolved.ppl.workouts[2]);
  const programList=[{id:'ppl',name:long+'PPL'},{id:'cycle',name:'Cycle'}],templateList=[{id:'t1',name:long+'Upper'}];
  const calls=window.calls={starts:[],loads:[],templateLoads:[],navigations:[],retries:[],activations:[]};
  const failed=new Set();const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  window.openSheet=()=>openWorkoutStartSheet({
   programs:opts.programs===undefined?programList:opts.programs,
   templates:opts.templates===undefined?templateList:opts.templates,
   logs:[{source:{kind:'program',programId:'ppl',occurrenceId:'push',templateId:'t-push',programName:'PPL',templateName:'Push A'},startedAt:toLocalIso(new Date(2026,10,2,9))}],
   now:new Date(2026,10,4,10),
   loadProgram:async id=>{calls.loads.push(id);if(opts.delay?.[id])await sleep(opts.delay[id]);if(opts.failOnce?.includes(id)&&!failed.has(id)){failed.add(id);throw Error('Session template not found.');}return structuredClone(resolved[id]);},
   loadTemplate:async id=>{calls.templateLoads.push(id);if(opts.templateDelay)await sleep(opts.templateDelay);if(opts.failTemplate)throw Error('offline');return {id,document:{name:long+'Upper',goals:{},exercises:[ex('A')]}};},
   onStart:options=>calls.starts.push(structuredClone(options)),
   onNavigate:hash=>calls.navigations.push(hash),
   onRetryList:async kind=>{calls.retries.push(kind);return kind==='program'?programList:templateList;},
   activeProgramId:opts.activeProgramId===undefined?'ppl':opts.activeProgramId,
   onActivate:async id=>{calls.activations.push(id);await sleep(50);if(opts.activateFails)throw Error('offline');return {activeProgramId:id};}
  });
  document.querySelector('#opener').addEventListener('click',()=>window.openSheet());
 },opts);
}
const sheet=page=>page.locator('dialog.start-sheet[open]');
const open=async page=>{await page.locator('#opener').click();await expect(sheet(page)).toBeVisible();};
const calls=page=>page.evaluate(()=>window.calls);

test('up next starts in one tap',async({page})=>{
 await mountSheet(page);await open(page);
 const card=page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true});
 await expect(card).toBeFocused();
 const duration=await page.evaluate(()=>window.expectedDuration);
 await expect(card).toContainText(`Thu · 2 exercises · ${duration}`);
 await card.click();
 await expect(sheet(page)).toHaveCount(0);
 const {starts}=await calls(page);
 expect(starts).toHaveLength(1);
 expect(starts[0].template.id).toBe('t-legs');
 expect(starts[0].template.document.name).toBe('Legs A');
 expect(starts[0].program).toEqual({id:'ppl',name:'PPL'});
 expect(starts[0].occurrenceId).toBe('legs');
 await expect(page.locator('#opener')).toBeFocused();
});

test('program list expands and starts any session',async({page})=>{
 await mountSheet(page,{delay:{cycle:200}});await open(page);
 const ppl=page.getByRole('button',{name:/^PPL/}),cycle=page.getByRole('button',{name:/^Cycle/});
 await expect(ppl).toHaveAttribute('aria-expanded','true');
 await expect(cycle).toHaveAttribute('aria-expanded','false');
 await cycle.click();
 await expect(cycle).toHaveAttribute('aria-expanded','true');
 await expect(sheet(page).getByText('Loading…')).toBeVisible();
 const c=page.getByRole('button',{name:'Start C, Cycle, Day 3',exact:true});
 await expect(c).toContainText('Day 3');
 await expect(page.getByRole('button',{name:'Start A, Cycle, Day 1',exact:true})).toBeVisible();
 await c.click();
 await expect(sheet(page)).toHaveCount(0);
 const {starts}=await calls(page);
 expect(starts[0].occurrenceId).toBe('c');
 expect(starts[0].program).toEqual({id:'cycle',name:'Cycle'});
});

test('week list order and unscheduled',async({page})=>{
 await mountSheet(page);await open(page);
 const region=sheet(page).locator('#'+await page.getByRole('button',{name:/^PPL/}).getAttribute('aria-controls'));
 await expect(region.locator('.start-sheet-session-name')).toHaveText(['Push A','Pull A','Legs A','Arms']);
 await expect(region.getByText('Unscheduled',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Start Arms, PPL, Unscheduled',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start Push A, PPL, Monday',exact:true})).toContainText('Mon');
});

test('template tab and blank',async({page})=>{
 await mountSheet(page);await open(page);
 const programTab=page.getByRole('tab',{name:'Program'}),templateTab=page.getByRole('tab',{name:'Template'});
 await expect(programTab).toHaveAttribute('aria-selected','true');
 await programTab.focus();await page.keyboard.press('ArrowRight');
 await expect(templateTab).toBeFocused();
 await expect(templateTab).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('Home');
 await expect(programTab).toHaveAttribute('aria-selected','true');
 await templateTab.click();
 await page.getByRole('button',{name:'Start Upper',exact:true}).click();
 await expect(sheet(page)).toHaveCount(0);
 let result=await calls(page);
 expect(result.templateLoads).toEqual(['t1']);
 expect(result.starts[0]).toEqual({template:{id:'t1',document:{name:'Upper',goals:{},exercises:[{name:'A',sets:3,repRange:{min:8,max:12},restSeconds:90,warmupSets:0,primaryMuscles:['Chest'],secondaryMuscles:[]}]}}});
 await open(page);
 await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 await expect(sheet(page)).toHaveCount(0);
 result=await calls(page);
 expect(result.starts[1]).toEqual({});
});

test('template load failure keeps sheet open',async({page})=>{
 await mountSheet(page,{failTemplate:true});await open(page);
 await page.getByRole('tab',{name:'Template'}).click();
 const row=page.getByRole('button',{name:'Start Upper',exact:true});
 await row.click();
 await expect(sheet(page).getByRole('alert')).toHaveText("Couldn't load this template. Try again.");
 await expect(sheet(page)).toBeVisible();
 await expect(row).toBeEnabled();
 await expect(page.getByRole('button',{name:'Blank workout',exact:true})).toBeEnabled();
 expect((await calls(page)).starts).toHaveLength(0);
});

test('double tap starts once',async({page})=>{
 await mountSheet(page);await open(page);
 await page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true}).evaluate(card=>{card.click();card.click();});
 await expect(sheet(page)).toHaveCount(0);
 await page.waitForTimeout(100);
 expect((await calls(page)).starts).toHaveLength(1);
});

test('Escape, backdrop and Close return focus',async({page})=>{
 await mountSheet(page);
 await open(page);await page.keyboard.press('Escape');
 await expect(sheet(page)).toHaveCount(0);await expect(page.locator('#opener')).toBeFocused();
 await open(page);await page.mouse.click(4,4);
 await expect(sheet(page)).toHaveCount(0);await expect(page.locator('#opener')).toBeFocused();
 await open(page);await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(sheet(page)).toHaveCount(0);await expect(page.locator('#opener')).toBeFocused();
 expect((await calls(page)).starts).toHaveLength(0);
});

test('empty states',async({page})=>{
 await mountSheet(page,{programs:[],templates:[]});await open(page);
 await expect(page.getByRole('tab',{name:'Template'})).toHaveAttribute('aria-selected','true');
 await expect(sheet(page).getByText('No session templates yet.')).toBeVisible();
 await page.getByRole('tab',{name:'Program'}).click();
 await expect(sheet(page).getByText('No programs yet.')).toBeVisible();
 await page.getByRole('link',{name:'Go to Programs'}).click();
 await expect(sheet(page)).toHaveCount(0);
 expect((await calls(page)).navigations).toEqual(['#/programs']);
});

test('list failure retry',async({page})=>{
 await mountSheet(page,{programs:null});await open(page);
 await expect(page.getByRole('tab',{name:'Program'})).toHaveAttribute('aria-selected','true');
 await expect(sheet(page).getByText("Couldn't load programs.")).toBeVisible();
 await sheet(page).getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByRole('button',{name:/^PPL/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true})).toBeVisible();
 expect((await calls(page)).retries).toEqual(['program']);
});

test('loader rejection shows row error and retry',async({page})=>{
 await mountSheet(page,{failOnce:['cycle']});await open(page);
 await page.getByRole('button',{name:/^Cycle/}).click();
 const region=sheet(page).locator('#'+await page.getByRole('button',{name:/^Cycle/}).getAttribute('aria-controls'));
 await expect(region.getByRole('alert')).toHaveText("Couldn't load this program.");
 await region.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start B, Cycle, Day 2',exact:true})).toBeVisible();
});

test('loadProgram is called once per program',async({page})=>{
 await mountSheet(page,{delay:{ppl:600}});await open(page);
 const ppl=page.getByRole('button',{name:/^PPL/});
 await ppl.click();await ppl.click();
 await expect(page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true})).toBeVisible();
 expect((await calls(page)).loads.filter(id=>id==='ppl')).toHaveLength(1);
});

test('rapid reopen keeps one open sheet',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mountSheet(page);await open(page);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.openSheet());
 await page.waitForTimeout(400);
 await expect(sheet(page)).toHaveCount(1);
 await page.getByRole('tab',{name:'Template'}).click();
 await expect(page.getByRole('button',{name:'Start Upper',exact:true})).toBeVisible();
});

test('long names wrap at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await mountSheet(page,{long:true});await open(page);
 await expect(page.getByRole('button',{name:/^Up next: Legs A/})).toBeVisible();
 const sizes=await sheet(page).evaluate(d=>({page:document.documentElement.scrollWidth,dialog:d.scrollWidth,client:d.clientWidth}));
 expect(sizes.page).toBeLessThanOrEqual(320);
 expect(sizes.dialog).toBeLessThanOrEqual(sizes.client);
 await page.getByRole('tab',{name:'Template'}).click();
 expect(await sheet(page).evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
});

test('bottom sheet layout and swipe close',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mountSheet(page);await open(page);
 await page.waitForTimeout(300);
 const box=await sheet(page).boundingBox();
 expect(Math.abs(box.y+box.height-844)).toBeLessThanOrEqual(1);
 expect(box.width).toBeGreaterThanOrEqual(388);
 const handle=await sheet(page).locator('.start-sheet-handle').boundingBox(),x=handle.x+handle.width/2,y=handle.y+handle.height/2;
 const drag=async dy=>{await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=6;i++){await page.mouse.move(x,y+dy*i/6);await page.waitForTimeout(40);}await page.mouse.up();};
 await drag(30);await page.waitForTimeout(300);
 await expect(sheet(page)).toBeVisible();
 expect(Math.abs((await sheet(page).boundingBox()).y-box.y)).toBeLessThanOrEqual(1);
 await drag(120);
 await expect(sheet(page)).toHaveCount(0);
 await expect(page.locator('#opener')).toBeFocused();
});

test('desktop dialog layout',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await mountSheet(page);await open(page);
 const box=await sheet(page).boundingBox();
 expect(box.width).toBeLessThanOrEqual(480);
 expect(Math.abs(box.x-(1366-box.x-box.width))).toBeLessThanOrEqual(2);
});

test('reduced motion opens and closes without pending motion classes',async({page})=>{
 await mountSheet(page);await open(page);
 await page.waitForTimeout(50);
 expect(await sheet(page).evaluate(d=>d.classList.contains('is-entering')||d.classList.contains('is-closing'))).toBe(false);
 await page.keyboard.press('Escape');
 expect(await page.locator('dialog.start-sheet').count()).toBe(0);
});

test('closing while a template loads starts nothing',async({page})=>{
 await mountSheet(page,{templateDelay:400});await open(page);
 await page.getByRole('tab',{name:'Template'}).click();
 await page.getByRole('button',{name:'Start Upper',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(sheet(page)).toHaveCount(0);
 await page.waitForTimeout(700);
 expect((await calls(page)).starts).toHaveLength(0);
});

test('template failure keeps focus on the row',async({page})=>{
 await mountSheet(page,{failTemplate:true});await open(page);
 await page.getByRole('tab',{name:'Template'}).click();
 const row=page.getByRole('button',{name:'Start Upper',exact:true});
 await row.focus();await page.keyboard.press('Enter');
 await expect(sheet(page).getByRole('alert')).toBeVisible();
 await expect(row).toBeFocused();
});

test('edge taps inside the bottom sheet keep it open',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mountSheet(page);await open(page);
 expect(await sheet(page).evaluate(d=>getComputedStyle(d).paddingLeft)).toBe('0px');
 const box=await sheet(page).boundingBox();
 await page.mouse.click(box.x+8,box.y+box.height/2);
 await page.mouse.click(box.x+box.width/2,box.y+box.height-6);
 await expect(sheet(page)).toBeVisible();
});

// App-level: the sheet on #/workouts with the real API.
const weekdayToday=()=>(new Date().getDay()+6)%7;
async function setupApp(page,days=[weekdayToday()]){
 await login(page);await resetWorkouts(page);
 await page.reload();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const tag=crypto.randomUUID().slice(0,6),program='Plan '+tag,names=days.map((_,i)=>`Session ${i+1} ${tag}`);
 const templates=[];for(const name of names)templates.push(await createLinkedTemplate(page,name));
 const programId=crypto.randomUUID(),workouts=days.map((day,i)=>({id:'occ'+i,templateId:templates[i].id,day}));
 const response=await page.request.post('/api/documents',{headers,data:{id:programId,kind:'program',document:{name:program,mode:'schedule',goals:{},workouts}}});
 expect(response.ok()).toBeTruthy();
 // The user follows this program: Up next comes only from the active program.
 expect((await page.request.put('/api/settings/active-program',{headers,data:{programId}})).ok()).toBeTruthy();
 return {program,programId,names,templates,tag};
}
async function openFromWorkouts(page){
 await page.goto('/#/workouts');
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await expect(sheet(page)).toBeVisible();
}
async function expectLoggerNamed(page,name){
 await expect(page).toHaveURL(/#\/workouts\/[\w-]+$/);
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue(name);
}
async function discardCurrent(page){
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Discard workout',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard workout?'}).getByRole('button',{name:'Discard workout'}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
}

test('start from the sheet lands in the logger',async({page})=>{
 const {program,names}=await setupApp(page);
 await openFromWorkouts(page);
 await page.getByRole('button',{name:`Up next: ${names[0]}, ${program}`,exact:true}).click();
 await expectLoggerNamed(page,names[0]);
 await discardCurrent(page);
});

test('up next advances after a finished session',async({page})=>{
 const today=weekdayToday();
 const {program,programId,names,templates}=await setupApp(page,[today,(today+1)%7]);
 await openFromWorkouts(page);
 await expect(page.getByRole('button',{name:`Up next: ${names[0]}, ${program}`,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await saveFinishedLog(page,{name:names[0],startedAt:new Date(Date.now()-60*60000).toISOString(),source:{kind:'program',programId,occurrenceId:'occ0',templateId:templates[0].id,programName:program,templateName:names[0]}});
 await page.reload();
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await expect(page.getByRole('button',{name:`Up next: ${names[1]}, ${program}`,exact:true})).toBeVisible();
});

test('template and blank from the sheet',async({page})=>{
 const {names}=await setupApp(page);
 await openFromWorkouts(page);
 await page.getByRole('tab',{name:'Template'}).click();
 await page.getByRole('button',{name:`Start ${names[0]}`,exact:true}).click();
 await expectLoggerNamed(page,names[0]);
 await discardCurrent(page);
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 await expectLoggerNamed(page,'Workout');
 await discardCurrent(page);
});

test('active workout prompts before a second start',async({page})=>{
 const {names}=await setupApp(page);
 await openFromWorkouts(page);
 await page.getByRole('button',{name:'Blank workout',exact:true}).click();
 await expectLoggerNamed(page,'Workout');
 await page.goto('/#/workouts');
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('tab',{name:'Template'}).click();
 await page.getByRole('button',{name:`Start ${names[0]}`,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Workout in progress'});
 await expect(dialog.getByRole('button',{name:'Resume current'})).toBeVisible();
 await dialog.getByRole('button',{name:'Resume current'}).click();
 await expectLoggerNamed(page,'Workout');
 await discardCurrent(page);
});

test('offline lists show retry',async({page})=>{
 const {program}=await setupApp(page);
 await page.route('**/api/documents?kind=program*',route=>route.abort('internetdisconnected'));
 await page.goto('/#/workouts');
 await expect(page.getByRole('heading',{name:'Workouts',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await expect(sheet(page).getByText("Couldn't load programs.")).toBeVisible();
 await page.unroute('**/api/documents?kind=program*');
 await sheet(page).getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByRole('button',{name:new RegExp('^'+program)})).toBeVisible();
});

test('a server error on a list keeps history and offers retry',async({page})=>{
 const {names}=await setupApp(page);
 await page.route('**/api/documents?kind=template*',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'SERVER',message:'Something went wrong.'}})}));
 await page.goto('/#/workouts');
 await expect(page.getByRole('heading',{name:'Workouts',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('tab',{name:'Template'}).click();
 await expect(sheet(page).getByText("Couldn't load session templates.")).toBeVisible();
 await page.unroute('**/api/documents?kind=template*');
 await sheet(page).getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByRole('button',{name:`Start ${names[0]}`,exact:true})).toBeVisible();
});

// Search (2026-11-05): one field filters the visible tab; the query is shared by both tabs.
const twoTemplates=[{id:'t1',name:'Upper'},{id:'t2',name:'Pull B'}];
const search=page=>sheet(page).getByRole('searchbox',{name:'Search sessions'});

test('search filters templates and program sessions, keeping the query across tabs',async({page})=>{
 await mountSheet(page,{templates:twoTemplates});await open(page);
 await expect(page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true})).toBeFocused();
 await sheet(page).getByRole('tab',{name:'Template'}).click();
 await search(page).fill('pull');
 await expect(sheet(page).getByRole('button',{name:/^Start /})).toHaveText(['Pull B']);
 await sheet(page).getByRole('tab',{name:'Program'}).click();
 await expect(search(page)).toHaveValue('pull');
 const panel=sheet(page).locator('[data-panel=program]');
 await expect(panel.getByRole('button',{name:/^Up next/})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:/^Start /})).toHaveCount(1);
 await expect(panel.getByRole('button',{name:'Start Pull A, PPL, Tuesday',exact:true})).toBeVisible();
 await expect(panel.locator('.start-sheet-group')).toHaveText(['PPL Active']);
 await search(page).fill('cycle');
 await expect(panel.getByRole('button',{name:/^Start /})).toHaveCount(3);
 await search(page).fill('zzz');
 await expect(panel).toContainText('No sessions match "zzz".');
 await sheet(page).getByRole('tab',{name:'Template'}).click();
 await expect(sheet(page).locator('[data-panel=template]')).toContainText('No templates match "zzz".');
});

test('Escape clears the search first, then closes the sheet; clearing restores the disclosures',async({page})=>{
 await mountSheet(page);await open(page);
 await search(page).fill('legs');
 await search(page).press('Escape');
 await expect(search(page)).toHaveValue('');await expect(sheet(page)).toBeVisible();
 await expect(page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true})).toBeVisible();
 await expect(toggle(page,'PPL')).toHaveAttribute('aria-expanded','true');
 await search(page).press('Escape');
 await expect(sheet(page)).toHaveCount(0);
});

test('a program that fails to load shows Retry while the others still match',async({page})=>{
 await mountSheet(page,{failOnce:['cycle']});await open(page);
 await search(page).fill('a');
 const panel=sheet(page).locator('[data-panel=program]');
 await expect(panel).toContainText("Couldn't search Cycle.");
 await expect(panel.getByRole('button',{name:'Start Legs A, PPL, Thursday',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Retry'}).click();
 await expect(panel.getByRole('button',{name:'Start A, Cycle, Day 1',exact:true})).toBeVisible();
 await expect(panel).not.toContainText("Couldn't search Cycle.");
});

test('starting from a search result disables the field while it starts',async({page})=>{
 await mountSheet(page,{templates:twoTemplates,templateDelay:400});await open(page);
 await sheet(page).getByRole('tab',{name:'Template'}).click();
 await search(page).fill('upper');
 await sheet(page).getByRole('button',{name:'Start Upper',exact:true}).click();
 await expect(search(page)).toBeDisabled();
 await expect(sheet(page)).toHaveCount(0);
 expect((await calls(page)).starts).toHaveLength(1);
});

test('Retry in search results keeps focus, shows Searching… and never a false empty message',async({page})=>{
 await mountSheet(page,{failOnce:['cycle'],delay:{cycle:400}});await open(page);
 await search(page).fill('cycle');
 const panel=sheet(page).locator('[data-panel=program]');
 await expect(panel).toContainText("Couldn't search Cycle.");
 await panel.getByRole('button',{name:'Retry'}).click();
 await expect(panel.getByRole('status')).toHaveText('Searching…');
 await expect(search(page)).toBeFocused();
 await expect(panel.getByText('No sessions match')).toBeHidden();
 await expect(panel.getByRole('button',{name:/^Start /})).toHaveCount(3);
 await expect(panel.getByText('No sessions match')).toBeHidden();
 await expect(panel.getByRole('status')).toHaveCount(0);
});

// Active program (2026-11-05): Up next comes only from the active program.
const toggle=(page,name)=>sheet(page).locator('.start-sheet-program-toggle').filter({hasText:name});

test('the active program is listed first, expanded, and alone feeds Up next',async({page})=>{
 await mountSheet(page,{activeProgramId:'cycle'});await open(page);
 await expect(page.getByRole('button',{name:'Up next: A, Cycle',exact:true})).toBeFocused();
 await expect(sheet(page).locator('.start-sheet-program-toggle')).toHaveText(['Cycle Active','PPL']);
 await expect(toggle(page,'Cycle')).toHaveAttribute('aria-expanded','true');
 await expect(toggle(page,'PPL')).toHaveAttribute('aria-expanded','false');
});

test('with no active program the sheet offers the suggested program in one tap',async({page})=>{
 await mountSheet(page,{activeProgramId:null});await open(page);
 const panel=sheet(page).locator('[data-panel=program]');
 await expect(panel.getByRole('button',{name:/^Up next/})).toHaveCount(0);
 await expect(panel).toContainText('No active program');
 await panel.getByRole('button',{name:'Make PPL active',exact:true}).click();
 await expect(page.getByRole('button',{name:'Up next: Legs A, PPL',exact:true})).toBeFocused();
 await expect(sheet(page).getByRole('button',{name:'PPL Active',exact:true})).toBeVisible();
 await expect(panel).not.toContainText('No active program');
 expect((await calls(page)).activations).toEqual(['ppl']);
});

test('a failed activation keeps the line with an error',async({page})=>{
 await mountSheet(page,{activeProgramId:null,activateFails:true});await open(page);
 const panel=sheet(page).locator('[data-panel=program]'),make=panel.getByRole('button',{name:'Make PPL active',exact:true});
 await make.click();
 await expect(panel.getByRole('alert')).toHaveText("Couldn't set the active program.");
 await expect(make).toBeEnabled();
});

test('an active program that no longer exists behaves as none',async({page})=>{
 await mountSheet(page,{activeProgramId:'gone'});await open(page);
 await expect(sheet(page).getByRole('button',{name:'Make PPL active',exact:true})).toBeVisible();
});

test('an active program with only Unscheduled sessions shows no Up next and no Make-active line',async({page})=>{
 await mountSheet(page,{activeProgramId:'loose',programs:[{id:'ppl',name:'PPL'},{id:'loose',name:'Loose'}]});await open(page);
 const panel=sheet(page).locator('[data-panel=program]');
 await expect(toggle(page,'Loose')).toHaveAttribute('aria-expanded','true');
 await expect(panel.getByRole('button',{name:'Start X, Loose, Unscheduled',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:/^Up next/})).toHaveCount(0);
 await expect(panel).not.toContainText('No active program');
});

test('Make active is disabled while a start is in progress',async({page})=>{
 await mountSheet(page,{activeProgramId:null,templateDelay:400});await open(page);
 await sheet(page).getByRole('tab',{name:'Template'}).click();
 await sheet(page).getByRole('button',{name:'Start Upper',exact:true}).click();
 await expect(sheet(page).getByRole('button',{name:'Make PPL active',exact:true,includeHidden:true})).toBeDisabled();
});

test('activating a program without an Up next moves focus to its disclosure',async({page})=>{
 await mountSheet(page,{activeProgramId:null,programs:[{id:'loose',name:'Loose'}]});await open(page);
 await sheet(page).getByRole('button',{name:'Make Loose active',exact:true}).click();
 await expect(sheet(page).getByRole('button',{name:'Loose Active',exact:true})).toBeFocused();
});
