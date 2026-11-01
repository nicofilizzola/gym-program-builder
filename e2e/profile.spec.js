import {test,expect} from '@playwright/test';
const headers={origin:'http://127.0.0.1:3199'};
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();}
const field=page=>page.getByLabel('Training background and approach',{exact:true});

test('header Profile button opens the profile page with its labeled field and note',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await login(page);
 const button=page.getByRole('button',{name:'Profile',exact:true});
 expect(await button.evaluate(el=>el.nextElementSibling.id)).toBe('logout');
 await button.hover();await expect(page.locator('.action-tooltip:popover-open')).toHaveText('Profile');
 await button.click();await expect(page).toHaveURL(/#\/profile$/);
 await expect(button).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('heading',{level:1,name:'Profile',exact:true})).toBeVisible();
 await expect(field(page)).toHaveAttribute('maxlength','2000');
 await expect(page.getByText('Used by AI program reviews. Not included in program exports.',{exact:true})).toBeVisible();
 await expect(page.getByText('Example: Two years of consistent training. Usually leave 1–2 reps in reserve and increase weight at the top of the rep range.',{exact:true})).toBeVisible();
 const box=await button.boundingBox();expect(Math.round(box.width)).toBe(32);expect(Math.round(box.height)).toBe(32);
 await page.getByRole('link',{name:'Programs',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 expect(await button.getAttribute('aria-current')).not.toBe('page');
});

test('profile text autosaves and persists after reload',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Profile',exact:true}).click();
 const text='Three years training '+crypto.randomUUID();
 await field(page).fill(text);await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();await expect(field(page)).toHaveValue(text);
 expect((await (await page.request.get('/api/profile')).json()).profile.trainingBackgroundAndApproach).toBe(text);
});

test('profile conflict offers Reload saved version only',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(field(page)).toBeVisible();
 const current=await (await page.request.get('/api/profile')).json(),remote='Remote '+crypto.randomUUID();
 const put=await page.request.put('/api/profile',{headers,data:{revision:current.revision,profile:{trainingBackgroundAndApproach:remote}}});expect(put.ok()).toBeTruthy();
 await field(page).fill('Local edit');await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await expect(page.locator('#reload-saved')).toBeVisible();await expect(page.locator('#copy-saved')).toBeHidden();
 await page.locator('#reload-saved').click();await page.getByRole('button',{name:'Reload saved version',exact:true}).last().click();
 await expect(field(page)).toHaveValue(remote);await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect(page.locator('#reload-saved')).toBeHidden();
 await field(page).fill(remote+' then local');await expect(page.getByTestId('save-status')).toHaveText('Saved');
});

test('profile touch layout keeps 44px targets without horizontal overflow',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3199',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
 await login(page);const button=page.getByRole('button',{name:'Profile',exact:true});await button.click();await expect(field(page)).toBeVisible();
 const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();
});
