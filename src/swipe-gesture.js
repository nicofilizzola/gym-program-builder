/** CSS-pixel/time-only recognizer; never mutates the DOM or a route. */
export function createSwipeGesture({width,canPrevious,canNext}){
 let origin=null,phase='canceled',direction=null,offset=0,samples=[],lastTravel=0,last=null;
 const value=()=>({phase,direction,offset,progress:Math.min(1,Math.abs(offset)/width)});
 function move(point){
  if(!origin||phase==='canceled'||phase==='vertical')return value();
  const dx=point.x-origin.x,dy=point.y-origin.y;
  if(last&&Math.abs(point.x-last.x)>=2)lastTravel=point.x-last.x;
  last=point;samples.push(point);samples=samples.filter(p=>p.time>=point.time-100);
  if(phase==='pending'){
   if(Math.abs(dy)>=12&&Math.abs(dy)>Math.abs(dx)){phase='vertical';return value();}
   if(Math.abs(dx)<12||Math.abs(dx)<=Math.abs(dy)*1.5)return value();
   direction=dx<0?'next':'previous';
   if(direction==='next'?!canNext:!canPrevious){phase='canceled';return value();}
   phase='dragging';
  }
  if((direction==='next'&&dx>0)||(direction==='previous'&&dx<0)){phase='canceled';return value();}
  offset=Math.max(-width,Math.min(width,dx));return value();
 }
 return {
  start(point){
   origin=null;phase='canceled';direction=null;offset=0;samples=[];lastTravel=0;
   if(point.x<24||point.x>width-24)return false;
   origin=last=point;samples=[point];phase='pending';return true;
  },
  move,
  end(point){
   move(point);const recent=samples[0],dt=recent?point.time-recent.time:0,velocity=dt>0?(point.x-recent.x)/dt:0;
   const forward=lastTravel===0||Math.sign(lastTravel)===Math.sign(offset);
   const commit=phase==='dragging'&&forward&&(Math.abs(offset)>=width*.25||(Math.abs(offset)>=24&&velocity*Math.sign(offset)>=.5));
   const result={commit,direction,offset};origin=null;phase='canceled';return result;
  },
  cancel(){origin=null;phase='canceled';samples=[];offset=0;direction=null;}
 };
}
