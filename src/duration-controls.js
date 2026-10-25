import {computeDuration,DURATION_LIMITS,durationLabel,formatDuration,normalizeWorkoutTiming} from './duration.js';

/** Inline disclosure; updates preserve the user's focused node and open state. */
export function mountDurationControls(host,{workout,onChange=()=>{}}) {
  const controller=new AbortController();
  const panelId='duration-details-'+crypto.randomUUID();
  host.classList.add('duration-controls');
  host.innerHTML='<button type="button" class="secondary-btn duration-toggle" aria-expanded="false" aria-label="Show duration details"><span>Estimated duration</span> <strong data-duration-total></strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="duration-details" hidden><dl class="duration-breakdown"></dl><div class="duration-allowances"></div><p class="duration-hint">1 min per set, plus rest after every set. Buffer applies to the full subtotal.</p></div>';
  const toggle=host.querySelector('button'),details=host.querySelector('.duration-details');
  details.id=panelId;toggle.setAttribute('aria-controls',panelId);
  const total=host.querySelector('[data-duration-total]');
  total.id=panelId+'-total';toggle.setAttribute('aria-describedby',total.id);
  const labels={executionSeconds:'Execution',restSeconds:'Rest',extraSeconds:'Extra time',bufferSeconds:'Buffer'};
  for(const [key,label] of Object.entries(labels)) {
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.dataset.durationPart=key;row.append(dt,dd);host.querySelector('dl').append(row);
  }
  for(const [key,label] of [['extraMinutes','Extra time'],['bufferPercent','Buffer']]) {
    const field=document.createElement('div');field.className='slider-field';
    const limits=DURATION_LIMITS[key];
    field.innerHTML='<div class="slider-head"><span>'+label+'</span><span class="slider-value" aria-hidden="true"></span></div><div class="slider"><span class="slider-fill"></span><input type="range" aria-label="'+label+'" min="'+limits.min+'" max="'+limits.max+'" step="'+limits.step+'"></div>';
    const input=field.querySelector('input');input.dataset.allowance=key;
    host.querySelector('.duration-allowances').append(field);
  }
  let value;
  function update(next) {
    value=normalizeWorkoutTiming(next);
    host.querySelector('[data-duration-total]').textContent=durationLabel(value);
    const totals=computeDuration(value);
    host.querySelectorAll('[data-duration-part]').forEach(el=>{el.textContent=formatDuration(totals[el.dataset.durationPart]);});
    host.querySelectorAll('[data-allowance]').forEach(input=>{
      const key=input.dataset.allowance,n=value[key],text=key==='extraMinutes'?formatDuration(n*60):n+'%';
      input.value=n;input.setAttribute('aria-valuetext',text);
      input.closest('.slider-field').querySelector('.slider-value').textContent=text;
      input.parentElement.style.setProperty('--to',n/DURATION_LIMITS[key].max);
    });
  }
  toggle.addEventListener('click',()=>{
    details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));
    toggle.setAttribute('aria-label',details.hidden?'Show duration details':'Hide duration details');
  },{signal:controller.signal});
  host.addEventListener('input',event=>{
    const input=event.target,key=input.dataset.allowance;if(!key)return;
    const settings={extraMinutes:value.extraMinutes,bufferPercent:value.bufferPercent,[key]:input.valueAsNumber};
    update({...value,...settings});onChange(settings);
  },{signal:controller.signal});
  update(workout);
  return {update,destroy(){controller.abort();host.replaceChildren();}};
}
