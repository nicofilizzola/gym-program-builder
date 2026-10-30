import {test,expect} from '@playwright/test';

async function ask(page,options={}){
 await page.evaluate(async options=>{
  const {confirmAction}=await import('/src/confirm-dialog.js');
  window.confirmController=new AbortController();window.answer='pending';
  window.ask=confirmAction;
  confirmAction({title:'Replace exercise?',message:'Keep <img> literal.\nSets, reps and rest stay unchanged.',confirmLabel:'Replace exercise',signal:window.confirmController.signal,...options}).then(answer=>window.answer=answer);
 },options);
}
test.beforeEach(async({page})=>{await page.goto('/');});

test('branded confirmation contains focus, safely renders text and resolves only its chosen action',async({page})=>{
 const invoker=page.getByLabel('Password',{exact:true});await invoker.focus();await ask(page);
 const dialog=page.getByRole('dialog',{name:'Replace exercise?',exact:true});
 await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await expect(dialog).toContainText('<img>');await expect(dialog.locator('img')).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Replace exercise',exact:true})).toBeFocused();
 await dialog.getByRole('button',{name:'Replace exercise',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>window.answer)).toBe(true);await expect(invoker).toBeFocused();
});
test('Escape, backdrop and abort cancel; simultaneous requests do not stack',async({page})=>{
 await ask(page);expect(await page.evaluate(()=>window.ask({title:'Other',message:'Other',confirmLabel:'Do it'}))).toBe(false);
 await expect(page.getByRole('dialog')).toHaveCount(1);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.answer)).toBe(false);
 await ask(page);await page.mouse.click(1,1);await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.answer)).toBe(false);
 await ask(page);await page.evaluate(()=>window.confirmController.abort());await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.answer)).toBe(false);
});
test('normal motion retains the dialog through exit; reduced motion exits immediately',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await ask(page);const dialog=page.getByRole('dialog');await expect(dialog).toHaveCSS('opacity','1');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(b=>b.click());await expect(dialog).toHaveClass(/is-closing/);expect(await page.evaluate(()=>window.answer)).toBe('pending');await expect(dialog).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await ask(page);await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(b=>b.click());expect(await dialog.count()).toBe(0);expect(await page.evaluate(()=>window.answer)).toBe(false);
});

test('pending removal cannot mutate a changed or destroyed program view',async({page})=>{
 let nativeConfirms=0;page.on('dialog',async dialog=>{nativeConfirms++;await dialog.dismiss();});
 await page.evaluate(async()=>{
  const {mountProgramView}=await import('/src/program-view.js');document.body.innerHTML='<div id="fixture"></div>';window.changes=[];
  window.program={name:'Week',mode:'schedule',goals:{},workouts:[{id:'a',name:'Session',day:null,goals:{},exercises:[]}]};
  window.view=mountProgramView(document.querySelector('#fixture'),{program:window.program,templates:[],onChange:value=>window.changes.push(value)});
 });
 const remove=page.getByRole('button',{name:'Remove Session',exact:true});await remove.click();const dialog=page.getByRole('dialog',{name:'Remove session?',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(remove).toBeFocused();expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await remove.click();await page.evaluate(()=>window.view.syncSaved(window.program));await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(remove).toBeFocused();expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await remove.click();await page.evaluate(()=>window.view.update({...window.program,name:'Changed'}));await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await remove.click();await page.evaluate(()=>window.view.destroy());await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.changes.length)).toBe(0);expect(nativeConfirms).toBe(0);
});

test('a delayed autosave expiry cancels confirmation before showing sign-in',async({page})=>{
 await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const id=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Keep this session',exercises:[],goals:{}}});const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Auth test',mode:'schedule',goals:{},workouts:[{id:'keep',templateId:template.id,day:0}]}});return program.id;});
 await page.goto('/#/programs/'+id);await expect(page.getByLabel('Program name',{exact:true})).toBeVisible();
 let release,seen;const gate=new Promise(resolve=>release=resolve),requestSeen=new Promise(resolve=>seen=resolve);
 await page.route('**/api/documents/*',async route=>{if(route.request().method()!=='PUT')return route.continue();seen();await gate;await route.fulfill({status:401,json:{error:{message:'Sign in again'}}});});
 await page.getByLabel('Program name',{exact:true}).fill('Preserved local name');await requestSeen;
 await page.getByRole('button',{name:'Remove Keep this session',exact:true}).click();await expect(page.getByRole('dialog',{name:'Remove session?',exact:true})).toBeVisible();release();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('Password',{exact:true})).toBeFocused();
 await expect(page.locator('.workout-item')).toHaveCount(1);await expect(page.locator('.workout-title')).toHaveText('Keep this session');
});
