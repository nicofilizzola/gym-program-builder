export async function dragDestination(page,{direction='next',distance=170,cancel=false}={}){
 const client=await page.context().newCDPSession(page),width=page.viewportSize().width;
 const x=direction==='next'?width-60:60,sign=direction==='next'?-1:1;
 const y=await page.evaluate(x=>{for(const y of [280,...Array.from({length:50},(_,i)=>24+i*12)]){if(y>innerHeight-100)continue;const el=document.elementFromPoint(x,y);if(el?.closest('#app')&&!el.closest('a,button,input,textarea,select,[contenteditable=true]'))return y;}throw Error('No neutral swipe start area in app');},x);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(const dx of [16,Math.min(60,distance),distance])await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+sign*dx,y:y+2}]});
 if(distance<30)await page.waitForTimeout(150);
 await client.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await client.detach();
}
