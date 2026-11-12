import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers,saveFinishedLog} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';
import {finishWorkout} from '../src/workout-edit.js';

const makeId=()=>crypto.randomUUID();

/** An active log from a 3-set template; returns the first exercise name. */
async function setup(page,weight='999.75'){
 await login(page);await resetWorkouts(page);
 const {id}=await createLinkedTemplate(page,'Push A');
 const template=(await (await page.request.get(`/api/documents/${id}`)).json()).record;
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template});
 const response=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(response.ok(),await response.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 await expect(page.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 const name=log.exercises[0].name;
 await page.getByLabel(`Set 1 weight, ${name}`,{exact:true}).fill(weight);
 await page.getByLabel(`Set 1 reps, ${name}`,{exact:true}).fill('100');
 return name;
}

/** A finished 3-set log: the compact editor phones still use while active workouts show Focus. */
async function setupFinished(page,weight){
 await login(page);await resetWorkouts(page);
 const {id}=await saveFinishedLog(page,{name:'Push A',startedAt:'2026-11-01T10:00:00'});
 await page.goto('/#/workouts/'+id);
 const name='Bench press';
 await page.getByLabel(`Set 1 weight, ${name}`,{exact:true}).fill(weight);
 await page.getByLabel(`Set 1 reps, ${name}`,{exact:true}).fill('100');
 return name;
}

/** Geometry of every set row in the first card. */
const measure=(page,name)=>page.evaluate(exerciseName=>{
 const card=[...document.querySelectorAll('.log-exercise')].find(el=>el.querySelector('h2').textContent===exerciseName).querySelector('.log-exercise-card');
 const cs=getComputedStyle(card),box=card.getBoundingClientRect();
 const inner={left:box.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft),right:box.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight)};
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 return {card:rect(card),inner,rows:[...card.querySelectorAll('.log-set')].map(li=>{
  const row=li.querySelector('.log-set-row'),q=s=>row.querySelector(s);
  const inputs=[...row.querySelectorAll('.log-stepper input')];
  const all=[...row.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().width>0).map(el=>el.getBoundingClientRect().right);
  const caption=q('.log-rir-label');
  return {row:rect(row),num:rect(q('.log-set-number')),captionShown:getComputedStyle(caption).display!=='none',steps:[...row.querySelectorAll('.log-step')].map(rect),options:[...row.querySelectorAll('.log-rir-option')].map(rect),li:rect(li),weight:rect(q('[data-kind="weight"]')),reps:rect(q('[data-kind="reps"]')),done:rect(q('.log-done')),doneShown:q('.log-done').getBoundingClientRect().width>0,menu:rect(q('.log-set-menu')),
   rir:rect(q('.log-rir')),clipped:inputs.map(i=>i.scrollWidth-i.clientWidth),borderTop:parseFloat(getComputedStyle(row).borderTopWidth),padding:[getComputedStyle(row).paddingTop,getComputedStyle(row).paddingBottom],
   maxRight:Math.max(...all),bg:getComputedStyle(row).backgroundColor};
 })};
},name);

const near=(a,b,message)=>expect(Math.abs(a-b),message).toBeLessThanOrEqual(1);

