import {MUSCLE_GROUPS} from './muscles.js';
import {barScale,barSegments,goalStatus,visibleMuscles} from './volume.js';
import {SESSION_MARKUP} from './session-markup.js';
import {bodySvg} from './body.js';
import {weeklyHeatLevel} from './program-volume.js';
import {mountPanelLayout} from './panel-layout.js';

/** Weekly overview: goal-status bars reuse the workout panel's markup and CSS. */
export function mountVolumePanel(root,{scope='week',onGoalsChange=()=>{},onMuscleSelect=()=>{},onMuscleFocusChange=()=>{}}={}) {
  const markup=document.createElement('template');markup.innerHTML=SESSION_MARKUP;
  root.replaceChildren(markup.content.querySelector('.panel'),markup.content.querySelector('dialog'));
  const panel=root.querySelector('.panel'),dialog=root.querySelector('dialog'),readout=root.querySelector('#readout'),list=root.querySelector('#volume'),fields=root.querySelector('#goal-fields');
  root.querySelector('#volume-title').textContent=scope==='week'?'Weekly volume':'Volume';
  root.querySelector('.unit').textContent=scope==='week'?'sets per muscle per week':'sets per muscle';
  const heading=document.createElement('div');heading.className='weekly-panel-heading';
  panel.querySelector('.panel-head').prepend(heading);
  heading.append(root.querySelector('#volume-title'),root.querySelector('.unit'));
  root.querySelector('#goals-title').textContent='Weekly volume goals';
  root.querySelector('#body-map').innerHTML=['front','back'].map(view=>`<figure>${bodySvg(view)}<figcaption>${view}</figcaption></figure>`).join('');
  root.querySelectorAll('#heat-key li').forEach((item,i)=>{item.textContent=['0','0.5–6','6.5–12','12.5–18','18.5+'][i];});
  root.querySelector('.dialog-hint').textContent='Target sets per muscle per week. Slide to the far left for no goal.';
  root.querySelector('#open-goals').textContent='Set weekly goals';
  root.querySelector('#volume-empty').textContent='No weekly volume yet. Add a workout or set a weekly goal.';
  let data,selected=null,hovered=null,focused=null,hoverTimer=null,fadeTimer=null,subject,shownSubject,notifiedMuscle=null,disposed=false;
  const effectiveMuscle=()=>hovered??focused??selected;
  for(const m of MUSCLE_GROUPS) {
    const li=document.createElement('li');li.innerHTML='<button type="button" class="volume-row" aria-pressed="false"><span class="name"></span><span class="bar"><span class="bar-direct"></span><span class="bar-indirect"></span><span class="bar-goal" aria-hidden="true"></span></span><span class="value"></span><span class="status" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="status-text visually-hidden"></span><span class="split visually-hidden"></span></button>';
    li.querySelector('button').dataset.muscle=m;li.querySelector('.name').textContent=m;list.append(li);
    const label=document.createElement('label');label.className='goal-row weekly-goal';
    label.innerHTML='<span class="goal-name"></span><div class="slider"><span class="slider-fill"></span><input type="range" min="0" max="30" step="0.5"></div><span class="slider-value"></span>';
    label.querySelector('.goal-name').textContent=m;const input=label.querySelector('input');input.dataset.goal=m;input.setAttribute('aria-label',`${m} weekly goal`);fields.append(label);
  }
  function readoutText(m) {
    if(!m)return 'Tap a muscle to highlight its workouts.';
    const {volume,split,goals,contributorCount}=data,n=contributorCount(m),g=goals[m],status=goalStatus(volume[m],g)?.status;
    return `${m} ${volume[m]}${g===undefined?'':` / ${g}`} sets (${split[m].direct} direct · ${split[m].indirect} indirect)${status?` · ${status}`:''} · ${n} workout${n===1?'':'s'}`;
  }
  function updateReadout() {
    const next=effectiveMuscle();
    if(next===subject&&fadeTimer){clearTimeout(fadeTimer);fadeTimer=null;readout.classList.remove('is-fading');readout.textContent=readoutText(next);shownSubject=next;return;}
    if(next===shownSubject||subject===undefined||matchMedia('(prefers-reduced-motion: reduce)').matches){clearTimeout(fadeTimer);fadeTimer=null;readout.classList.remove('is-fading');readout.textContent=readoutText(next);shownSubject=next;}
    else {clearTimeout(fadeTimer);readout.classList.add('is-fading');fadeTimer=setTimeout(()=>{if(disposed)return;readout.textContent=readoutText(effectiveMuscle());shownSubject=effectiveMuscle();fadeTimer=null;readout.classList.remove('is-fading');},75);}
    subject=next;
  }
  function update(value) {
    if(disposed)return;
    data=value;const {volume,split,goals}=value,visible=visibleMuscles(volume,goals),scale=barScale(volume,goals);
    const focus=effectiveMuscle();
    panel.classList.toggle('has-selection',selected!==null);
    panel.querySelectorAll('.region').forEach(region=>{
      const m=region.dataset.muscle;
      region.dataset.heat=weeklyHeatLevel(volume[m]);
      region.classList.toggle('is-focus',m===focus);
      region.classList.toggle('is-selected',m===selected);
    });
    root.querySelector('#volume-empty').hidden=visible.length>0;root.querySelector('#split-key').hidden=visible.length===0;
    list.classList.toggle('has-goals',Object.keys(goals).length>0);
    list.querySelectorAll('button').forEach(row=>{
      const m=row.dataset.muscle,g=goals[m],status=goalStatus(volume[m],g)?.status,fill=barSegments(split[m].direct,split[m].indirect,scale);
      row.parentElement.hidden=!visible.includes(m);row.classList.toggle('is-zero',volume[m]===0);row.classList.toggle('is-focus',m===focus);row.classList.toggle('is-selected',m===selected);row.setAttribute('aria-pressed',String(m===selected));
      if(status)row.dataset.status=status;else delete row.dataset.status;
      row.querySelector('.value').textContent=`${volume[m]}${g===undefined?'':` / ${g}`}`;row.querySelector('.status-text').textContent=status||'';row.querySelector('.split').textContent=`${split[m].direct} direct · ${split[m].indirect} indirect`;
      row.querySelector('.bar-direct').style.width=`${fill.direct*100}%`;row.querySelector('.bar-indirect').style.width=`${fill.indirect*100}%`;
      const bar=row.querySelector('.bar');bar.classList.toggle('no-direct',fill.direct===0);bar.classList.toggle('no-indirect',fill.indirect===0);
      const marker=row.querySelector('.bar-goal');marker.hidden=g===undefined;if(g!==undefined)marker.style.left=`${g/scale*100}%`;
    });
    fields.querySelectorAll('input').forEach(input=>{const g=goals[input.dataset.goal]||0;input.value=g;input.setAttribute('aria-valuetext',g?String(g):'No goal');input.closest('label').querySelector('.slider-value').textContent=g?String(g):'No goal';input.parentElement.style.setProperty('--from',0);input.parentElement.style.setProperty('--to',g/30);});
    updateReadout();
    if(focus!==notifiedMuscle){notifiedMuscle=focus;onMuscleFocusChange(focus);}
  }
  root.querySelector('#open-goals').addEventListener('click',()=>dialog.showModal());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  fields.addEventListener('input',e=>{const m=e.target.dataset.goal;if(!m)return;const goals={...data.goals},v=e.target.valueAsNumber;if(v)goals[m]=v;else delete goals[m];update({...data,goals});onGoalsChange(goals);});
  const muscleAt=target=>target?.closest?.('.region, .volume-row')?.dataset.muscle??null;
  function setHover(muscle) {
    if(muscle===null){
      if(hovered!==null&&hoverTimer===null)hoverTimer=setTimeout(()=>{hoverTimer=null;hovered=null;update(data);},150);
      return;
    }
    clearTimeout(hoverTimer);hoverTimer=null;focused=null;
    hovered=muscle;update(data);
  }
  panel.addEventListener('click',e=>{
    const muscle=muscleAt(e.target);if(!muscle)return;
    selected=selected===muscle?null:muscle;update(data);onMuscleSelect(selected);
  });
  panel.addEventListener('pointerover',e=>{if(e.pointerType==='mouse')setHover(muscleAt(e.target));});
  panel.addEventListener('pointerout',e=>{if(e.pointerType==='mouse'&&!muscleAt(e.relatedTarget))setHover(null);});
  panel.addEventListener('pointerleave',()=>setHover(null));
  list.addEventListener('focusin',e=>{
    if(!e.target.matches('.volume-row:focus-visible'))return;
    clearTimeout(hoverTimer);hoverTimer=null;hovered=null;
    focused=muscleAt(e.target);update(data);
  });
  list.addEventListener('focusout',e=>{focused=muscleAt(e.relatedTarget);update(data);});
  const panelLayout=mountPanelLayout(panel);
  return {update,destroy(){disposed=true;panelLayout.destroy();clearTimeout(hoverTimer);clearTimeout(fadeTimer);dialog.close();root.replaceChildren();}};
}
