import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844},hasTouch:true});
async function fixture(page){
 await page.goto('/');await page.evaluate(async()=>{
  document.body.innerHTML='<main id="touch-fixture" style="height:2400px;padding:80px 32px"><button>Control</button><div class="horizontal" style="width:200px;overflow:auto"><div style="width:800px;height:60px">Scrollable</div></div><p style="height:300px">Neutral area</p></main>';
  const {mountMobileSwipe}=await import('/src/mobile-swipe.js');window.events=[];
  window.swipe=mountMobileSwipe(document.querySelector('main'),{enabled:()=>true,canStart:()=>true,begin:d=>{window.events.push(['begin',d]);return true;},update:x=>window.events.push(['move',x]),release:r=>window.events.push(['release',r.commit]),cancel:()=>window.events.push(['cancel'])});
 });
}
async function drag(page,points){
 const c=await page.context().newCDPSession(page);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
 for(const p of points.slice(1))await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();
}
test('real vertical scrolling remains native and neutral horizontal drag is recognized',async({page})=>{
 await fixture(page);await drag(page,[{x:200,y:500},{x:198,y:430},{x:195,y:300}]);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.events)).toEqual([]);
 await page.evaluate(()=>scrollTo(0,0));await drag(page,[{x:250,y:260},{x:210,y:262},{x:120,y:264}]);
 await expect.poll(()=>page.evaluate(()=>window.events.some(e=>e[0]==='release'&&e[1]))).toBe(true);
});
test('controls and horizontal scrollers retain their gestures and teardown cancels',async({page})=>{
 await fixture(page);const b=await page.getByRole('button',{name:'Control'}).boundingBox();
 await drag(page,[{x:b.x+20,y:b.y+15},{x:b.x+120,y:b.y+16}]);expect(await page.evaluate(()=>window.events)).toEqual([]);
 const h=await page.locator('.horizontal').boundingBox();
 await drag(page,[{x:h.x+170,y:h.y+30},{x:h.x+110,y:h.y+31},{x:h.x+30,y:h.y+32}]);
 expect(await page.evaluate(()=>window.events)).toEqual([]);expect(await page.locator('.horizontal').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await page.evaluate(()=>window.swipe.destroy());
});
