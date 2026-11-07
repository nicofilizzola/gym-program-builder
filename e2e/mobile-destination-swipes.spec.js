import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
import {answerNextConfirmation} from './confirmation-helper.js';
import {dragDestination} from './mobile-swipe-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const main=page=>page.getByRole('navigation',{name:'Main'});
async function ready(page,hash){await expect(page).toHaveURL(new RegExp(hash.replace(/[.*+?^$()|[\]\\]/g,'\\$&')+'$'));await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');}
test('real touch swipes traverse all four destinations and stop at boundaries',async({page})=>{
 await login(page);await ready(page,'#/home');
 for(const [hash,name] of [['#/programs','Library'],['#/workouts','History'],['#/user','User']]){
  await dragDestination(page);await ready(page,hash);await expect(main(page).getByRole('link',{name,exact:true})).toHaveAttribute('aria-current','page');
 }
 await expect(page.getByRole('heading',{name:'User',exact:true})).toBeFocused();
 await dragDestination(page);await ready(page,'#/user');
 for(const hash of ['#/workouts','#/programs','#/home']){await dragDestination(page,{direction:'previous'});await ready(page,hash);}
 await dragDestination(page,{direction:'previous'});await ready(page,'#/home');
});
test('cancellation has no history side effect and a skipped tap opens only User',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await ready(page,'#/home');
 const length=await page.evaluate(()=>history.length);
 await dragDestination(page,{cancel:true});await expect(page.locator('#mobile-page-stage')).toBeHidden();
 await ready(page,'#/home');expect(await page.evaluate(()=>history.length)).toBe(length);
 await main(page).getByRole('link',{name:'User',exact:true}).click();await ready(page,'#/user');
 expect(await page.evaluate(()=>history.length)).toBe(length+1);
 await expect(page.getByRole('heading',{name:'User',exact:true})).toBeFocused();
});
test('failed required destination keeps source and newer tap supersedes held load',async({page})=>{
 await login(page);await page.goto('/#/user');await ready(page,'#/user');
 await page.route('**/api/workouts',r=>r.fulfill({status:503,json:{error:{message:'History unavailable'}}}));
 await dragDestination(page,{direction:'previous'});await expect(page.locator('#app-message')).toContainText('History unavailable');await ready(page,'#/user');
 await page.unroute('**/api/workouts');
 let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
 await page.route('**/api/documents?kind=program',async r=>{seen();await held;await r.continue();});
 await main(page).getByRole('link',{name:'Library',exact:true}).click();await requested;
 await expect(main(page).getByRole('link',{name:'User',exact:true})).toHaveAttribute('aria-current','page');
 await main(page).getByRole('link',{name:'History',exact:true}).click();release();await ready(page,'#/workouts');
 await expect(page.getByRole('heading',{name:'Workouts',exact:true})).toBeVisible();
});
test('active mirror survives an attempted root swipe offline and User restores the resume bar',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();
 const name='Swipe workout '+crypto.randomUUID().slice(0,6);await createLinkedTemplate(page,name);await page.goto('/#/templates');
 await page.getByRole('button',{name:'Start workout '+name,exact:true}).click();await expect(page.locator('.logger-status')).toHaveText('Saved');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('gpb.activeWorkout')).log);
 await main(page).getByRole('link',{name:'Home',exact:true}).click();await ready(page,'#/home');
 await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();await expect(page.locator('.workout-bar')).not.toBeVisible();
 await page.context().setOffline(true);await dragDestination(page);await expect(page.locator('#app-message')).not.toBeEmpty();await ready(page,'#/home');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gpb.activeWorkout')).log.id)).toBe(before.id);
 await page.context().setOffline(false);await main(page).getByRole('link',{name:'User',exact:true}).click();await ready(page,'#/user');
 await expect(page.locator('.workout-bar')).toBeVisible();await resetWorkouts(page);
});
test('Profile keeps dirty edits when leaving is declined and never accepts destination swipes',async({page})=>{
 await login(page);await page.goto('/#/profile');
 await page.route('**/api/profile',r=>r.request().method()==='PUT'?r.fulfill({status:503,json:{error:{message:'Save unavailable'}}}):r.continue());
 const field=page.getByRole('textbox',{name:'Training background and approach',exact:true});await field.fill('Keep my training background');await field.blur();
 await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');
 await dragDestination(page);await expect(page).toHaveURL(/#\/profile$/);
 await answerNextConfirmation(page,false);await main(page).getByRole('link',{name:'User',exact:true}).click();
 await expect(field).toHaveValue('Keep my training background');await expect(page).toHaveURL(/#\/profile$/);
});
test('resize during drag cancels layers without redirecting the explicit route',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await ready(page,'#/home');
 const c=await page.context().newCDPSession(page);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:330,y:280}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:240,y:282}]});
 await expect(page.locator('#mobile-page-stage')).toBeVisible();await page.setViewportSize({width:1440,height:900});
 await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach();
 await ready(page,'#/home');await expect(page.locator('#mobile-page-stage')).toBeHidden();
});
test('authentication expiry during a load clears previews before sign-in',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await page.goto('/#/user');await ready(page,'#/user');
 let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
 await page.route('**/api/workouts',async r=>{seen();await held;await r.continue();});
 await main(page).getByRole('link',{name:'History',exact:true}).click();await requested;
 await page.request.post('/api/auth/logout',{headers,data:{}});release();
 await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.locator('#mobile-page-stage')).toBeHidden();
});
test('keyboard destinations and enlarged labels stay usable with reduced motion',async({page})=>{
 await login(page);await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 for(const name of ['Library','History','User','Home']){
  const link=main(page).getByRole('link',{name,exact:true});await link.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  await expect(link).toHaveAttribute('aria-current','page');await expect(page.locator('#mobile-page-stage')).toBeHidden();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('a superseding tap enables fresh swipes before the obsolete request resolves',async({page})=>{
 await login(page);await resetWorkouts(page);await page.goto('/#/user');await ready(page,'#/user');
 let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
 await page.route('**/api/workouts',async r=>{seen();await held;await r.continue();});
 try{
  await dragDestination(page,{direction:'previous'});await requested;
  await main(page).getByRole('link',{name:'Home',exact:true}).click();await ready(page,'#/home');
  await dragDestination(page);await ready(page,'#/programs');
 }finally{release();}
});
