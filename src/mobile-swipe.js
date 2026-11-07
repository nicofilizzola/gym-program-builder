import {createSwipeGesture} from './swipe-gesture.js';

export function mountMobileSwipe(root,{enabled,canStart,begin,update,release,cancel:onCancel}){
 const events=new AbortController(),signal=events.signal;let gesture=null,id=null,dragging=false;
 const excluded=target=>{
  if(target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable=false]),[draggable=true],[data-sortable-handle],[role=slider]'))return true;
  for(let el=target;el&&root.contains(el);el=el.parentElement){
   if(el.scrollWidth>el.clientWidth+1&&['auto','scroll'].includes(getComputedStyle(el).overflowX))return true;
  }
  return Boolean(window.getSelection()?.toString());
 };
 function cancel(){const was=dragging;gesture?.cancel();gesture=null;id=null;dragging=false;if(was)onCancel();}
 root.addEventListener('touchstart',event=>{
  if(event.touches.length!==1){cancel();return;}
  if(!enabled()||excluded(event.target)||!canStart(event.target))return;
  const t=event.touches[0];gesture=createSwipeGesture({width:innerWidth,canPrevious:true,canNext:true});
  if(!gesture.start({x:t.clientX,y:t.clientY,time:event.timeStamp})){gesture=null;return;}id=t.identifier;
 },{passive:true,signal});
 root.addEventListener('touchmove',event=>{
  if(!gesture)return;if(!enabled()||event.touches.length!==1){cancel();return;}
  const t=[...event.touches].find(t=>t.identifier===id);if(!t){cancel();return;}
  const result=gesture.move({x:t.clientX,y:t.clientY,time:event.timeStamp});
  if(result.phase==='vertical'||result.phase==='canceled'){cancel();return;}
  if(result.phase!=='dragging')return;
  if(!dragging){if(!begin(result.direction)){cancel();return;}dragging=true;}
  if(event.cancelable)event.preventDefault();update(result.offset);
 },{passive:false,signal});
 window.addEventListener('touchend',event=>{
  if(!gesture)return;const t=[...event.changedTouches].find(t=>t.identifier===id);if(!t)return;
  const result=gesture.end({x:t.clientX,y:t.clientY,time:event.timeStamp}),was=dragging;gesture=null;id=null;dragging=false;
  if(was)release(result);
 },{signal});
 window.addEventListener('touchcancel',cancel,{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},{signal});
 return {cancel,destroy(){cancel();events.abort();}};
}
