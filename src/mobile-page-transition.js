import {destinationFor,isSwipeRoot} from './mobile-navigation-state.js';

/** Decorative snapshots only. The router remains the sole owner of live views. */
export function createMobilePageTransition({app,stage,navigation,media,reduced}){
 const snapshots=new Map(),events=new AbortController();let session=null,generation=0,frame=null,finish=null;
 function snapshot(){
  const rect=app.getBoundingClientRect(),node=app.cloneNode(true);
  for(const el of [node,...node.querySelectorAll('*')]){
   for(const attr of [...el.attributes])if(['id','name','autofocus','data-testid','for','aria-live','aria-labelledby','aria-describedby','aria-controls','aria-owns','aria-activedescendant'].includes(attr.name)||attr.name.startsWith('on'))el.removeAttribute(attr.name);
   if(['status','alert','log'].includes(el.getAttribute('role')))el.removeAttribute('role');
   if(el.matches('input,textarea,select,button,a,[tabindex]'))el.tabIndex=-1;
  }
  const originals=app.querySelectorAll('input,textarea,select'),copies=node.querySelectorAll('input,textarea,select');
  originals.forEach((el,i)=>{copies[i].value=el.value;if('checked'in el)copies[i].checked=el.checked;});
  Object.assign(node.style,{position:'absolute',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',margin:'0'});
  return {node,width:innerWidth};
 }
 function capture(hash){if(isSwipeRoot(hash)&&app.childElementCount)snapshots.set(hash,snapshot());}
 function layer(kind,saved,hash){
  const node=document.createElement('div');node.className='mobile-page-layer';node.dataset.pageLayer=kind;
  if(saved?.width===innerWidth)node.append(saved.node.cloneNode(true));
  else{const loading=document.createElement('div');loading.className='mobile-page-loading';const h=document.createElement('h2');h.textContent=({home:'Home',library:'Library',history:'History',user:'User'})[destinationFor(hash)];const p=document.createElement('p');p.textContent='Loading…';loading.append(h,p);node.append(loading);}
  stage.append(node);return node;
 }
 function update(offset){
  if(!session)return;session.offset=offset;if(reduced.matches)return;
  const sign=session.direction==='next'?-1:1;
  session.source.style.transform='translateX('+offset+'px)';
  session.target.style.transform='translateX('+(offset-sign*session.width)+'px)';
  navigation.preview({from:destinationFor(session.fromHash),to:destinationFor(session.toHash),progress:Math.min(1,Math.abs(offset)/session.width)});
 }
 function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;const done=finish;finish=null;done?.(false);}
 function cancel(){generation++;stop();session=null;stage.hidden=true;stage.replaceChildren();navigation.resetPreview();}
 function animate(to,duration){
  const version=generation,from=session.offset,start=performance.now();
  return new Promise(resolve=>{
   finish=resolve;
   const tick=now=>{
    if(version!==generation||!session){finish=null;resolve(false);return;}
    const progress=Math.min(1,(now-start)/duration);update(from+(to-from)*(1-Math.pow(1-progress,3)));
    if(progress<1)frame=requestAnimationFrame(tick);else{frame=null;finish=null;resolve(true);}
   };frame=requestAnimationFrame(tick);
  });
 }
 media.addEventListener('change',cancel,{signal:events.signal});reduced.addEventListener('change',cancel,{signal:events.signal});
 window.addEventListener('resize',cancel,{signal:events.signal});
 return {
  capture,
  begin({fromHash,toHash,direction,width}){
   cancel();if(!media.matches)return false;capture(fromHash);
   session={fromHash,toHash,direction,width,offset:0,source:null,target:null};
   if(!reduced.matches){session.source=layer('source',snapshots.get(fromHash),fromHash);session.target=layer('target',snapshots.get(toHash),toHash);stage.hidden=false;update(0);}
   return true;
  },
  update,
  async complete({commit,restore,focus,isCurrent}){
   if(!isCurrent()){cancel();return false;}
   const version=generation,owned=session;commit();await restore();
   if(!isCurrent()||version!==generation){if(version===generation)cancel();return false;}
   if(owned&&!reduced.matches){
    capture(owned.toHash);owned.target.replaceChildren(snapshots.get(owned.toHash).node.cloneNode(true));update(owned.offset);
    if(!await animate((owned.direction==='next'?-1:1)*owned.width,220))return false;
   }
   if(!isCurrent()||version!==generation)return false;cancel();focus();return true;
  },
  async rollback(){const version=generation;if(session&&!reduced.matches)await animate(0,180);if(version===generation)cancel();},
  cancel,clear(){cancel();snapshots.clear();},destroy(){cancel();snapshots.clear();events.abort();}
 };
}
