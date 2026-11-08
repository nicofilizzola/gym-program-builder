import {test,expect} from '@playwright/test';
import {login} from './workout-helper.js';
import {dragDestination} from './mobile-swipe-helper.js';

test.use({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});

export async function holdResponse(page,pattern){
 let release,seen;
 const held=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>seen=resolve);
 await page.route(pattern,async route=>{seen();await held;await route.continue().catch(()=>{});});
 return {requested,release};
}

test('cold swipe settles while destination data is held and accepts another navigation',async({page})=>{
 await login(page);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 const held=await holdResponse(page,'**/api/documents?kind=program');
 try{
  await dragDestination(page);await held.requested;
  await expect(page.locator('#mobile-page-stage')).toBeHidden({timeout:750});
  await expect(page.locator('[data-root-state]')).toHaveAttribute('data-root-state','loading');
  await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Library',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true}).click();
  await expect(page.getByRole('heading',{name:'User',exact:true})).toBeVisible();
  await page.waitForTimeout(1500);
 }finally{held.release();}
 await expect(page.locator('#mobile-page-stage')).toBeHidden();
});

test('records CPU-throttled gesture and settlement timings',async({page},info)=>{
 await login(page);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Library',exact:true}).click();
 await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 await page.getByRole('link',{name:'Exercises',exact:true}).click();
 await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 const client=await page.context().newCDPSession(page);
 const samples=[];
 for(const rate of [1,4]){
  await client.send('Emulation.setCPUThrottlingRate',{rate});
  await page.evaluate(()=>{
   window.gestureSamples=[];
   const stage=document.querySelector('#mobile-page-stage');
   window.gestureObserver=new MutationObserver(()=>window.gestureSamples.push({at:performance.now(),hidden:stage.hidden}));
   window.gestureObserver.observe(stage,{attributes:true,attributeFilter:['hidden']});
  });
  const start=Date.now();await dragDestination(page);
  const released=Date.now();await expect(page.locator('#mobile-page-stage')).toBeHidden();
  samples.push({rate,dispatchMs:released-start,settlementMs:Date.now()-released,events:await page.evaluate(()=>{window.gestureObserver.disconnect();return window.gestureSamples;})});
  await dragDestination(page,{direction:'previous'});await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 }
 await client.send('Emulation.setCPUThrottlingRate',{rate:1});await client.detach();
 await info.attach('gesture-timings',{body:JSON.stringify(samples,null,2),contentType:'application/json'});
});
