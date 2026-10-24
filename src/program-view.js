import {copyWorkout,createTemplate,assignDay,moveWorkout} from './program.js';
import {computeProgramVolume,computeProgramVolumeSplit,contributingWorkouts} from './program-volume.js';
import {mountVolumePanel} from './volume-panel.js';
import {mountSessionEditor} from './session-editor.js';
import {validateDocument} from './document-validation.js';
import {parseDocument} from './document-file.js';
import {validateExercise} from './validate.js';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const id=()=>crypto.randomUUID();
export function mountProgramView(root,{program,templates,onLoadTemplate,onChange=()=>{},onExport}={}) {
  let value=structuredClone(program),panel,editor,disposed=false,viewGeneration=0;
  function cleanup(){viewGeneration++;panel?.destroy();editor?.destroy();panel=editor=null;}
  function emit(){onChange(structuredClone(value));updateVolume();}
  function updateVolume(){panel?.update({volume:computeProgramVolume(value),split:computeProgramVolumeSplit(value),goals:value.goals,contributorCount:m=>contributingWorkouts(value,m)});}
  function showError(error){const el=root.querySelector('[data-program-error]');if(el)el.textContent=error.message||error;}
  function run(fn){return async()=>{try{await fn();}catch(error){if(!disposed)showError(error);}};}
  function focusError(){
    if(!value.name.trim()){root.querySelector('[data-program-name]')?.focus();return;}
    for(const workout of value.workouts)if(!workout.name.trim()||workout.exercises.some(e=>Object.keys(validateExercise(e)).length)){
      openWorkout(workout.id);editor.focusFirstError();showError(`Fix workout ${value.workouts.indexOf(workout)+1} before exporting.`);return;
    }
  }
  function openWorkout(workoutId){
    const workout=value.workouts.find(w=>w.id===workoutId);if(!workout)return;
    cleanup();root.innerHTML='<div class="program-context"><button type="button" class="secondary-btn" data-back>Back to program</button><p class="error" role="alert" data-program-error></p></div><div data-editor></div>';
    root.querySelector('[data-back]').onclick=()=>{renderOverview();root.querySelector(`[data-edit="${workoutId}"]`)?.focus();};
    editor=mountSessionEditor(root.querySelector('[data-editor]'),{workout,onChange:updated=>{value={...value,workouts:value.workouts.map(w=>w.id===workoutId?{...updated,id:w.id,day:w.day}:w)};emit();}});
  }
  function renderWorkouts(focusId,focusAction){
    const container=root.querySelector('[data-workouts]');container.replaceChildren();
    const groups=value.mode==='schedule'?[...DAYS.map((name,day)=>({name,day})),{name:'Unscheduled',day:null}]:[{name:'Session templates',day:undefined}];
    for(const group of groups){
      const section=document.createElement('section');section.className='day-section';
      const heading=document.createElement('h2');heading.textContent=group.name;section.append(heading);container.append(section);
      const workouts=value.workouts.filter(w=>group.day===undefined||w.day===group.day);
      if(!workouts.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=group.day===undefined?'No workouts yet. Add a session template or an empty workout.':group.day===null?'No unscheduled workouts.':'Rest day';section.append(empty);}
      for(const workout of workouts){
        const card=document.createElement('article');card.className='workout-item';card.dataset.workout=workout.id;
        const title=document.createElement('h3');title.textContent=workout.name.trim()||'Untitled workout';card.append(title);
        const count=document.createElement('p');count.textContent=`${workout.exercises.length} exercise${workout.exercises.length===1?'':'s'}`;card.append(count);
        const actions=document.createElement('div');actions.className='item-actions';card.append(actions);
        const name=workout.name.trim()||'Untitled workout';
        for(const [label,callback,disabled]of [
          ['Edit',()=>openWorkout(workout.id),false],
          ['Move up',()=>move(-1),workouts.indexOf(workout)===0],
          ['Move down',()=>move(1),workouts.indexOf(workout)===workouts.length-1],
          ['Duplicate',()=>{const copy={...copyWorkout(workout,id()),day:workout.day};const index=value.workouts.findIndex(w=>w.id===workout.id);value.workouts.splice(index+1,0,copy);emit();renderWorkouts(copy.id,'Edit');},false],
          ['Remove',()=>{if(!confirm(`Remove ${name} from this program?`))return;value.workouts=value.workouts.filter(w=>w.id!==workout.id);emit();renderWorkouts();root.querySelector('[data-add-empty]').focus();},false]
        ]){
          const button=document.createElement('button');button.className='secondary-btn';button.type='button';button.textContent=label;button.setAttribute('aria-label',`${label} ${name}`);button.disabled=disabled;button.dataset.action=label;if(label==='Edit')button.dataset.edit=workout.id;button.onclick=callback;actions.append(button);
        }
        function move(step){const other=workouts[workouts.indexOf(workout)+step];if(!other)return;value=moveWorkout(value,workout.id,value.workouts.findIndex(w=>w.id===other.id));emit();renderWorkouts(workout.id,step<0?'Move up':'Move down');}
        if(value.mode==='schedule'){
          const label=document.createElement('label');label.className='day-field';label.textContent='Day ';
          const select=document.createElement('select');select.setAttribute('aria-label',`Day for ${name}`);
          for(const [day,text]of [['','Unscheduled'],...DAYS.map((d,i)=>[String(i),d])]){const option=document.createElement('option');option.value=day;option.textContent=text;select.append(option);}
          select.value=workout.day===null?'':String(workout.day);select.onchange=()=>{value=assignDay(value,workout.id,select.value===''?null:Number(select.value));emit();renderWorkouts();root.querySelector(`[data-workout="${workout.id}"] select`)?.focus();};label.append(select);card.append(label);
        }
        section.append(card);
      }
    }
    if(focusId){const controls=[...container.querySelectorAll(`[data-workout="${focusId}"] button`)];const target=controls.find(b=>b.dataset.action===focusAction&&!b.disabled)||controls.find(b=>!b.disabled);target?.focus();}
  }
  function renderOverview(){
    cleanup();root.innerHTML=`<section class="program-page"><p class="eyebrow">Weekly microcycle</p><h1>Program</h1>
      <label class="field">Program name<input type="text" data-program-name></label>
      <div class="program-toolbar">
        <fieldset class="program-layout"><legend class="visually-hidden">Program layout</legend>
          <label><input type="radio" name="program-layout" value="simple"><span>Sequence</span></label>
          <label><input type="radio" name="program-layout" value="schedule"><span>Monday–Sunday</span></label>
        </fieldset>
        <div class="program-file-actions">
          <button type="button" class="secondary-btn" data-import><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7 10l5 5 5-5M4 15v4h16v-4"/></svg>Import program</button>
          <button type="button" class="secondary-btn" data-export><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V3M7 8l5-5 5 5M4 15v4h16v-4"/></svg>Export program</button>
          <input type="file" accept=".json,application/json" hidden data-file>
        </div>
      </div>
      <p class="error" role="alert" data-program-error></p>
      <div class="program-grid"><div><div class="template-picker"><label class="field">Session template to copy<select data-template><option value="">Choose a template</option></select></label><button type="button" class="secondary-btn" data-add-template>Add from template</button><button type="button" class="add-btn" data-add-empty>Add empty workout</button></div><div data-workouts></div></div><div data-weekly-panel></div></div></section>`;
    const name=root.querySelector('[data-program-name]');name.value=value.name;name.oninput=()=>{value.name=name.value;emit();};
    root.querySelectorAll('[name="program-layout"]').forEach(input=>{input.checked=input.value===value.mode;input.onchange=()=>{if(!input.checked)return;value.mode=input.value;emit();renderWorkouts();};});
    const picker=root.querySelector('[data-template]');
    for(const template of templates){const option=document.createElement('option');option.value=template.id;option.textContent=template.name.trim()||'Untitled template';picker.append(option);}
    root.querySelector('[data-add-template]').onclick=run(async()=>{if(!picker.value){picker.focus();return;}const generation=viewGeneration,selected=picker.value,template=await onLoadTemplate(selected);if(disposed||generation!==viewGeneration)return;const copy=copyWorkout(template.document,id());value.workouts.push(copy);emit();renderWorkouts(copy.id,'Edit');});
    root.querySelector('[data-add-empty]').onclick=()=>{const copy=copyWorkout({...createTemplate(),name:'Untitled workout'},id());value.workouts.push(copy);emit();renderWorkouts(copy.id,'Edit');};
    root.querySelector('[data-export]').onclick=()=>{const result=validateDocument('program',value);if(result.error){showError(result.error);focusError();return;}onExport(value);};
    const file=root.querySelector('[data-file]');root.querySelector('[data-import]').onclick=()=>file.click();
    file.onchange=run(async()=>{const chosen=file.files[0],generation=viewGeneration;file.value='';if(!chosen)return;if(chosen.size>1048576)throw Error('File must be at most 1 MiB.');const text=await chosen.text();if(disposed||generation!==viewGeneration)return;const parsed=parseDocument(text);if(parsed.error)throw Error(parsed.error);if(parsed.kind!=='program')throw Error('Import session template files from Session templates.');if((value.workouts.length||Object.keys(value.goals).length)&&!confirm('Replace this program and all of its workouts?'))return;value=parsed.document;emit();renderOverview();});
    panel=mountVolumePanel(root.querySelector('[data-weekly-panel]'),{scope:'week',onGoalsChange:goals=>{value.goals=goals;emit();}});updateVolume();renderWorkouts();
  }
  renderOverview();return {update(next){value=structuredClone(next);renderOverview();},focusFirstError:focusError,focusError,destroy(){disposed=true;cleanup();root.replaceChildren();}};
}
