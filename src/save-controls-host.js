/** Relocate the same live feedback nodes; account controls remain in the desktop shell. */
export function mountSaveControlsHost({controls,desktopHost,mobileFallback,media}){
 let slot=null,lastMobile=media.matches,lastFocused=null;const events=new AbortController();
 document.addEventListener('focusin',event=>{lastFocused=controls.contains(event.target)?event.target:null;},{signal:events.signal});
 controls.addEventListener('focusout',event=>{if(event.relatedTarget||event.target.getClientRects().length)lastFocused=null;},{signal:events.signal});
 function place(){
  const changed=lastMobile!==media.matches;lastMobile=media.matches;
  const focused=changed&&document.activeElement===document.body?lastFocused:document.activeElement,owned=focused&&controls.contains(focused);
  const target=media.matches?(slot||mobileFallback):desktopHost;
  if(controls.parentElement!==target)target.append(controls);
  const present=Boolean(controls.querySelector('[role=status]')?.textContent||[...controls.querySelectorAll('button')].some(b=>!b.hidden));
  if(controls.hidden===present)controls.hidden=!present;
  mobileFallback.hidden=!media.matches||Boolean(slot)||!present;
  if(owned&&focused.isConnected&&!focused.closest('[inert]'))focused.focus({preventScroll:true});
 }
 const observer=new MutationObserver(place);observer.observe(controls,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
 media.addEventListener('change',place,{signal:events.signal});place();
 return {setSlot(value){slot=value;place();},park(){slot=null;place();},destroy(){events.abort();observer.disconnect();slot=null;desktopHost.append(controls);mobileFallback.hidden=true;}};
}
