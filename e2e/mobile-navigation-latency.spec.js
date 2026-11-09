import {test,expect} from '@playwright/test';
import {login} from './workout-helper.js';
import {dragDestination} from './mobile-swipe-helper.js';
import {writeFile} from 'node:fs/promises';

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
 let trace;
 if(process.env.GPB_NAV_TRACE){
  trace=new Promise(resolve=>client.once('Tracing.tracingComplete',event=>resolve(event.stream)));
  await client.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing',transferMode:'ReturnAsStream'});
 }
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
 await client.send('Emulation.setCPUThrottlingRate',{rate:1});
 if(trace){
  await client.send('Tracing.end');const handle=await trace;let result='';
  for(;;){const chunk=await client.send('IO.read',{handle});result+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString():chunk.data;if(chunk.eof)break;}
  await client.send('IO.close',{handle});await writeFile(info.outputPath('navigation-cpu-trace.json'),result);
  await page.screenshot({path:info.outputPath('cached-catalog-390.png'),fullPage:false});
 }
 await client.detach();
 console.log('Navigation timings: '+JSON.stringify(samples));
 await writeFile(info.outputPath('gesture-timings.json'),JSON.stringify(samples,null,2));
 await info.attach('gesture-timings',{body:JSON.stringify(samples,null,2),contentType:'application/json'});
});

test('indicator continues forward without jumping back when the route commits',async({page})=>{
 await login(page);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 await page.evaluate(()=>{
  const indicator=document.querySelector('.mobile-nav-indicator');window.indicatorPositions=[];
  new MutationObserver(()=>window.indicatorPositions.push(new DOMMatrix(indicator.style.transform).m41)).observe(indicator,{attributes:true,attributeFilter:['style']});
 });
 await dragDestination(page);await expect(page.locator('#mobile-page-stage')).toBeHidden();
 const positions=await page.evaluate(()=>window.indicatorPositions);
 expect(positions.some((x,i)=>i>0&&x<positions[i-1]-2)).toBe(false);
});

test('data arriving during settlement waits until animation finishes before mounting rows',async({page})=>{
 await login(page);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
 let release,seen;const held=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
 await page.route('**/api/documents?kind=program',async route=>{seen();await held;await route.fulfill({json:{records:[{id:'motion-row',name:'Arrived during motion',revision:1}]}});});
 await page.evaluate(()=>{
  window.earlyRows=[];new MutationObserver(()=>{if(!document.querySelector('#mobile-page-stage').hidden&&document.querySelector('#app .library-item'))window.earlyRows.push(performance.now());}).observe(document.querySelector('#app'),{childList:true,subtree:true});
 });
 try{
  await dragDestination(page);await requested;release();
  await expect(page.getByRole('link',{name:'Arrived during motion',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.earlyRows)).toEqual([]);
 }finally{release();}
});
