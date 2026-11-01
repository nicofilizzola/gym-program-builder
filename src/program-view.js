import {confirmAction} from './confirm-dialog.js';
import {hasProgramContext} from './program-context.js';
import {mountProgramContextDialog} from './program-context-dialog.js';
import {mountAnalysisPanel} from './analysis-panel.js';
import {prepareProgramAnalysisSnapshot} from './program-analysis-input.js';
import {streamProgramAnalysis} from './analysis-client.js';
import {createViewTransition} from './view-transition.js';
import {mountReorderMenu} from './reorder-menu.js';
import {mountSortable} from './sortable.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {copyWorkout,createTemplate,moveWorkout,placeWorkout} from './program.js';
import {getSequence,addRestDay,removeRestDay,placeSequenceEntry,reconcileSequence} from './program-sequence.js';
import {computeProgramVolume,computeProgramVolumeSplit,contributingWorkouts} from './program-volume.js';
import {mountVolumePanel} from './volume-panel.js';
import {mountSessionEditor} from './session-editor.js';
import {validateLegacyDocument as validateDocument} from './document-validation.js';
import {parseDocument} from './document-file.js';
import {validateExercise} from './validate.js';
import {MUSCLE_GROUPS} from './muscles.js';
import {durationLabel} from './duration.js';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const id=()=>crypto.randomUUID();
export function mountProgramView(root,{program,templates,onLoadTemplate,onChange=()=>{},onExport,api,onExportWorkout,onOpenWorkout,workoutHref,onCreateEmpty,onImportFile,analysisEnabled=false,analysisRequest,reviewDock}={}) {
  let confirmationController=new AbortController();
  const weekHelpId='program-reorder-hint';
  const viewTransition=createViewTransition(root);
  let overviewScroll=0,transitionGeneration=0,layoutTransition=null,layoutGeneration=0,editingWorkoutId=null;
  function cancelLayoutTransition(){
    layoutGeneration++;layoutTransition?.cancel();
    const container=root.querySelector('[data-workouts]');if(container)container.inert=false;
  }
  function changeView(commit,focus){
    const generation=++transitionGeneration;root.inert=true;
    return viewTransition.swap(commit,{focus:()=>{root.inert=false;focus?.();}}).finally(()=>{if(generation===transitionGeneration)root.inert=false;});
  }
  let value=structuredClone(program),panel,editor,tooltips,disposed=false,viewGeneration=0,selectedMuscle=null,sortable,analysisPanel,contextDialog;
  const reorderMenu=mountReorderMenu();
  function cleanup(){confirmationController.abort();confirmationController=new AbortController();reorderMenu.close();cancelLayoutTransition();layoutTransition?.destroy();layoutTransition=null;tooltips?.destroy();tooltips=null;sortable?.destroy();sortable=null;viewGeneration++;panel?.destroy();editor?.destroy();panel=editor=null;analysisPanel?.destroy();contextDialog?.destroy();analysisPanel=contextDialog=null;}
  function emit(){onChange(structuredClone(value));updateVolume();analysisPanel?.refresh();contextDialog?.refresh();}
  function updateVolume(){panel?.update({volume:computeProgramVolume(value),split:computeProgramVolumeSplit(value),goals:value.goals,contributorCount:m=>contributingWorkouts(value,m)});}
  function updateWorkoutHighlights(){
    const workouts=new Map(value.workouts.map(workout=>[workout.id,workout]));
    root.querySelectorAll('.workout-item').forEach(card=>{
      const workout=workouts.get(card.dataset.workout);
      const matches=selectedMuscle!==null&&workout?.exercises.some(ex=>ex.primaryMuscles.includes(selectedMuscle)||ex.secondaryMuscles.includes(selectedMuscle));
      card.classList.toggle('is-muscle-match',Boolean(matches));
      card.classList.toggle('is-muscle-muted',selectedMuscle!==null&&!matches);
      const marker=card.querySelector('[data-muscle-match]');
      marker.classList.toggle('is-visible',Boolean(matches));marker.setAttribute('aria-hidden',String(!matches));if(matches)marker.textContent=`Trains ${selectedMuscle}`;
    });
  }
  function showError(error){const el=root.querySelector('[data-program-error]');if(el)el.textContent=error.message||error;}
  function showAnalysisError(error){
    showError(error);const workout=value.workouts[error.occurrenceIndex],el=root.querySelector('[data-program-error]');
    if(!workout||!el||!workoutHref)return;
    const link=document.createElement('a');link.href=workoutHref(workout.id);link.textContent=`Open session ${error.occurrenceIndex+1}: ${workout.name?.trim()||'Untitled session'}`;
    link.onclick=event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();run(()=>openWorkout(workout.id))();};
    el.append(' ',link);link.focus({preventScroll:true});
  }
  function run(fn){return async()=>{try{await fn();}catch(error){if(!disposed)showError(error);}};}
  async function focusError(){
    if(!value.name.trim()){root.querySelector('[data-program-name]')?.focus();return;}
    for(const workout of value.workouts)if(!workout.name.trim()||workout.exercises.some(e=>Object.keys(validateExercise(e)).length)){
      if(onOpenWorkout){await onOpenWorkout(workout.id,{focusError:true});return;}
      await openWorkout(workout.id);if(disposed||!editor)return;editor.focusFirstError();showError(`Fix workout ${value.workouts.indexOf(workout)+1} before exporting.`);return;
    }
  }
  async function openWorkout(workoutId){
    if(onOpenWorkout){await onOpenWorkout(workoutId);return;}
    cancelLayoutTransition();
    overviewScroll=scrollY;
    const workout=value.workouts.find(w=>w.id===workoutId);if(!workout)return;editingWorkoutId=workoutId;
    await changeView(()=>{cleanup();root.innerHTML='<div class="program-context"><button type="button" class="secondary-btn" data-back>Back to program</button><p class="error" role="alert" data-program-error></p></div><div data-editor></div>';
    root.querySelector('[data-back]').onclick=run(()=>renderOverview(workoutId));
    editor=mountSessionEditor(root.querySelector('[data-editor]'),{api,workout,onExport:onExportWorkout?document=>onExportWorkout(document,workoutId):undefined,onChange:updated=>{value={...value,workouts:value.workouts.map(w=>w.id===workoutId?{...updated,id:w.id,day:w.day}:w)};emit();}});
    },()=>{window.scrollTo(0,0);root.querySelector('[data-template-name]')?.focus({preventScroll:true});});
  }
  function renderWorkouts(focusId,focusAction,transitionCommit=false){
    if(!transitionCommit)cancelLayoutTransition();
    tooltips?.hide();reorderMenu.close();
    sortable?.destroy();sortable=null;
    const container=root.querySelector('[data-workouts]');container.replaceChildren();
    container.classList.toggle('week-agenda',value.mode==='schedule');
    root.querySelector('[data-add-rest]').hidden=value.mode!=='simple';

    const groups=value.mode==='schedule'?[...DAYS.map((name,day)=>({name,day})),{name:'Unscheduled',day:null}]:[{name:'Sessions',day:undefined}];
    for(const group of groups){
      const section=document.createElement('section');section.className='day-section';
      section.classList.toggle('day-section--unscheduled',group.day===null);
      const heading=document.createElement('h2');heading.textContent=group.name;section.append(heading);container.append(section);
      const groupList=document.createElement('div');groupList.className='workout-list';groupList.dataset.sortGroup=group.day===undefined?'sequence':group.day===null?'unscheduled':String(group.day);section.append(groupList);
      const workouts=value.workouts.filter(w=>group.day===undefined||w.day===group.day);
      if(!workouts.length&&!(group.day===undefined&&getSequence(value).length)){const empty=document.createElement('p');empty.className='empty';empty.textContent=group.day===undefined?'No sessions yet. Add a session template, empty workout or rest day.':group.day===null?'No unscheduled workouts.':'Rest day';groupList.append(empty);}
      for(const workout of workouts){
        const card=document.createElement('article');card.className='workout-item';card.dataset.workout=workout.id;card.dataset.sequenceKey=workout.id;
        const handle=document.createElement('button');handle.type='button';handle.className='action-button reorder-action';handle.setAttribute('aria-expanded','false');handle.setAttribute('aria-describedby','program-reorder-hint');handle.setAttribute('aria-label',`Reorder ${workout.name.trim()||'Untitled workout'}`);
        handle.innerHTML=actionIcon('reorder');handle.dataset.actionTooltip='Reorder';
        handle.onkeydown=event=>reorderKey(event,workout.id);
        const title=document.createElement('h3'),open=document.createElement(workoutHref?'a':'button');
        open.className='workout-title';open.textContent=workout.name.trim()||'Untitled workout';open.dataset.workoutTitle=workout.id;open.dataset.action='Open';
        if(workoutHref)open.href=workoutHref(workout.id);else open.type='button';
        open.onclick=event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();run(()=>openWorkout(workout.id))();};title.append(open);card.append(title);
        const marker=document.createElement('span');marker.dataset.muscleMatch='';marker.className='workout-muscle-match hit-tag';marker.setAttribute('aria-hidden','true');
        // Overlay all possible labels invisibly so switching badges never moves controls,
        // even when the current font or enlarged text makes a different label widest.
        const badgeSlot=document.createElement('span');badgeSlot.className='workout-muscle-slot';
        const badgeSpace=document.createElement('span');badgeSpace.className='workout-badge-space hit-tag';badgeSpace.setAttribute('aria-hidden','true');
        for(const muscle of MUSCLE_GROUPS){const label=document.createElement('span');label.textContent=`Trains ${muscle}`;badgeSpace.append(label);}
        badgeSlot.append(badgeSpace,marker);
        const count=document.createElement('p');count.textContent=`${workout.exercises.length} exercise${workout.exercises.length===1?'':'s'}`;
        const duration=document.createElement('p');duration.dataset.workoutDuration='';duration.textContent='Estimated duration '+durationLabel(workout);
        const metadata=document.createElement('div');metadata.className='workout-metadata';metadata.append(count,duration,badgeSlot);card.append(metadata);
        const actions=document.createElement('div');actions.className='item-actions';card.append(actions);actions.append(handle);
        wireReorder(handle,workout.id);handle.dataset.action='Reorder';
        const name=workout.name.trim()||'Untitled workout';
        for(const [label,callback,disabled]of [
          ['Duplicate',()=>{const copy={...structuredClone(workout),id:id(),day:workout.day};const index=value.workouts.findIndex(w=>w.id===workout.id);value.workouts.splice(index+1,0,copy);value=reconcileSequence(value);emit();renderWorkouts(copy.id,'Open');},false],
          ['Remove',run(async()=>{const before=JSON.stringify(value);if(!await confirmAction({title:'Remove session?',message:`Remove ${name} from this program? The shared template remains in Session templates.`,confirmLabel:'Remove session',destructive:true,signal:confirmationController.signal,returnFocus:()=>root.querySelector(`[data-workout="${CSS.escape(workout.id)}"] [data-action=Remove]`)||root.querySelector('[data-add-empty]')}))return;if(disposed||before!==JSON.stringify(value))return;value=reconcileSequence({...value,workouts:value.workouts.filter(w=>w.id!==workout.id)});emit();renderWorkouts();root.querySelector('[data-add-empty]').focus();}),false]
        ]){
          const button=document.createElement('button');button.className='action-button workout-action';button.type='button';button.textContent=label;button.setAttribute('aria-label',`${label} ${name}`);button.disabled=disabled;button.dataset.action=label;if(label==='Open')button.dataset.edit=workout.id;button.onclick=callback;actions.append(button);
          {
            if(label==='Remove')button.classList.add('action-button--delete');
            const icon={Edit:'edit',Duplicate:'duplicate',Remove:'delete'}[label];
            button.innerHTML=actionIcon(icon);button.dataset.actionTooltip=label;
          }
        }
        groupList.append(card);
      }
      if(value.mode==='simple') {
        const cards=new Map([...groupList.querySelectorAll('[data-workout]')].map(card=>[card.dataset.workout,card]));
        for(const entry of getSequence(value)) {
          if(entry.type==='workout'){groupList.append(cards.get(entry.workoutId));continue;}
          const card=document.createElement('article');card.className='sequence-rest-item';card.dataset.rest=entry.id;card.dataset.sequenceKey=entry.id;
          const handle=document.createElement('button');handle.type='button';handle.className='action-button reorder-action';handle.setAttribute('aria-label','Reorder rest day');
          handle.innerHTML=actionIcon('reorder');handle.dataset.actionTooltip='Reorder rest day';handle.setAttribute('aria-expanded','false');handle.setAttribute('aria-describedby',weekHelpId);
          handle.onkeydown=event=>reorderKey(event,entry.id);wireReorder(handle,entry.id);
          const title=document.createElement('h3');title.textContent='Rest day';
          const remove=document.createElement('button');remove.type='button';remove.className='action-button workout-action action-button--delete';remove.setAttribute('aria-label','Remove rest day');remove.dataset.actionTooltip='Remove rest day';remove.innerHTML=actionIcon('delete');
          remove.onclick=()=>{
            const entries=getSequence(value),index=entries.findIndex(e=>e.id===entry.id);
            value=removeRestDay(value,entry.id);emit();renderWorkouts();
            const remaining=getSequence(value),next=remaining[index]??remaining[index-1];
            if(next)focusHandle(next.workoutId??next.id);else root.querySelector('[data-add-rest]').focus();
          };
          card.append(handle,title,remove);groupList.append(card);
        }
      }
    }
    sortable=mountSortable(container,{itemSelector:'[data-sequence-key]',reorderSelector:'.reorder-action',getGroups:()=>[...container.querySelectorAll('[data-sort-group]')].map(element=>({element,key:element.dataset.sortGroup})),getKey:card=>card.dataset.sequenceKey,onCommit:({key,groupKey,beforeKey})=>{
      const group=value.workouts.filter(w=>w.id!==key&&(groupKey==='sequence'||w.day===(groupKey==='unscheduled'?null:Number(groupKey))));
      const next=groupKey==='sequence'?placeSequenceEntry(value,key,{beforeKey}):placeWorkout(value,key,{day:groupKey==='unscheduled'?null:Number(groupKey),beforeId:beforeKey,afterId:beforeKey===null?group.at(-1)?.id??null:null});
      if(JSON.stringify(next)!==JSON.stringify(value)){value=next;emit();}
      renderWorkouts();focusHandle(key);
      announceMove(key,groupKey);
    }});
    updateWorkoutHighlights();
    if(focusId){const controls=[...container.querySelectorAll(`[data-workout="${focusId}"] :is(button,a)`)];const target=controls.find(b=>b.dataset.action===focusAction&&!b.disabled)||controls.find(b=>!b.disabled);target?.focus();}
  }
  function wireReorder(button,key){
    button.onclick=()=>{
      const workout=value.workouts.find(w=>w.id===key);
      const entries=value.mode==='simple'?getSequence(value).map(e=>e.workoutId??e.id):value.workouts.filter(w=>w.day===workout.day).map(w=>w.id);
      const index=entries.indexOf(key);
      reorderMenu.toggle(button,[
        ...[['Move up',-1],['Move down',1]].map(([label,step])=>({label,disabled:!entries[index+step],run:()=>reorderKey({key:step<0?'ArrowUp':'ArrowDown',preventDefault(){}},key)})),
        ...(value.mode==='schedule'?[...DAYS.map((label,day)=>({label,day})),{label:'Unscheduled',day:null}].map(({label,day})=>({label:`Move to ${label}`,disabled:workout.day===day,run:()=>{
          const destination=value.workouts.filter(w=>w.id!==key&&w.day===day);
          value=placeWorkout(value,key,{day,afterId:destination.at(-1)?.id??null});emit();renderWorkouts();focusHandle(key);announceMove(key,day===null?'unscheduled':String(day));
        }})):[])
      ]);
    };
  }
  function focusHandle(key){[...root.querySelectorAll('[data-sequence-key]')].find(card=>card.dataset.sequenceKey===key)?.querySelector('.reorder-action')?.focus();}
  function announceMove(key,groupKey) {
    const position=getSequence(value).findIndex(e=>(e.workoutId??e.id)===key)+1;
    root.querySelector('[data-workout-order]').textContent=`Moved to ${groupKey==='sequence'?'position '+position:groupKey==='unscheduled'?'Unscheduled':DAYS[Number(groupKey)]}.`;
  }
  function reorderKey(event,key) {
    const step={ArrowUp:-1,ArrowDown:1}[event.key];if(!step||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(value.mode==='simple'&&event.altKey)return;
    event.preventDefault();
    let groupKey='sequence';
    if(value.mode==='simple') {
      const entries=getSequence(value),index=entries.findIndex(e=>(e.workoutId??e.id)===key),target=index+step;
      if(target<0||target>=entries.length)return;
      const before=entries[step<0?target:target+1];
      value=placeSequenceEntry(value,key,{beforeKey:before?(before.workoutId??before.id):null});
    } else {
      const workout=value.workouts.find(w=>w.id===key);
      if(event.altKey) {
        const day=(workout.day??7)+step;if(day<0||day>7)return;
        const assigned=day===7?null:day,others=value.workouts.filter(w=>w.id!==key&&w.day===assigned);
        value=placeWorkout(value,key,{day:assigned,afterId:others.at(-1)?.id??null});
        groupKey=day===7?'unscheduled':String(day);
      } else {
        const group=value.workouts.filter(w=>w.day===workout.day),other=group[group.indexOf(workout)+step];if(!other)return;
        value=moveWorkout(value,key,value.workouts.findIndex(w=>w.id===other.id));
        groupKey=workout.day===null?'unscheduled':String(workout.day);
      }
    }
    emit();renderWorkouts();focusHandle(key);announceMove(key,groupKey);
  }
  async function switchLayout(mode){
    value.mode=mode;emit();cancelLayoutTransition();reorderMenu.close();tooltips?.hide();sortable?.destroy();sortable=null;
    const generation=layoutGeneration,container=root.querySelector('[data-workouts]');
    container.inert=true;
    try {await layoutTransition.swap(()=>renderWorkouts(undefined,undefined,true));}
    finally {if(generation===layoutGeneration)container.inert=false;}
  }
  function renderOverview(returnId){
    return changeView(buildOverview,()=>{
      if(returnId){window.scrollTo(0,overviewScroll);root.querySelector(`[data-workout-title="${returnId}"]`)?.focus({preventScroll:true});}
      else {const heading=root.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});}
    });
  }
  function buildOverview(){
    selectedMuscle=null;
    cleanup();root.innerHTML=`<section class="program-page"><header class="program-heading"><h1>Program</h1>
      <label class="field">Program name<input type="text" data-program-name></label>
      <div class="program-toolbar">
        <fieldset class="program-layout"><legend class="visually-hidden">Program layout</legend>
          <label><input type="radio" name="program-layout" value="schedule"><span>Week</span></label>
          <label><input type="radio" name="program-layout" value="simple"><span>Sequence</span></label>
        </fieldset>
        <div class="program-file-actions">
          <button type="button" class="secondary-btn" data-program-context>${actionIcon('context')}Program context</button>
          <button type="button" class="secondary-btn" data-import><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7 10l5 5 5-5M4 15v4h16v-4"/></svg>Import program</button>
          <button type="button" class="secondary-btn" data-export>${actionIcon('export')}Export program</button>
          <input type="file" accept=".json,application/json" hidden data-file>
          <button type="button" class="secondary-btn review-toggle" data-program-review><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m10 3 2.1 6.9L19 12l-6.9 2.1L10 21l-2.1-6.9L1 12l6.9-2.1L10 3Z"/><path d="m19 2 .9 3.1L23 6l-3.1.9L19 10l-.9-3.1L15 6l3.1-.9L19 2Z"/></svg><span>AI review</span></button>
        </div>
      </div>
      </header><p class="error" role="alert" data-program-error></p>
      <div class="program-grid"><div><div class="template-picker"><label class="field">Session template<select data-template aria-label="Session template"><option value="">Choose a template</option></select></label><button type="button" class="secondary-btn" data-add-template disabled>Add template</button><span class="add-alternative">or</span><button type="button" class="secondary-btn" data-add-empty>${actionIcon('plus')}Empty workout</button></div><div class="sequence-toolbar"><button type="button" class="secondary-btn" data-add-rest>${actionIcon('plus')}Add rest day</button></div><p class="reorder-hint" id="${weekHelpId}" data-week-help>Drag a card to reorder. On touch, press and hold. Use Reorder for movement options. In Week, Up/Down reorders and Alt+Up/Down changes day.</p><div data-workouts></div><p data-workout-order class="visually-hidden" aria-live="polite"></p></div><div data-weekly-panel></div></div></section>`;
    const dock=reviewDock??root.appendChild(Object.assign(document.createElement('aside'),{className:'review-dock'}));
    tooltips=mountActionTooltips(root.querySelector('.program-page'));
    layoutTransition=createViewTransition(root.querySelector('[data-workouts]'));
    const name=root.querySelector('[data-program-name]');name.value=value.name;name.oninput=()=>{value.name=name.value;emit();};
    analysisPanel=mountAnalysisPanel({anchor:root.querySelector('[data-program-review]'),scope:'program',dock,getSnapshot:()=>prepareProgramAnalysisSnapshot(value),request:analysisRequest??streamProgramAnalysis,enabled:analysisEnabled,onValidationError:showAnalysisError});
    contextDialog=mountProgramContextDialog({anchor:root.querySelector('[data-program-context]'),getContext:()=>value.context,onBeforeOpen:()=>analysisPanel.dismissModal(),onChange:context=>{
      if(hasProgramContext({context}))value.context=context;else delete value.context;
      emit();
    }});
    root.querySelectorAll('[name="program-layout"]').forEach(input=>{input.checked=input.value===value.mode;input.onchange=run(()=>{if(input.checked)return switchLayout(input.value);});});
    const picker=root.querySelector('[data-template]');
    const addTemplate=root.querySelector('[data-add-template]');
    picker.onchange=()=>{addTemplate.disabled=!picker.value;};
    if(!templates.length){picker.options[0].textContent='No templates yet';picker.disabled=true;}
    for(const template of templates){const option=document.createElement('option');option.value=template.id;option.textContent=template.name.trim()||'Untitled template';picker.append(option);}
    root.querySelector('[data-add-template]').onclick=run(async()=>{if(!picker.value){picker.focus();return;}const generation=viewGeneration,selected=picker.value,template=await onLoadTemplate(selected);if(disposed||generation!==viewGeneration)return;const copy={...structuredClone(template.document),id:id(),templateId:template.id,templateRevision:template.revision,day:null};value.workouts.push(copy);value=reconcileSequence(value);emit();renderWorkouts(copy.id,'Open');});
    root.querySelector('[data-add-empty]').onclick=run(async()=>{if(onCreateEmpty){await onCreateEmpty();return;}const copy=copyWorkout({...createTemplate(),name:'Untitled workout'},id());value.workouts.push(copy);value=reconcileSequence(value);emit();renderWorkouts(copy.id,'Open');});
    root.querySelector('[data-add-rest]').onclick=()=>{const key=id();value=addRestDay(value,key);emit();renderWorkouts();focusHandle(key);};
    root.querySelector('[data-export]').onclick=run(async()=>{const result=validateDocument('program',value);if(result.error){showError(result.error);await focusError();return;}onExport(value);});
    const file=root.querySelector('[data-file]');root.querySelector('[data-import]').onclick=()=>file.click();
    file.onchange=run(async()=>{const chosen=file.files[0],generation=viewGeneration;file.value='';if(!chosen)return;if(onImportFile){await onImportFile(chosen);return;}if(chosen.size>1048576)throw Error('File must be at most 1 MiB.');const text=await chosen.text();if(disposed||generation!==viewGeneration)return;const parsed=parseDocument(text);if(parsed.error)throw Error(parsed.error);if(parsed.kind!=='program')throw Error('Import session template files from Session templates.');const before=JSON.stringify(value);if((getSequence(value).length||Object.keys(value.goals).length||hasProgramContext(value))&&!await confirmAction({title:'Replace program?',message:'Replace this program and all of its workouts?',confirmLabel:'Replace program',destructive:true,signal:confirmationController.signal}))return;if(disposed||generation!==viewGeneration||before!==JSON.stringify(value))return;value=parsed.document;emit();await renderOverview();});
    panel=mountVolumePanel(root.querySelector('[data-weekly-panel]'),{scope:'week',onGoalsChange:goals=>{value.goals=goals;emit();},onMuscleSelect:muscle=>{selectedMuscle=muscle;updateWorkoutHighlights();}});updateVolume();renderWorkouts();
  }
  function patchOverview(){
    const name=root.querySelector('[data-program-name]');if(name&&name.value!==value.name)name.value=value.name;
    root.querySelectorAll('[name="program-layout"]').forEach(input=>input.checked=input.value===value.mode);
    renderWorkouts();updateVolume();analysisPanel?.refresh();contextDialog?.refresh();
  }
  buildOverview();return {
    setAnalysisEnabled(next){analysisEnabled=next;analysisPanel?.setEnabled(next);},
    syncSaved(next){value=structuredClone(next);if(editor){const workout=value.workouts.find(w=>w.id===editingWorkoutId);if(workout)editor.syncSaved(workout);}else patchOverview();},
    update(next){confirmationController.abort();confirmationController=new AbortController();viewGeneration++;viewTransition.cancel();transitionGeneration++;root.inert=false;value=structuredClone(next);if(editor){const workout=value.workouts.find(w=>w.id===editingWorkoutId);if(workout)editor.syncSaved(workout);}else patchOverview();},
    focusFirstError:focusError,focusError,destroy(){disposed=true;transitionGeneration++;viewTransition.destroy();root.inert=false;cleanup();reorderMenu.destroy();root.replaceChildren();}
  };
}
