import {test,expect} from '@playwright/test';
import {login,headers} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const nav=(page,name)=>page.getByRole('navigation',{name:'Main'}).getByRole('link',{name,exact:true});
test('cached rows remain usable during a held refresh and changed rows preserve focus',async({page})=>{
 await login(page);
 const id=crypto.randomUUID(),name='Cached '+id.slice(0,6);
 await page.request.post('/api/documents',{headers,data:{id,kind:'program',document:{name,mode:'schedule',goals:{},workouts:[]}}});
 await nav(page,'Library').click();await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
 await nav(page,'User').click();let release;const held=new Promise(r=>release=r);
 await page.route('**/api/documents?kind=program',async route=>{await held;await route.fulfill({json:{records:[{id,revision:2,name:name+' refreshed'}]}});});
 try{
  await nav(page,'Library').click();await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Export '+name,exact:true}).focus();release();
  await expect(page.getByRole('link',{name:name+' refreshed',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Export '+name+' refreshed',exact:true})).toBeFocused();
 }finally{release();}
});
test('refresh failure retains cached rows and Retry can publish a successful empty',async({page})=>{
 await login(page);await nav(page,'Library').click();await expect(page.locator('.library')).toBeVisible();
 await nav(page,'User').click();
 await page.route('**/api/documents?kind=program',route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));
 await nav(page,'Library').click();
 await expect(page.getByText("Couldn't refresh. Showing previously loaded data.",{exact:true})).toBeVisible();
 await page.unroute('**/api/documents?kind=program');
 await page.route('**/api/documents?kind=program',route=>route.fulfill({json:{records:[]}}));
 await page.locator('.root-page-feedback').getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.library-item')).toHaveCount(0);
 await expect(page.locator('[data-empty]')).toContainText('No programs yet');
});
