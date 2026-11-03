import {PROFILE_TEXT_FIELDS,normalizeProfile} from './profile.js';
import {PROGRAM_CONTEXT_MAX_LENGTH} from './program-context.js';

const [key]=PROFILE_TEXT_FIELDS;
const example='Example: Two years of consistent training. Usually leave 1–2 reps in reserve and increase weight at the top of the rep range.';

/** Profile page: one prose field. Saved acknowledgements never move the caret or replace equal text. */
export function mountProfileView(root,{profile,onChange}){
 const page=document.createElement('section');page.className='profile-page';
 page.innerHTML=`<h1>Profile</h1><div class="field"><label for="profile-${key}">Training background and approach</label><textarea id="profile-${key}" name="${key}" rows="5" maxlength="${PROGRAM_CONTEXT_MAX_LENGTH}" aria-describedby="profile-help profile-note"></textarea><p id="profile-help" class="program-context-help"></p></div><p id="profile-note" class="program-context-help">Used by AI program reviews. Not included in program exports.</p><p class="error" role="alert"></p>`;
 const input=page.querySelector('textarea'),error=page.querySelector('.error'),events=new AbortController();
 page.querySelector('#profile-help').textContent=example;
 let composing=false,base=normalizeProfile(profile);
 const current=()=>{try{return normalizeProfile({[key]:input.value})[key];}catch{return null;}};
 function setProfile(value){
  base=normalizeProfile(value);const next=base[key];
  if(composing)return;
  if(current()===next)return;
  const active=document.activeElement===input,start=input.selectionStart,end=input.selectionEnd;
  input.value=next;if(active)input.setSelectionRange(Math.min(start,next.length),Math.min(end,next.length));
 }
 input.addEventListener('input',()=>{if(composing)return;try{const value=normalizeProfile({...base,[key]:input.value});error.textContent='';onChange(value);}catch(e){error.textContent=e.message;}},{signal:events.signal});
 input.addEventListener('compositionstart',()=>{composing=true;},{signal:events.signal});
 input.addEventListener('compositionend',()=>{composing=false;input.dispatchEvent(new Event('input'));},{signal:events.signal});
 input.value=normalizeProfile(profile)[key];root.append(page);
 return {setProfile,syncSaved:setProfile,destroy(){events.abort();page.remove();}};
}
