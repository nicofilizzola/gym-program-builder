/** Pointer-only previews; views own all data and commit exactly once on drop. */
export function mountSortable(root,{itemSelector,handleSelector,getGroups,getKey,onCommit}) {
 const events=new AbortController(),options={signal:events.signal};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let drag=null,frame=0,suppressClick=false;
 const animations=new Map();
 const items=element=>[...element.querySelectorAll(itemSelector)].filter(el=>el!==drag?.item&&!el.classList.contains('sort-drag-copy'));
 function stopAnimations(){for(const a of animations.values())a.cancel();animations.clear();}
 function targetAt(x,y){
  const group=getGroups().find(({element})=>{const r=element.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
  if(!group)return null;
  const before=items(group.element).find(el=>{const r=el.getBoundingClientRect();return y<r.top+r.height/2;});
  return {group,before};
 }
 function preview(){
  if(!drag?.copy)return;
  const d=drag;
  d.copy.style.transform=`translate(${d.x-d.offsetX}px, ${d.y-d.offsetY}px)`;
  // Cancel previous transforms before measuring layout rather than measuring an animated box.
  stopAnimations();
  const target=targetAt(d.x,d.y);d.target=target;
  d.copy.classList.toggle('is-invalid-drop',!target);
  if(!target)return;
  const {group,before}=target;
  if(d.placeholder.parentElement===group.element&&d.placeholder.nextElementSibling===before)return;
  const boxes=new Map(getGroups().flatMap(g=>items(g.element)).map(el=>[el,el.getBoundingClientRect()]));
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
  drag=null;cancelAnimationFrame(frame);stopAnimations();
  d.copy?.remove();d.placeholder?.remove();d.item.classList.remove('sort-source');
  if(d.savedStyle!==undefined){if(d.savedStyle===null)d.item.removeAttribute('style');else d.item.setAttribute('style',d.savedStyle);}
  document.documentElement.classList.remove('is-sorting');
  if(d.handle.hasPointerCapture(d.pointerId))d.handle.releasePointerCapture(d.pointerId);
  if(d.copy){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}
  d.handle.focus({preventScroll:true});
  if(result)onCommit(result);
 }
 root.addEventListener('pointerdown',event=>{
  const handle=event.target.closest(handleSelector),item=handle?.closest(itemSelector);
  if(!handle||!item||event.button!==0||drag)return;
  event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
  drag={handle,item,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY};
 },options);
 window.addEventListener('pointermove',event=>{
  if(event.pointerId!==drag?.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  if(!drag.copy&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=5)begin();
  else preview();
 },options);
 window.addEventListener('pointerup',event=>{if(event.pointerId===drag?.pointerId){if(drag.copy)preview();finish(true);}},options);
 for(const name of ['pointercancel','lostpointercapture'])window.addEventListener(name,event=>{if(event.pointerId===drag?.pointerId)finish();},options);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();finish();}}, {...options,capture:true});
 root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},{...options,capture:true});
 return {cancel:()=>finish(),destroy(){finish();events.abort();}};
}

