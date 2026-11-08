import {test,expect} from '@playwright/test';
import {login,resetWorkouts} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('History and its picker open without lists; Blank stays available',async({page})=>{
 await login(page);await resetWorkouts(page);let release;const held=new Promise(r=>release=r);
 for(const pattern of ['**/api/documents?kind=program','**/api/documents?kind=template','**/api/settings'])await page.route(pattern,async route=>{await held;await route.continue().catch(()=>{});});
 try{
  await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'History',exact:true}).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Loading programs...',{exact:true})).toBeVisible();
  await dialog.getByRole('searchbox',{name:'Search sessions'}).fill('keep query');
  release();await expect(dialog.getByText('Loading programs...',{exact:true})).toBeHidden();
  await expect(dialog.getByRole('searchbox',{name:'Search sessions'})).toHaveValue('keep query');
  await expect(dialog.getByRole('searchbox',{name:'Search sessions'})).toBeFocused();
  await dialog.getByRole('button',{name:'Blank workout',exact:true}).click();
  await expect(page.locator('.logger-title')).toBeVisible();
 }finally{release();await resetWorkouts(page);}
});