for(const width of [360,390,430]){
 // Active phone workouts use Focus; the compact grid on phones is the finished record.
 test(`finished set rows share one grid at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  const name=await setupFinished(page,width===360?'102.5':'999.75');
  const m=await measure(page,name),[first]=m.rows;
  expect(m.rows).toHaveLength(3);
  for(const [i,r] of m.rows.entries()){
   near(r.weight.left,first.weight.left,`kg x ${i}`);near(r.weight.width,first.weight.width,`kg w ${i}`);
   near(r.reps.left,first.reps.left,`reps x ${i}`);near(r.reps.width,first.reps.width,`reps w ${i}`);
   expect(r.doneShown,`no done toggle ${i}`).toBe(false);
   near(r.menu.left,first.menu.left,`menu x ${i}`);
   // Under 22rem (card content 352px: 360 and 390 phones) the group spans number to reps and drops the caption.
   const spansNumber=width<430;
   near(r.rir.left,spansNumber?r.num.left:r.weight.left,`rir left ${i}`);near(r.rir.right,r.reps.right,`rir right ${i}`);
   expect(r.captionShown,`caption ${i}`).toBe(!spansNumber);
   for(const box of [...r.steps,...r.options]){expect(box.width,`target w ${i}`).toBeGreaterThanOrEqual(43.5);expect(box.height,`target h ${i}`).toBeGreaterThanOrEqual(43.5);}
   expect(r.maxRight,`overflow ${i}`).toBeLessThanOrEqual(m.inner.right+1);
   expect(r.rir.top,`rir below line 1 ${i}`).toBeGreaterThan(r.reps.bottom-2);
   expect(r.borderTop,`separator ${i}`).toBe(i===0?0:1);
   expect(r.padding,`vertical set padding ${i}`).toEqual(['8px','8px']);
   for(const box of [r.menu]){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  }
  expect(first.clipped.every(c=>c<=1)).toBe(true);
  // iOS zooms the page on focus of inputs under 16px.
  for(const field of ['weight','reps'])expect(await page.getByLabel(`Set 1 ${field}, ${name}`,{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),field).toBeGreaterThanOrEqual(16);
  // A done row's tint spans the card's inner width plus its padding (finished sets are done).
  const done=m.rows[2];
  near(done.row.left,m.card.left+1,'done tint left');near(done.row.right,m.card.right-1,'done tint right');
  expect(done.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await context.close();
 });
}

test('active touch rows keep two lines with done above the menu at 800px',async({browser})=>{
 const context=await browser.newContext({viewport:{width:800,height:844},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 const name=await setup(page);
 await page.getByRole('button',{name:`Mark set 3 done, ${name}`,exact:true}).click();
 const m=await measure(page,name),[first]=m.rows;
 for(const [i,r] of m.rows.entries()){
  near(r.done.left,first.done.left,`done x ${i}`);near(r.menu.left,r.done.left,`menu x ${i}`);
  expect(r.rir.top,`rir below line 1 ${i}`).toBeGreaterThan(r.done.bottom-2);
  for(const box of [r.done,r.menu,...r.steps,...r.options]){expect(box.width).toBeGreaterThanOrEqual(43.5);expect(box.height).toBeGreaterThanOrEqual(43.5);}
  expect(r.maxRight).toBeLessThanOrEqual(m.inner.right+1);
 }
 const done=m.rows[2];near(done.row.left,m.card.left+1,'done tint left');near(done.row.right,m.card.right-1,'done tint right');expect(done.bg).not.toBe('rgba(0, 0, 0, 0)');
 await context.close();
});

for(const [width,height] of [[900,800],[1366,768]])test(`set rows are one line at ${width}px fine pointer`,async({page})=>{
 await page.setViewportSize({width,height});
 const name=await setup(page);
 await page.getByRole('button',{name:`Mark set 3 done, ${name}`,exact:true}).click();
 const m=await measure(page,name),[first]=m.rows;
 for(const [i,r] of m.rows.entries()){
  near(r.weight.left,first.weight.left,`kg x ${i}`);near(r.reps.left,first.reps.left,`reps x ${i}`);near(r.done.left,first.done.left,`done x ${i}`);
  near(r.menu.left,first.menu.left,`menu x ${i}`);
  expect(r.rir.top).toBeGreaterThanOrEqual(r.row.top);expect(r.rir.bottom).toBeLessThanOrEqual(r.done.bottom+4);
  expect(r.done.top).toBeLessThan(r.rir.bottom);expect(r.rir.top).toBeLessThan(r.done.bottom);
  expect(r.maxRight).toBeLessThanOrEqual(m.inner.right+1);
  expect(r.padding,`vertical set padding ${i}`).toEqual(['8px','8px']);
  expect(r.borderTop,`separator ${i}`).toBe(i===0?0:1);
 }
 const done=m.rows[2];near(done.row.left,m.card.left+1,'done tint left');near(done.row.right,m.card.right-1,'done tint right');expect(done.bg).not.toBe('rgba(0, 0, 0, 0)');
});

test('the set menu removes a set and focuses the next set menu',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 const name=await setup(page);
 await expect(page.getByRole('button',{name:`Remove set 1, ${name}`})).toHaveCount(0);
 await page.getByRole('button',{name:`Set 2 actions, ${name}`,exact:true}).click();
 await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Remove set',exact:true}).click();
 await expect(page.locator('.log-exercise').first().locator('.log-set')).toHaveCount(2);
 await expect(page.getByRole('button',{name:`Set 2 actions, ${name}`,exact:true})).toBeFocused();
});

test('the sixth RIR option reads 5+ and stores 5',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await setup(page);
 const five=page.locator('.log-exercise').first().locator('.log-rir').first().getByRole('button',{name:'5 or more',exact:true});
 await expect(five).toHaveText('5+');await five.click();await expect(five).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>(await (await page.request.get('/api/workouts/active')).json()).record.log.exercises[0].sets[0].rir).toBe(5);
 await page.reload();
 await expect(page.locator('.log-exercise').first().locator('.log-rir').first().getByRole('button',{name:'5 or more',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('last time RIR 5 suggests 5+',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await login(page);await resetWorkouts(page);
 const {id}=await createLinkedTemplate(page,'Push A');
 const template=(await (await page.request.get(`/api/documents/${id}`)).json()).record;
 let past=createWorkoutLog({id:makeId(),now:new Date(Date.now()-3*3600000),makeId,template});
 past={...past,exercises:past.exercises.map((e,i)=>i?e:{...e,sets:[{id:makeId(),kind:'working',weightKg:80,reps:8,rir:5,done:true}]})};
 const saved=await page.request.put(`/api/workouts/${past.id}`,{headers,data:{revision:0,log:finishWorkout(past,new Date(Date.now()-2*3600000)).log}});
 expect(saved.ok(),await saved.text()).toBeTruthy();
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template});
 const put=await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}});
 expect(put.ok(),await put.text()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 const card=page.locator('.log-exercise').first();
 await expect(card.locator('.log-last-time')).toContainText('@5+');
 await expect(card.locator('.log-rir').first().getByRole('button',{name:'5 or more',exact:true})).toHaveClass(/is-placeholder/);
});

test('a deselected RIR option returns to the plain border on touch',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();
 await setup(page);
 // Focus shows the viewed set's RIR strip; the options are borrowed canonical nodes.
 const rir=page.locator('.workout-focus .log-rir:visible').first();
 const two=rir.locator('[data-rir="2"]'),three=rir.locator('[data-rir="3"]');
 const border=l=>l.evaluate(el=>getComputedStyle(el).borderTopColor);
 const rootColor=name=>page.evaluate(n=>{const p=document.createElement('i');p.style.color=`var(${n})`;document.body.append(p);const c=getComputedStyle(p).color;p.remove();return c;},name);
 const plain=await rootColor('--border'),accent=await rootColor('--accent');
 expect(plain).toBe('rgb(44, 55, 70)');
 await two.tap();await expect(two).toHaveAttribute('aria-pressed','true');expect(await border(two)).toBe(accent);
 await two.tap();await expect(two).toHaveAttribute('aria-pressed','false');
 await page.waitForTimeout(250);// border-color transition is 150ms
 expect(await border(two)).toBe(plain);
 expect(await border(three)).toBe(plain);
 await context.close();
});

test('a suggested RIR option keeps a dashed non-accent border',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await login(page);await resetWorkouts(page);
 const {id}=await createLinkedTemplate(page,'Push A');
 const template=(await (await page.request.get(`/api/documents/${id}`)).json()).record;
 let past=createWorkoutLog({id:makeId(),now:new Date(Date.now()-3*3600000),makeId,template});
 past={...past,exercises:past.exercises.map((e,i)=>i?e:{...e,sets:[{id:makeId(),kind:'working',weightKg:80,reps:8,rir:2,done:true}]})};
 const saved=await page.request.put(`/api/workouts/${past.id}`,{headers,data:{revision:0,log:finishWorkout(past,new Date(Date.now()-2*3600000)).log}});
 expect(saved.ok(),await saved.text()).toBeTruthy();
 const log=createWorkoutLog({id:makeId(),now:new Date(Date.now()-5*60000),makeId,template});
 expect((await page.request.put(`/api/workouts/${log.id}`,{headers,data:{revision:0,log}})).ok()).toBeTruthy();
 await page.goto('/#/workouts/'+log.id);
 const suggested=page.locator('.log-exercise').first().locator('.log-rir').first().locator('.is-placeholder');
 await expect(suggested).toHaveCount(1);
 const s=await suggested.evaluate(el=>{const c=getComputedStyle(el);return [c.borderTopStyle,c.borderTopColor];});
 const accent=await page.evaluate(()=>{const p=document.createElement('i');p.style.color='var(--accent)';document.body.append(p);const c=getComputedStyle(p).color;p.remove();return c;});
 expect(s[0]).toBe('dashed');expect(s[1]).not.toBe(accent);
});

test('a saved set note shows the note icon inline before its text',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const name=await setupFinished(page,'80');
 await page.getByRole('button',{name:`Set 1 actions, ${name}`,exact:true}).click();
 await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Add note',exact:true}).click();
 const input=page.getByLabel(`Note, set 1, ${name}`,{exact:true});await input.fill('Felt strong');await input.press('Enter');
 const m=await page.locator('.log-set-note-text').first().evaluate(btn=>{
  const svg=btn.querySelector('svg'),range=document.createRange();range.selectNodeContents(btn.lastChild);
  const s=svg.getBoundingClientRect(),t=range.getBoundingClientRect();
  return {display:getComputedStyle(svg).display,w:s.width,dy:Math.abs((s.top+s.height/2)-(t.top+t.height/2)),before:s.right<=t.left+1};
 });
 expect(m.display).toBe('inline-block');expect(m.w).toBe(15);expect(m.dy).toBeLessThanOrEqual(4);expect(m.before).toBe(true);
});
