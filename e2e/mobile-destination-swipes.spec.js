import {test,expect} from '@playwright/test';
import {login} from './workout-helper.js';
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
