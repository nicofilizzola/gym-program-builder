import {MUSCLE_GROUPS} from './muscles.js';
import {barScale,barSegments,goalStatus,visibleMuscles} from './volume.js';
import {SESSION_MARKUP} from './session-markup.js';

/** Weekly overview: goal-status bars reuse the workout panel's markup and CSS. */
export function mountVolumePanel(root,{scope='week',onGoalsChange=()=>{},onMuscleSelect=()=>{}}={}) {
  const markup=document.createElement('template');markup.innerHTML=SESSION_MARKUP;
  root.replaceChildren(markup.content.querySelector('.panel'),markup.content.querySelector('dialog'));
  const panel=root.querySelector('.panel'),dialog=root.querySelector('dialog'),readout=root.querySelector('#readout'),list=root.querySelector('#volume'),fields=root.querySelector('#goal-fields');
  root.querySelector('#volume-title').textContent=scope==='week'?'Weekly volume':'Volume';
  root.querySelector('.unit').textContent=scope==='week'?'sets per muscle per week':'sets per muscle';
  root.querySelector('#goals-title').textContent='Weekly volume goals';
  root.querySelector('#body-map').remove();root.querySelector('#heat-key').remove();
  root.querySelector('.dialog-hint').textContent='Target sets per muscle per week. Slide to the far left for no goal.';
  root.querySelector('#open-goals').textContent='Set weekly goals';
  root.querySelector('#volume-empty').textContent='No weekly volume yet. Add a workout or set a weekly goal.';
  let data,selected=null,hovered=null,hoverTimer,fadeTimer,subject,shownSubject,disposed=false;
  for(const m of MUSCLE_GROUPS) {
    const li=document.createElement('li');li.innerHTML='<button type="button" class="volume-row" aria-pressed="false"><span class="name"></span><span class="bar"><span class="bar-direct"></span><span class="bar-indirect"></span><span class="bar-goal" aria-hidden="true"></span></span><span class="value"></span><span class="status" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="status-text visually-hidden"></span><span class="split visually-hidden"></span></button>';
    li.querySelector('button').dataset.muscle=m;li.querySelector('.name').textContent=m;list.append(li);
    const label=document.createElement('label');label.className='goal-row weekly-goal';
    label.innerHTML='<span class="goal-name"></span><div class="slider"><span class="slider-fill"></span><input type="range" min="0" max="30" step="0.5"></div><span class="slider-value"></span>';
    label.querySelector('.goal-name').textContent=m;const input=label.querySelector('input');input.dataset.goal=m;input.setAttribute('aria-label',`${m} weekly goal`);fields.append(label);
  }
  function readoutText(m) {
    if(!m)return 'Tap a muscle to see its weekly volume.';
    const {volume,split,goals,contributorCount}=data,n=contributorCount(m),g=goals[m],status=goalStatus(volume[m],g)?.status;
    return `${m} ${volume[m]}${g===undefined?'':` / ${g}`} sets (${split[m].direct} direct · ${split[m].indirect} indirect)${status?` · ${status}`:''} · ${n} workout${n===1?'':'s'}`;
  }
  function updateReadout() {
    const next=hovered??selected;
    if(next===subject&&fadeTimer){clearTimeout(fadeTimer);fadeTimer=null;readout.classList.remove('is-fading');readout.textContent=readoutText(next);shownSubject=next;return;}
    if(next===shownSubject||subject===undefined||matchMedia('(prefers-reduced-motion: reduce)').matches){clearTimeout(fadeTimer);fadeTimer=null;readout.classList.remove('is-fading');readout.textContent=readoutText(next);shownSubject=next;}
    else {clearTimeout(fadeTimer);readout.classList.add('is-fading');fadeTimer=setTimeout(()=>{if(disposed)return;readout.textContent=readoutText(hovered??selected);shownSubject=hovered??selected;fadeTimer=null;readout.classList.remove('is-fading');},75);}
    subject=next;
  }
  function update(value) {
    data=value;const {volume,split,goals}=value,visible=visibleMuscles(volume,goals),scale=barScale(volume,goals);
    root.querySelector('#volume-empty').hidden=visible.length>0;root.querySelector('#split-key').hidden=visible.length===0;
    list.classList.toggle('has-goals',Object.keys(goals).length>0);
    list.querySelectorAll('button').forEach(row=>{
      const m=row.dataset.muscle,g=goals[m],status=goalStatus(volume[m],g)?.status,fill=barSegments(split[m].direct,split[m].indirect,scale);
      row.parentElement.hidden=!visible.includes(m);row.classList.toggle('is-zero',volume[m]===0);row.classList.toggle('is-focus',m===(hovered??selected));row.classList.toggle('is-selected',m===selected);row.setAttribute('aria-pressed',String(m===selected));
      if(status)row.dataset.status=status;else delete row.dataset.status;
      row.querySelector('.value').textContent=`${volume[m]}${g===undefined?'':` / ${g}`}`;row.querySelector('.status-text').textContent=status||'';row.querySelector('.split').textContent=`${split[m].direct} direct · ${split[m].indirect} indirect`;
      row.querySelector('.bar-direct').style.width=`${fill.direct*100}%`;row.querySelector('.bar-indirect').style.width=`${fill.indirect*100}%`;
      const bar=row.querySelector('.bar');bar.classList.toggle('no-direct',fill.direct===0);bar.classList.toggle('no-indirect',fill.indirect===0);
      const marker=row.querySelector('.bar-goal');marker.hidden=g===undefined;if(g!==undefined)marker.style.left=`${g/scale*100}%`;
    });
    fields.querySelectorAll('input').forEach(input=>{const g=goals[input.dataset.goal]||0;input.value=g;input.setAttribute('aria-valuetext',g?String(g):'No goal');input.closest('label').querySelector('.slider-value').textContent=g?String(g):'No goal';input.parentElement.style.setProperty('--from',0);input.parentElement.style.setProperty('--to',g/30);});
    updateReadout();
  }
  root.querySelector('#open-goals').addEventListener('click',()=>dialog.showModal());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  fields.addEventListener('input',e=>{const m=e.target.dataset.goal;if(!m)return;const goals={...data.goals},v=e.target.valueAsNumber;if(v)goals[m]=v;else delete goals[m];update({...data,goals});onGoalsChange(goals);});
  list.addEventListener('click',e=>{const row=e.target.closest('button');if(!row)return;selected=selected===row.dataset.muscle?null:row.dataset.muscle;update(data);onMuscleSelect(selected);});
  list.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const m=e.target.closest('button')?.dataset.muscle;if(!m)return;clearTimeout(hoverTimer);hovered=m;update(data);});
  panel.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{hovered=null;update(data);},150);});
  return {update,destroy(){disposed=true;clearTimeout(hoverTimer);clearTimeout(fadeTimer);dialog.close();root.replaceChildren();}};
}
