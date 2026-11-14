import {test,expect} from '@playwright/test';
import {login,resetWorkouts} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const main=page=>page.getByRole('navigation',{name:'Main'});
test('three mobile destinations are links and Library selects canonical sections',async({page})=>{
 await login(page);
 expect(await main(page).getByRole('link').evaluateAll(links=>links.filter(a=>a.getClientRects().length).map(a=>a.innerText.trim()))).toEqual(['Home','Library','User']);
 await main(page).getByRole('link',{name:'Library',exact:true}).click();
 await expect(page).toHaveURL(/#\/programs$/);
 for(const [name,path] of [['Templates','templates'],['Exercises','catalog'],['Programs','programs']]){
  await page.getByRole('navigation',{name:'Library sections'}).getByRole('link',{name,exact:true}).click();
  await expect(page).toHaveURL(new RegExp('#/'+path+'$'));
  await expect(main(page).getByRole('link',{name:'Library',exact:true})).toHaveAttribute('aria-current','page');
 }
});
test('User is a full page and remembers Library section',async({page})=>{
 await login(page);await page.goto('/#/catalog');
 await main(page).getByRole('link',{name:'User',exact:true}).click();
 await expect(page.getByRole('heading',{name:'User',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Training profile',exact:true})).toHaveAttribute('href','#/profile');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(main(page).getByRole('link',{name:'User',exact:true})).not.toHaveAttribute('aria-expanded');
 await main(page).getByRole('link',{name:'Library',exact:true}).click();await expect(page).toHaveURL(/#\/catalog$/);
 await main(page).getByRole('link',{name:'User',exact:true}).click();await page.getByRole('link',{name:'Training profile',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'User',exact:true})).toBeVisible();
});
test('desktop retains original navigation and direct User survives resize',async({page})=>{
 await login(page);await page.goto('/#/user');await page.setViewportSize({width:1440,height:900});
 expect(await main(page).getByRole('link').evaluateAll(links=>links.filter(a=>a.getClientRects().length).map(a=>a.innerText.trim()))).toEqual(['Programs','Session templates','Exercise catalog','Workouts']);
 await expect(page.getByRole('heading',{name:'User',exact:true})).toBeVisible();
 await expect(page.locator('#profile')).toBeVisible();await expect(page.locator('#logout')).toBeVisible();
});
test('logout failure preserves signed-in page and successful logout exits',async({page})=>{
 await login(page);await resetWorkouts(page);await main(page).getByRole('link',{name:'User',exact:true}).click();
 await page.route('**/api/auth/logout',r=>r.fulfill({status:503,json:{error:{message:'Logout unavailable'}}}));
 await page.getByRole('button',{name:'Log out',exact:true}).click();
 await expect(page.locator('.user-page [role=alert]')).toHaveText('Logout unavailable');
 await expect(page.locator('#shell')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('gpb.signedOut'))).toBeNull();
 await page.unroute('**/api/auth/logout');await page.getByRole('button',{name:'Log out',exact:true}).click();
 await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
