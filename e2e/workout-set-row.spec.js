import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';

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
  return {row:rect(row),num:rect(q('.log-set-number')),captionShown:getComputedStyle(caption).display!=='none',steps:[...row.querySelectorAll('.log-step')].map(rect),options:[...row.querySelectorAll('.log-rir-option')].map(rect),li:rect(li),weight:rect(q('[data-kind="weight"]')),reps:rect(q('[data-kind="reps"]')),done:rect(q('.log-done')),menu:rect(q('.log-set-menu')),
   rir:rect(q('.log-rir')),clipped:inputs.map(i=>i.scrollWidth-i.clientWidth),borderTop:parseFloat(getComputedStyle(row).borderTopWidth),
   maxRight:Math.max(...all),bg:getComputedStyle(row).backgroundColor};
 })};
},name);

const near=(a,b,message)=>expect(Math.abs(a-b),message).toBeLessThanOrEqual(1);

for(const width of [360,390,430]){
 test(`set rows share one grid at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  const name=await setup(page,width===360?'102.5':'999.75');
  await page.getByRole('button',{name:`Mark set 3 done, ${name}`,exact:true}).click();
  const m=await measure(page,name),[first]=m.rows;
  expect(m.rows).toHaveLength(3);
  for(const [i,r] of m.rows.entries()){
   near(r.weight.left,first.weight.left,`kg x ${i}`);near(r.weight.width,first.weight.width,`kg w ${i}`);
   near(r.reps.left,first.reps.left,`reps x ${i}`);near(r.reps.width,first.reps.width,`reps w ${i}`);
   near(r.done.left,first.done.left,`done x ${i}`);
   // Under 22rem (card content 352px: 360 and 390 phones) the group spans number to reps and drops the caption.
   const spansNumber=width<430;
   near(r.rir.left,spansNumber?r.num.left:r.weight.left,`rir left ${i}`);near(r.rir.right,r.reps.right,`rir right ${i}`);
   expect(r.captionShown,`caption ${i}`).toBe(!spansNumber);
   for(const box of [...r.steps,...r.options]){expect(box.width,`target w ${i}`).toBeGreaterThanOrEqual(43.5);expect(box.height,`target h ${i}`).toBeGreaterThanOrEqual(43.5);}
   near(r.menu.left,r.done.left,`menu x ${i}`);
   expect(r.maxRight,`overflow ${i}`).toBeLessThanOrEqual(m.inner.right+1);
   expect(r.rir.top,`rir below line 1 ${i}`).toBeGreaterThan(r.done.bottom-2);
   expect(r.borderTop,`separator ${i}`).toBe(i===0?0:1);
   for(const box of [r.done,r.menu]){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  }
  expect(first.clipped.every(c=>c<=1)).toBe(true);
  // iOS zooms the page on focus of inputs under 16px.
  for(const field of ['weight','reps'])expect(await page.getByLabel(`Set 1 ${field}, ${name}`,{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),field).toBeGreaterThanOrEqual(16);
  // A done row's tint spans the card's inner width plus its padding.
  const done=m.rows[2];
  near(done.row.left,m.card.left+1,'done tint left');near(done.row.right,m.card.right-1,'done tint right');
  expect(done.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await context.close();
 });
}

for(const [width,height] of [[900,800],[1366,768]])test(`set rows are one line at ${width}px fine pointer`,async({page})=>{
 await page.setViewportSize({width,height});
 const name=await setup(page);
 const m=await measure(page,name),[first]=m.rows;
 for(const [i,r] of m.rows.entries()){
  near(r.weight.left,first.weight.left,`kg x ${i}`);near(r.reps.left,first.reps.left,`reps x ${i}`);near(r.done.left,first.done.left,`done x ${i}`);
  near(r.menu.left,first.menu.left,`menu x ${i}`);
  expect(r.rir.top).toBeGreaterThanOrEqual(r.row.top);expect(r.rir.bottom).toBeLessThanOrEqual(r.done.bottom+4);
  expect(r.done.top).toBeLessThan(r.rir.bottom);expect(r.rir.top).toBeLessThan(r.done.bottom);
  expect(r.maxRight).toBeLessThanOrEqual(m.inner.right+1);
 }
});

test('the set menu removes a set and focuses the next set menu',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const name=await setup(page);
 await expect(page.getByRole('button',{name:`Remove set 1, ${name}`})).toHaveCount(0);
 await page.getByRole('button',{name:`Set 2 actions, ${name}`,exact:true}).click();
 await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Remove set',exact:true}).click();
 await expect(page.locator('.log-exercise').first().locator('.log-set')).toHaveCount(2);
 await expect(page.getByRole('button',{name:`Set 2 actions, ${name}`,exact:true})).toBeFocused();
});
