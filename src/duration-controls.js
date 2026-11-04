import {mountSliderPresentation} from './slider-presentation.js';
import {computeDuration,DURATION_LIMITS,durationLabel,formatDuration,normalizeWorkoutTiming} from './duration.js';
import {mountActionTooltips} from './action-controls.js';
import {limitHint} from './limit-hint.js';

/** Inline disclosure; updates preserve the user's focused node and open state. */
export function mountDurationControls(host,{workout,onChange=()=>{},maxSessionMinutes=null}) {
  const controller=new AbortController();
  const panelId='duration-details-'+crypto.randomUUID();
  host.classList.add('duration-controls');
  host.innerHTML='<button type="button" class="secondary-btn duration-toggle" aria-expanded="false" aria-label="Show duration details" data-action-tooltip="Show duration details"><svg class="duration-clock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><strong data-duration-total></strong><svg class="duration-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></button><div class="duration-details" inert aria-hidden="true"><div class="duration-details-clip"><div class="duration-details-content"><dl class="duration-breakdown"></dl><div class="duration-allowances"></div><p class="duration-hint">1 min per set, plus rest after every set. Warm-ups have no rest between them. Buffer applies to the full subtotal.</p></div></div></div>';
  const tooltips=mountActionTooltips(host);
  const toggle=host.querySelector('button'),details=host.querySelector('.duration-details');
  details.id=panelId;toggle.setAttribute('aria-controls',panelId);
  const total=host.querySelector('[data-duration-total]');
  total.id=panelId+'-total';toggle.setAttribute('aria-describedby',total.id);
  const labels={warmupSeconds:'Warm-up',executionSeconds:'Execution',restSeconds:'Rest',extraSeconds:'Extra time',bufferSeconds:'Buffer'};
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
  let value,hint=null;
  /** Profile limit suffix after the total: added/removed instantly and announced with the total. */
  function syncLimitHint() {
    const over=maxSessionMinutes!==null&&computeDuration(value).displayMinutes>maxSessionMinutes;
    const text=over?'over '+maxSessionMinutes+' min max':null;
    if((hint?.textContent??null)===text)return;
    hint?.remove();hint=null;
    if(text){hint=limitHint(text);hint.id=panelId+'-limit';total.after(hint);}
    // Keep any shared-tooltip id while swapping the hint into the total's description.
    const others=(toggle.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==total.id&&id!==panelId+'-limit');
    toggle.setAttribute('aria-describedby',[total.id,...(hint?[hint.id]:[]),...others].join(' '));
  }
  const sliderPresentation=mountSliderPresentation(host);
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
    sliderPresentation.sync();
    syncLimitHint();
  }
  let opened=false;
  function setExpanded(next) {
    if(!next&&details.contains(document.activeElement))toggle.focus({preventScroll:true});
    tooltips.hide();opened=next;
    host.setAttribute('data-duration-motion','');
    toggle.setAttribute('aria-expanded',String(opened));
    const label=opened?'Hide duration details':'Show duration details';
    toggle.setAttribute('aria-label',label);toggle.dataset.actionTooltip=label;
    details.inert=!opened;details.setAttribute('aria-hidden',String(!opened));
    details.classList.toggle('is-open',opened);
  }
  toggle.addEventListener('click',()=>setExpanded(!opened),{signal:controller.signal});
  host.addEventListener('input',event=>{
    const input=event.target,key=input.dataset.allowance;if(!key)return;
    const settings={extraMinutes:value.extraMinutes,bufferPercent:value.bufferPercent,[key]:input.valueAsNumber};
    update({...value,...settings});onChange(settings);
  },{signal:controller.signal});
  update(workout);
  return {update,setMaxSessionMinutes(next){maxSessionMinutes=next??null;syncLimitHint();},destroy(){sliderPresentation.destroy();controller.abort();tooltips.destroy();host.replaceChildren();host.removeAttribute('data-duration-motion');}};
}
