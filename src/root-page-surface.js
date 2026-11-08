/** Stable loading/status controls surrounding one live root view. */
export function mountRootPageSurface(host,{title,onRetry}){
 const section=document.createElement('section');section.className='root-page-surface';section.dataset.rootState='loading';
 const placeholder=document.createElement('div'),heading=document.createElement('h1'),skeleton=document.createElement('div');
 heading.textContent=title;heading.tabIndex=-1;skeleton.className='root-page-skeleton';skeleton.textContent='Loading...';skeleton.setAttribute('role','status');placeholder.append(heading,skeleton);
 const content=document.createElement('div'),feedback=document.createElement('div'),text=document.createElement('p'),retry=document.createElement('button');
 feedback.className='root-page-feedback';text.setAttribute('role','status');retry.type='button';retry.className='secondary-btn';retry.textContent='Retry';retry.onclick=onRetry;retry.hidden=true;feedback.append(text,retry);section.append(placeholder,content,feedback);host.append(section);
 let populated=false;
 return {show(state){section.dataset.rootState=state.phase;content.setAttribute('aria-busy',String(state.refreshing));skeleton.hidden=state.phase!=='loading';text.textContent=state.error?(state.data===undefined?(state.error.message||'This page could not be loaded.') :"Couldn't refresh. Showing previously loaded data."):(state.refreshing?'Updating...':'');retry.hidden=!state.error;},setContent(mount){if(populated)return;const hadFocus=document.activeElement===heading;mount(content);populated=true;placeholder.remove();if(hadFocus){const next=content.querySelector('h1');if(next){next.tabIndex=-1;next.focus({preventScroll:true});}}},destroy(){section.remove();}};
}
