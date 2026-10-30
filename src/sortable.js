/** Pointer-only previews; views own all data and commit exactly once on drop. */
export function mountSortable(root,{itemSelector,reorderSelector,getGroups,getKey,onCommit}) {
 const events=new AbortController(),options={signal:events.signal};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let drag=null,frame=0,suppressClick=false,clickTimer=0,holdTimer=0;
 const controls='button,input,select,textarea,a,label,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],[role="combobox"],[role="listbox"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]';
 function eligible(target){
  const item=target.closest(itemSelector),control=target.closest(controls);
  return item&&root.contains(item)&&!(control&&item.contains(control)&&!control.matches('[data-sortable-heading]'))?item:null;
 }
 function clearClick(){clearTimeout(clickTimer);suppressClick=false;}
 const animations=new Map();
 const items=element=>[...element.querySelectorAll(itemSelector)].filter(el=>el!==drag?.item&&!el.classList.contains('sort-drag-copy'));
 function stopAnimations(){for(const a of animations.values())a.cancel();animations.clear();}
 function layoutRect(element){
  const rect=element.getBoundingClientRect(),transform=getComputedStyle(element).transform;
  const matrix=transform==='none'?{m41:0,m42:0}:new DOMMatrixReadOnly(transform);
  return {top:rect.top-matrix.m42,left:rect.left-matrix.m41,width:rect.width,height:rect.height};
 }
 function targetAt(x,y){
  const group=getGroups().find(({element})=>{const r=element.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
  if(!group)return null;
  const before=items(group.element).find(el=>{const r=layoutRect(el);return y<r.top+r.height/2;});
  return {group,before};
 }
 function preview(){
  if(!drag?.copy)return;
  const d=drag;
  d.copy.style.transform=`translate(${d.x-d.offsetX}px, ${d.y-d.offsetY}px)`;
  const target=targetAt(d.x,d.y);d.target=target;
  d.copy.classList.toggle('is-invalid-drop',!target);
  if(!target)return;
  const {group,before}=target;
  const siblings=[...d.placeholder.parentElement.children],next=siblings.slice(siblings.indexOf(d.placeholder)+1).find(el=>el.matches(itemSelector)&&el!==d.item)||null;
  if(d.placeholder.parentElement===group.element&&next===(before||null))return;
  const boxes=new Map(getGroups().flatMap(g=>items(g.element)).map(el=>[el,el.getBoundingClientRect()]));
  stopAnimations();
  group.element.insertBefore(d.placeholder,before||null);
  if(!reduced.matches)for(const [el,old] of boxes){
   const next=el.getBoundingClientRect(),dy=old.top-next.top,dx=old.left-next.left;
   if(dx||dy)animations.set(el,el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'}));
  }
 }
 function tick(){
  if(!drag?.copy)return;
  const {y}=drag,edge=48;
  const amount=y<edge?-12*(1-Math.max(y,0)/edge):y>innerHeight-edge?12*(1-Math.max(innerHeight-y,0)/edge):0;
  if(amount){window.scrollBy(0,amount);preview();}
  frame=requestAnimationFrame(tick);
 }
 function begin(){
  const d=drag,r=d.item.getBoundingClientRect();
  if(d.pointerId!==undefined)d.item.setPointerCapture(d.pointerId);
  d.copy=d.item.cloneNode(true);d.copy.classList.add('sort-drag-copy');
  for(const el of [d.copy,...d.copy.querySelectorAll('*')]){el.removeAttribute('id');el.removeAttribute('aria-controls');el.removeAttribute('aria-describedby');}
  d.copy.inert=true;d.copy.setAttribute('aria-hidden','true');
  Object.assign(d.copy.style,{width:`${r.width}px`,height:`${r.height}px`});
  document.body.append(d.copy);
  d.placeholder=document.createElement('div');d.placeholder.className='sort-placeholder';d.placeholder.setAttribute('aria-hidden','true');d.placeholder.style.height=`${r.height}px`;
  d.placeholder.style.margin=getComputedStyle(d.item).margin;
  d.item.before(d.placeholder);d.savedStyle=d.item.getAttribute('style');d.item.classList.add('sort-source');
  d.offsetX=d.startX-r.left;d.offsetY=d.startY-r.top;
  document.documentElement.classList.add('is-sorting');
  preview();frame=requestAnimationFrame(tick);
 }
 function finish(commit=false){
  const d=drag;if(!d)return;
  const result=commit&&d.copy&&d.target?{key:getKey(d.item),groupKey:d.target.group.key,beforeKey:d.target.before?getKey(d.target.before):null}:null;
  drag=null;clearTimeout(holdTimer);cancelAnimationFrame(frame);stopAnimations();
  d.copy?.remove();d.placeholder?.remove();d.item.classList.remove('sort-source','is-hold-armed');
  if(d.savedStyle!==undefined){if(d.savedStyle===null)d.item.removeAttribute('style');else d.item.setAttribute('style',d.savedStyle);}
  document.documentElement.classList.remove('is-sorting');
  if(d.pointerId!==undefined&&d.item.hasPointerCapture(d.pointerId))d.item.releasePointerCapture(d.pointerId);
  // Cancellation can still be followed by a native release click, even before
  // the preview starts. Keep it suppressed until consumed or a new press begins.
  if(!commit||d.copy||d.armed)suppressClick=true;
  if(d.copy)d.item.querySelector(reorderSelector)?.focus({preventScroll:true});
  if(result)onCommit(result);
 }
 root.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch')return;
  clearClick();const item=eligible(event.target);
  if(!item||event.button!==0||drag)return;
  event.preventDefault();
  drag={item,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY};
 },options);
 window.addEventListener('touchstart',event=>{
  clearClick();
  if(event.touches.length!==1){finish();return;}
  const item=eligible(event.target);if(!item||drag)return;
  const touch=event.touches[0];
  const candidate={item,touchId:touch.identifier,startX:touch.clientX,startY:touch.clientY,x:touch.clientX,y:touch.clientY,armed:false};
  drag=candidate;
  holdTimer=setTimeout(()=>{
   if(drag!==candidate||!item.isConnected)return;
   candidate.armed=true;item.classList.add('is-hold-armed');
   window.getSelection()?.removeAllRanges();
  },350);
 },{...options,passive:true});
 window.addEventListener('touchmove',event=>{
  if(drag?.touchId===undefined)return;
  const touch=[...event.touches].find(t=>t.identifier===drag.touchId);
  if(!touch||event.touches.length!==1){finish();return;}
  drag.x=touch.clientX;drag.y=touch.clientY;
  const distance=Math.hypot(drag.x-drag.startX,drag.y-drag.startY);
  if(!drag.armed){if(distance>8)finish();return;}
  if(!event.cancelable){finish();return;}
  event.preventDefault();
  if(!drag.copy&&distance>=5)begin();else preview();
 },{...options,passive:false});
 window.addEventListener('touchend',event=>{
  if(drag?.touchId===undefined||![...event.changedTouches].some(t=>t.identifier===drag.touchId))return;
  if(drag.copy)preview();finish(true);
 },options);
 window.addEventListener('touchcancel',()=>{if(drag?.touchId!==undefined)finish();},options);
 window.addEventListener('blur',()=>finish(),options);
 root.addEventListener('contextmenu',event=>{if(drag?.touchId!==undefined&&drag.item.contains(event.target))event.preventDefault();},options);
 root.addEventListener('selectstart',event=>{if(drag?.touchId!==undefined&&drag.item.contains(event.target))event.preventDefault();},options);
 window.addEventListener('pointermove',event=>{
  if(event.pointerId!==drag?.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  if(!drag.copy&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=5)begin();
  else preview();
 },options);
 window.addEventListener('pointerup',event=>{if(event.pointerId===drag?.pointerId){if(drag.copy)preview();finish(true);}},options);
 for(const name of ['pointercancel','lostpointercapture'])window.addEventListener(name,event=>{if(event.pointerId===drag?.pointerId)finish();},options);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();finish();}}, {...options,capture:true});
 root.addEventListener('click',event=>{if(suppressClick&&event.detail>0){clearClick();event.preventDefault();event.stopImmediatePropagation();}},{...options,capture:true});
 return {cancel:()=>finish(),destroy(){finish();clearTimeout(holdTimer);clearClick();events.abort();}};
}

