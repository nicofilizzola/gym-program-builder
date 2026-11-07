import {PROFILE_LIMITS,EXPERIENCE_LEVELS,normalizeProfile} from './profile.js';
import {PROGRAM_CONTEXT_MAX_LENGTH} from './program-context.js';
import {EQUIPMENT} from './catalog.js';
import {equipmentIcon} from './equipment-controls.js';
import {mountSliderPresentation} from './slider-presentation.js';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
/** Each slider's leftmost position is a sentinel stored as null. */
const SLIDERS={
 maxTrainingDaysPerWeek:{label:'Max training days per week',min:0,empty:'No limit',text:v=>String(v)},
 maxSessionMinutes:{label:'Max session length',min:15,empty:'No limit',text:v=>v+' min'},
 typicalRepsInReserve:{label:'Typical reps in reserve',min:-1,empty:'Not set',text:v=>String(v)},
};
const RADIOS={
 maxSessionsPerDay:{label:'Max sessions per day',options:[[null,'No limit'],[1,'1'],[2,'2']]},
 experienceLevel:{label:'Level',options:[[null,'Not set'],...EXPERIENCE_LEVELS.map((level,i)=>[level,['Beginner (<1 yr)','Intermediate (1–3 yrs)','Advanced (3+ yrs)'][i]])]},
};
const TEXTS={
 trainingBackgroundAndApproach:{label:'Training background and approach',example:'Example: Two years of consistent training. Usually leave 1–2 reps in reserve and increase weight at the top of the rep range.'},
 constraintsAndPreferences:{label:'Constraints and preferences',example:'Example: Bad left shoulder, avoid overhead pressing. Prefer machines for isolation work.'},
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const textValue=(key,raw)=>{try{return normalizeProfile({[key]:raw})[key];}catch{return null;}};

function sliderField(key){
 const {label,min}=SLIDERS[key],{max,step}=PROFILE_LIMITS[key];
 return `<div class="slider-field profile-field"><div class="slider-head"><label for="profile-${key}">${label}</label><span class="slider-value" aria-hidden="true"></span></div><div class="slider"><span class="slider-fill"></span><input type="range" id="profile-${key}" data-profile-key="${key}" min="${min}" max="${max}" step="${step}"></div></div>`;
}
function radioField(key){
 const {label,options}=RADIOS[key];
 return `<fieldset class="profile-field" data-profile-key="${key}"><legend>${label}</legend><div class="segmented-control">${options.map(([value,text])=>`<label><input type="radio" name="profile-${key}" value="${value??''}"><span>${text.replace(/</g,'&lt;')}</span></label>`).join('')}</div></fieldset>`;
}
/** Without a visible label the section heading names the group (`heading` becomes its accessible name). */
function pillField(key,label,items,help,heading=label){
 const name=label?`aria-labelledby="profile-${key}-label"`:`aria-label="${heading}"`;
 return `<div class="profile-field profile-pill-field">${label?`<span class="profile-label" id="profile-${key}-label">${label}</span>`:''}<div class="toggle-pills" role="group" data-profile-key="${key}" ${name} aria-describedby="profile-${key}-help">${items.join('')}</div><p id="profile-${key}-help" class="program-context-help">${help}</p></div>`;
}
function textField(key){
 return `<div class="field profile-field"><label for="profile-${key}">${TEXTS[key].label}</label><textarea id="profile-${key}" name="${key}" data-profile-key="${key}" rows="5" maxlength="${PROGRAM_CONTEXT_MAX_LENGTH}" aria-describedby="profile-${key}-help profile-note"></textarea><p id="profile-${key}-help" class="program-context-help">${TEXTS[key].example}</p></div>`;
}
const section=(title,body)=>`<div class="profile-section"><h2>${title}</h2><div class="profile-fields">${body}</div></div>`;

/**
 * Profile page: a local draft of all nine fields. Each control edit updates the draft and emits the whole
 * normalized draft. Saved acknowledgements only adopt fields the user has not changed since the last saved
 * base, and only touch controls whose value differs, so focus, caret and slider drags are never disturbed.
 * `setProfile` (Reload saved version) replaces the draft and every control.
 */
export function mountProfileView(root,{profile,onChange,onSaveStatusSlotChange=()=>{}}){
 const page=document.createElement('section');page.className='profile-page';
 const days=DAYS.map((day,i)=>`<button type="button" class="toggle-pill" data-value="${i}" aria-label="${day}" aria-pressed="false">${day.slice(0,3)}</button>`);
 const equipment=EQUIPMENT.map(item=>`<button type="button" class="toggle-pill" data-value="${item}" aria-pressed="false">${equipmentIcon(item)}<span>${item}</span></button>`);
 page.innerHTML=`<header class="profile-heading"><h1>Profile</h1><div class="page-save-slot" data-save-slot></div></header>`
  +section('Schedule',sliderField('maxTrainingDaysPerWeek')+pillField('availableWeekdays','Available days',days,'None selected means not specified.')+radioField('maxSessionsPerDay'))
  +section('Session length',sliderField('maxSessionMinutes'))
  +section('Experience',radioField('experienceLevel')+sliderField('typicalRepsInReserve'))
  +section('Equipment',pillField('equipment',null,equipment,'None selected means not specified.','Equipment'))
  +section('Notes',textField('trainingBackgroundAndApproach')+textField('constraintsAndPreferences'))
  +`<p id="profile-note" class="program-context-help">Used by AI program reviews. Not included in program exports.</p><p class="error" role="alert"></p>`;
 const error=page.querySelector('.error'),events=new AbortController(),signal=events.signal;
 const control=key=>page.querySelector(`[data-profile-key="${key}"]`);
 const composing=new Set();
 let base=normalizeProfile(profile),draft=structuredClone(base);
 root.append(page);onSaveStatusSlotChange(page.querySelector('[data-save-slot]'));
 const sliders=mountSliderPresentation(page);

 function render(key){
  const value=draft[key],el=control(key);
  if(SLIDERS[key]){
   const {min,empty,text}=SLIDERS[key],position=value??min,label=value===null?empty:text(value);
   if(el.valueAsNumber!==position)el.value=String(position);
   if(el.getAttribute('aria-valuetext')!==label)el.setAttribute('aria-valuetext',label);
   const readout=el.closest('.slider-field').querySelector('.slider-value');
   readout.textContent=label;readout.classList.toggle('is-empty',value===null);
   el.parentElement.style.setProperty('--to',(position-min)/(Number(el.max)-min));
   sliders.sync();
  }else if(RADIOS[key]){
   const radio=el.querySelector(`input[value="${CSS.escape(String(value??''))}"]`);
   if(radio&&!radio.checked)radio.checked=true;
  }else if(TEXTS[key]){
   if(composing.has(key)||textValue(key,el.value)===value)return;
   const active=document.activeElement===el,start=el.selectionStart,end=el.selectionEnd;
   el.value=value;if(active)el.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length));
  }else for(const button of el.querySelectorAll('button')){
   const raw=button.dataset.value,pressed=String(value.includes(key==='availableWeekdays'?Number(raw):raw));
   if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
  }
 }
 const renderAll=()=>Object.keys(draft).forEach(render);
 function edit(key,value){
  draft={...draft,[key]:value};
  let next;try{next=normalizeProfile(draft);}catch(e){error.textContent=e.message;return;}
  error.textContent='';draft=next;render(key);onChange(structuredClone(next));
 }

 for(const key of Object.keys(SLIDERS))control(key).addEventListener('input',event=>{
  const n=event.target.valueAsNumber;edit(key,n===SLIDERS[key].min?null:n);
 },{signal});
 for(const key of Object.keys(RADIOS))control(key).addEventListener('change',event=>{
  const raw=event.target.value;edit(key,raw===''?null:key==='maxSessionsPerDay'?Number(raw):raw);
 },{signal});
 for(const key of ['availableWeekdays','equipment'])control(key).addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const item=key==='availableWeekdays'?Number(button.dataset.value):button.dataset.value;
  edit(key,draft[key].includes(item)?draft[key].filter(v=>v!==item):[...draft[key],item]);
 },{signal});
 for(const key of Object.keys(TEXTS)){
  const input=control(key);
  input.addEventListener('input',()=>{if(!composing.has(key))edit(key,input.value);},{signal});
  input.addEventListener('compositionstart',()=>composing.add(key),{signal});
  input.addEventListener('compositionend',()=>{composing.delete(key);input.dispatchEvent(new Event('input'));},{signal});
 }

 function setProfile(value){base=normalizeProfile(value);draft=structuredClone(base);renderAll();}
 function syncSaved(value){
  const next=normalizeProfile(value),merged={...draft};
  for(const key of Object.keys(next))if(same(draft[key],base[key]))merged[key]=next[key];
  base=next;const changed=Object.keys(merged).filter(key=>!same(merged[key],draft[key]));
  draft=merged;changed.forEach(render);
 }
 renderAll();
 return {setProfile,syncSaved,destroy(){onSaveStatusSlotChange(null);sliders.destroy();events.abort();page.remove();}};
}
