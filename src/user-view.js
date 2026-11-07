import {actionIcon} from './action-controls.js';
export function mountUserView(root,{onNavigate,onLogout}){
 const page=document.createElement('section');page.className='user-page';
 page.innerHTML='<h1>User</h1><a class="user-profile" href="#/profile">'+actionIcon('profile')+'<span>Training profile</span><span aria-hidden="true">›</span></a><div class="user-account-actions"><button type="button" class="secondary-btn user-logout">'+actionIcon('logout')+'Log out</button></div><p class="error" role="alert"></p>';
 const events=new AbortController();let busy=false;
 page.querySelector('a').addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();if(!busy)onNavigate('#/profile');},{signal:events.signal});
 page.querySelector('button').addEventListener('click',async()=>{
  if(busy)return;busy=true;page.inert=true;const button=page.querySelector('button');button.disabled=true;page.querySelector('.error').textContent='';
  try{await onLogout();}catch(error){page.querySelector('.error').textContent=error.message||'Could not log out. Try again.';}
  finally{busy=false;page.inert=false;button.disabled=false;}
 },{signal:events.signal});
 root.append(page);return {destroy(){events.abort();page.remove();}};
}
