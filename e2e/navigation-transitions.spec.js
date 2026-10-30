import {answerNextConfirmation} from './confirmation-helper.js';
import {test,expect} from '@playwright/test';
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#app h1')).toHaveText('Programs');}
async function holdTemplates(page){let release,requested;const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);await page.route('**/api/documents?kind=template',async route=>{requested();await held;await route.continue();});return {seen,release};}
test('fast navigation retains source without loading flash',async({page})=>{
 await login(page);const pending=await holdTemplates(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await pending.seen;
 await expect(page.locator('#app h1')).toHaveText('Programs');await expect(page.locator('#app')).toHaveAttribute('aria-busy','true');
 await expect(page.locator('#app')).not.toContainText('Loading');pending.release();await expect(page.locator('#app h1')).toHaveText('Session templates');
 await expect(page.locator('#app h1')).toBeFocused();await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
});
test('slow navigation shows delayed status without replacing source',async({page})=>{
 await login(page);const pending=await holdTemplates(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await pending.seen;
 await expect(page.locator('#navigation-status')).toBeVisible();await expect(page.locator('#app h1')).toHaveText('Programs');pending.release();await expect(page.locator('#app h1')).toHaveText('Session templates');await expect(page.locator('#navigation-status')).toBeHidden();
});
test('failed destination retains source and restores usable route',async({page})=>{
 await login(page);await page.route('**/api/documents?kind=template',route=>route.fulfill({status:503,json:{error:{message:'Temporarily unavailable'}}}));
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.locator('#app-message')).toContainText('Temporarily unavailable');
 await expect(page.locator('#app h1')).toHaveText('Programs');await expect(page).toHaveURL(/#\/programs$/);await expect(page.getByRole('button',{name:'New program',exact:true})).toBeEnabled();
 expect(await page.locator('#app').evaluate(el=>el.inert)).toBe(false);
});
test('superseded response cannot mount after browser Back',async({page})=>{
 await login(page);const pending=await holdTemplates(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await pending.seen;
 await page.goBack();await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');pending.release();
 await expect(page.locator('#app h1')).toHaveText('Programs');await expect(page).not.toHaveURL(/#\/templates$/);
 await page.getByRole('button',{name:'New program',exact:true}).click();await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();
});
test('navigation waits for autosave and retains edits on a declined discard',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();
 await page.route('**/api/documents/*',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:503,json:{error:{message:'Save unavailable'}}});else await route.continue();});
 await page.getByLabel('Program name',{exact:true}).fill('Keep these edits');
 await answerNextConfirmation(page,false);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Keep these edits');await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
});
test('navigation transitions respect motion and heading focus',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);
 await page.evaluate(()=>{window.phases=[];const observer=new MutationObserver(()=>{window.phases.push(...document.querySelector('#app').getAnimations().map(a=>a.effect.getTiming().duration));});observer.observe(document.querySelector('#app'),{childList:true});});
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.locator('#app h1')).toBeFocused();
 expect(await page.evaluate(()=>window.phases)).toContain(100);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();await expect(page.locator('#app h1')).toBeFocused();expect(await page.locator('#app').evaluate(el=>el.getAnimations().length)).toBe(0);
});
test('shared workout navigation animates, restores focus and focuses export errors',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByRole('button',{name:'Empty workout',exact:true}).click();
 await page.evaluate(()=>{window.internalDurations=[];const root=document.querySelector('#app');new MutationObserver(()=>window.internalDurations.push(...root.getAnimations({subtree:true}).map(a=>a.effect.getTiming().duration))).observe(root,{childList:true,subtree:true});});
 await page.locator('.workout-title').filter({hasText:'Untitled workout'}).click();await expect(page.getByLabel('Session template name')).toBeFocused();
 expect(await page.evaluate(()=>window.internalDurations)).toContain(100);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();
 await expect(page.locator('.workout-title').filter({hasText:'Untitled workout'})).toBeFocused();
 await page.getByRole('button',{name:'Export program',exact:true}).click();await expect(page.getByRole('combobox',{name:'Exercise',exact:true})).toBeFocused();
});
test('expired login during destination fetch retains recoverable source edits',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByLabel('Program name',{exact:true}).fill('Recovered week');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.route('**/api/documents?kind=template',route=>route.fulfill({status:401,json:{error:{message:'Sign in again'}}}));await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
 await page.unroute('**/api/documents?kind=template');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Recovered week');
});
test('successful save followed by destination failure keeps editor queue usable',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByLabel('Program name',{exact:true}).fill('Before failed navigation');
 await page.route('**/api/documents?kind=template',route=>route.fulfill({status:503,json:{error:{message:'No templates response'}}}));await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.locator('#app-message')).toContainText('No templates response');
 await page.getByLabel('Program name',{exact:true}).fill('Still saving');await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.unroute('**/api/documents?kind=template');await page.reload();await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Still saving');
});
test('internal transition cannot unlock the source during pending page navigation',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByRole('button',{name:'Empty workout',exact:true}).click();
 await expect(page.locator('[data-workout-title]')).toBeVisible();
 const pending=await holdTemplates(page);
 await page.evaluate(()=>{document.querySelector('[data-workout-title]').click();document.querySelector('[data-nav="templates"]').click();});await pending.seen;
 await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();await expect.poll(()=>page.locator('#app').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
 expect(await page.locator('#app').evaluate(el=>el.inert)).toBe(true);await expect(page.locator('#app')).toHaveAttribute('aria-busy','true');
 pending.release();await expect(page.locator('#app h1')).toHaveText('Session templates');
});
test('late creation stays saved without overriding a newer Back route',async({page})=>{
 await login(page);await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(page.locator('#app h1')).toHaveText('Session templates');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();await expect(page.locator('#app h1')).toHaveText('Programs');
 let release,requested;const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);
 await page.route('**/api/documents',async route=>{if(route.request().method()==='POST'){requested();await held;}await route.continue();});
 await page.getByRole('button',{name:'New program',exact:true}).click();await seen;await page.goBack();await expect(page.locator('#app h1')).toHaveText('Session templates');release();
 await expect.poll(()=>page.locator('#shell').evaluate(el=>el.inert)).toBe(false);await expect(page.locator('#app h1')).toHaveText('Session templates');await expect(page).toHaveURL(/#\/templates$/);
});
test('failed reload preparation retains conflict edits for Save as copy',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByLabel('Program name',{exact:true}).fill('Conflicted local draft');
 await page.route('**/api/documents/*',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:409,json:{error:{message:'Conflict'}}});else await route.continue();});
 await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await page.route('**/api/documents?kind=template',route=>route.fulfill({status:503,json:{error:{message:'Reload preparation failed'}}}));await answerNextConfirmation(page,true);await page.getByRole('button',{name:'Reload saved version',exact:true}).click();await expect(page.locator('#app-message')).toContainText('Reload preparation failed');
 await page.getByLabel('Program name',{exact:true}).fill('Recover edits after failed reload');await page.unroute('**/api/documents/*');await page.unroute('**/api/documents?kind=template');
 const previous=page.url();await page.getByRole('button',{name:'Save as copy',exact:true}).click();await expect.poll(()=>page.url()).not.toBe(previous);await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Recover edits after failed reload');
});
