import {test,expect} from '@playwright/test';

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
   cycle:{name:'Cycle',mode:'simple',goals:{},workouts:[w('a',null,'A'),w('b',null,'B'),w('c',null,'C')],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'},{type:'workout',workoutId:'c'}]}
  };
  window.expectedDuration=durationLabel(resolved.ppl.workouts[2]);
  const programList=[{id:'ppl',name:long+'PPL'},{id:'cycle',name:'Cycle'}],templateList=[{id:'t1',name:long+'Upper'}];
  const calls=window.calls={starts:[],loads:[],templateLoads:[],navigations:[],retries:[]};
  const failed=new Set();const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  window.openSheet=()=>openWorkoutStartSheet({
   programs:opts.programs===undefined?programList:opts.programs,
   templates:opts.templates===undefined?templateList:opts.templates,
   logs:[{source:{kind:'program',programId:'ppl',occurrenceId:'push',templateId:'t-push',programName:'PPL',templateName:'Push A'},startedAt:toLocalIso(new Date(2026,10,2,9))}],
   now:new Date(2026,10,4,10),
   loadProgram:async id=>{calls.loads.push(id);if(opts.delay?.[id])await sleep(opts.delay[id]);if(opts.failOnce?.includes(id)&&!failed.has(id)){failed.add(id);throw Error('Session template not found.');}return structuredClone(resolved[id]);},
   loadTemplate:async id=>{calls.templateLoads.push(id);if(opts.failTemplate)throw Error('offline');return {id,document:{name:long+'Upper',goals:{},exercises:[ex('A')]}};},
   onStart:options=>calls.starts.push(structuredClone(options)),
   onNavigate:hash=>calls.navigations.push(hash),
   onRetryList:async kind=>{calls.retries.push(kind);return kind==='program'?programList:templateList;}
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
