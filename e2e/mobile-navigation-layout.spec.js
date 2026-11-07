import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {login,resetWorkouts,createLinkedTemplate,saveFinishedLog,headers} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('populated navigation and headings fit phone desktop and enlarged text',async({page})=>{
 test.setTimeout(120000);await login(page);await resetWorkouts(page);
 const name='Upper body training',{id}=await createLinkedTemplate(page,name),programId=crypto.randomUUID();
 expect((await page.request.post('/api/documents',{headers,data:{id:programId,kind:'program',document:{name:'Four day training plan',mode:'simple',goals:{},workouts:[{id:'upper',templateId:id,day:null}]}}})).ok()).toBe(true);
 await page.request.put('/api/settings/active-program',{headers,data:{programId:programId}});
 const finished=await saveFinishedLog(page,{name:'Previous training session',startedAt:'2026-11-06T12:00:00Z'});
 const folder='docs/superpowers/verification/assets/mobile-library-navigation';await mkdir(folder,{recursive:true});
 async function open(hash){await page.goto('/'+hash);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');if(hash==='#/home')await expect(page.locator('.home-start')).toBeVisible();}
 async function capture(label){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label).toBe(true);
  await page.screenshot({path:folder+'/'+label+'.png'});
 }
 for(const [width,height] of [[360,800],[390,844],[760,900],[761,900],[1366,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const route of ['home','programs','workouts','user']){await open('#/'+route);await capture(width+'-'+route);}
  if(width===390)for(const route of ['templates','catalog','profile']){await open('#/'+route);await capture(width+'-'+route);}
 }
 await page.setViewportSize({width:390,height:844});
 await open('#/templates/'+id);await capture('390-template-editor');
 await open('#/programs/'+programId);await capture('390-program-editor');
 await open('#/workouts/'+finished.id);await capture('390-finished-log');
 await open('#/templates');await page.getByRole('button',{name:'Start workout '+name,exact:true}).click();await expect(page.locator('.logger-status')).toHaveText('Saved');await capture('390-active-log');
 await open('#/home');await page.emulateMedia({reducedMotion:'no-preference'});
 const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:330,y:280}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:220,y:282}]});
 await expect(page.locator('#mobile-page-stage')).toBeVisible();await capture('390-mid-swipe');
 await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach();await expect(page.locator('#mobile-page-stage')).toBeHidden();
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 for(const route of ['home','programs','user']){await open('#/'+route);await capture('390-enlarged-'+route);}
 await open('#/templates/'+id);await page.route('**/api/documents/'+id,r=>r.request().method()==='PUT'?r.fulfill({status:409,json:{error:{message:'Conflict'}}}):r.continue());
 await page.getByLabel('Session template name',{exact:true}).fill(name+' local edit');await expect(page.getByTestId('save-status')).toHaveText('Conflict');await capture('390-enlarged-conflict');
 await resetWorkouts(page);
});
