import {actionIcon} from './action-controls.js';
import {destinationFor,isSwipeRoot} from './mobile-navigation-state.js';

export function mountMobileNavigation(nav,{state,onNavigate}){
 const media=matchMedia('(max-width:760px)'),events=new AbortController();
 const links=new Map([...nav.querySelectorAll('[data-nav]')].map(a=>[a.dataset.nav,a]));
 const icons={programs:'calendar',templates:'template',home:'home',workouts:'history',catalog:'catalog',library:'template',user:'profile'};
 for(const [key,a] of links)a.insertAdjacentHTML('afterbegin',actionIcon(icons[key]));
 const indicator=document.createElement('span');indicator.className='mobile-nav-indicator';indicator.setAttribute('aria-hidden','true');nav.append(indicator);
 let current=location.hash,lastMobile=media.matches,lastFocused=null,geometry=new Map();
 document.addEventListener('focusin',event=>{lastFocused=nav.contains(event.target)?event.target:null;},{signal:events.signal});
 nav.addEventListener('focusout',()=>{if(lastMobile===media.matches)lastFocused=null;},{signal:events.signal});
 const key=dest=>dest==='history'?'workouts':dest;
 function position(dest){if(geometry.has(dest))return geometry.get(dest);const a=links.get(key(dest)),r=a?.getBoundingClientRect(),n=nav.getBoundingClientRect();const value=r?{left:r.left-n.left+r.width*.25,width:r.width*.5}:null;geometry.set(dest,value);return value;}
 function preview({from,to,progress}){
  const a=position(from),b=position(to);if(!a||!b)return;
  indicator.style.transform='translateX('+(a.left+(b.left-a.left)*progress)+'px)';
  indicator.style.width=(a.width+(b.width-a.width)*progress)+'px';indicator.hidden=false;
 }
 function resetPreview(){geometry.clear();const dest=destinationFor(current);indicator.hidden=!dest;if(dest)preview({from:dest,to:dest,progress:0});}
 function commit(hash,{preservePreview=false}={}){
  current=hash;state.commit(hash);links.get('library').href=state.href('library');
  const dest=destinationFor(hash);
  for(const [name,a] of links){
   const selected=media.matches?name===key(dest):name===({library:hash.startsWith('#/catalog')?'catalog':hash.startsWith('#/templates')?'templates':'programs',history:'workouts'}[dest]??dest);
   if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  if(!preservePreview)resetPreview();
 }
 function arrange(){
  const changed=lastMobile!==media.matches;lastMobile=media.matches;
  const focused=changed&&document.activeElement===document.body?lastFocused:document.activeElement,had=Boolean(focused&&nav.contains(focused));
  for(const name of media.matches?['home','library','workouts','user','programs','templates','catalog']:['programs','templates','catalog','workouts','home','library','user'])nav.append(links.get(name));
  nav.append(indicator);commit(current);
  if(had){
   const target=focused.getClientRects().length?focused:[...nav.querySelectorAll('[aria-current=page]')].find(a=>a.getClientRects().length)||document.querySelector('#app h1')||links.get(media.matches?'home':'programs');
   if(target?.matches('h1'))target.tabIndex=-1;
   target?.focus({preventScroll:true});
  }
 }
 nav.addEventListener('click',event=>{
  const a=event.target.closest('[data-nav]');if(!a||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();onNavigate(a.hash);
 },{signal:events.signal});
 media.addEventListener('change',arrange,{signal:events.signal});
 const resize=new ResizeObserver(resetPreview);resize.observe(nav);arrange();
 return {commit,preview,resetPreview,destroy(){events.abort();resize.disconnect();indicator.remove();}};
}
