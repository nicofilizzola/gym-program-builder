import {WORKOUT_COVERS,normalizeWorkoutCover} from './workout-cover.js';

let controls=0;
export function mountWorkoutCoverControls(host,{coverId,onChange}){
 const id='workout-cover-'+(++controls),events=new AbortController();
 const toggle=document.createElement('button');toggle.type='button';toggle.className='secondary-btn workout-cover-toggle';
 toggle.textContent='Workout cover';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',id);
 const region=document.createElement('div');region.id=id;region.className='collapsible is-closed';region.inert=true;
 const inner=document.createElement('div');inner.className='workout-cover-inner';
 const fieldset=document.createElement('fieldset');fieldset.className='workout-cover-options';
 const legend=document.createElement('legend');legend.className='visually-hidden';legend.textContent='Workout cover';fieldset.append(legend);
 const radios=WORKOUT_COVERS.map(cover=>{
  const label=document.createElement('label');label.className='workout-cover-choice';
  const input=document.createElement('input');input.type='radio';input.name=id;input.value=cover.id;
  const image=document.createElement('img');image.src=cover.src;image.alt='';image.width=cover.width;image.height=cover.height;image.loading='lazy';image.style.objectPosition=cover.objectPosition;
  const text=document.createElement('span');text.textContent=cover.label;
  label.append(input,image,text);fieldset.append(label);
  input.addEventListener('change',()=>{if(input.checked)onChange(input.value);},{signal:events.signal});
  return input;
 });
 inner.append(fieldset);region.append(inner);host.append(toggle,region);
 toggle.addEventListener('click',()=>{
  const open=toggle.getAttribute('aria-expanded')!=='true';
  if(!open&&region.contains(document.activeElement))toggle.focus();
  toggle.setAttribute('aria-expanded',String(open));region.inert=!open;region.classList.toggle('is-closed',!open);
 },{signal:events.signal});
 function setCoverId(value){const selected=normalizeWorkoutCover(value);for(const radio of radios)radio.checked=radio.value===selected;}
 setCoverId(coverId);
 return {setCoverId,destroy(){events.abort();host.replaceChildren();}};
}
