export async function dragDestination(page,{direction='next',distance=170,cancel=false}={}){
 const client=await page.context().newCDPSession(page),width=page.viewportSize().width;
 const x=direction==='next'?width-60:60,sign=direction==='next'?-1:1,y=280;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(const dx of [16,Math.min(60,distance),distance])await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+sign*dx,y:y+2}]});
 if(distance<30)await page.waitForTimeout(150);
 await client.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await client.detach();
}
