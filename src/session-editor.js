import {confirmAction} from './confirm-dialog.js';
import {mountWorkoutCoverControls} from './workout-cover-controls.js';
import {normalizeWorkoutCover} from './workout-cover.js';
import {mountSliderPresentation} from './slider-presentation.js';
import {renderVariantMetadata,mountExerciseInfo} from './catalog-metadata.js';
import {mountReorderMenu} from './reorder-menu.js';
import { mountSortable } from './sortable.js';
import { actionIcon, mountActionTooltips } from './action-controls.js';
import { MUSCLE_GROUPS, MUSCLE_INFO } from './muscles.js';
import { barScale, barSegments, computeVolume, computeVolumeSplit, goalStatus, heatLevel, visibleMuscles } from './volume.js';
import { LIMITS, validateExercise } from './validate.js';
import { createExercise, exerciseSummary, setRepBound, toggleMuscle } from './exercise.js';
import { bodySvg } from './body.js';
import { tooltipPosition } from './tooltip.js';
import { parseDocument, serializeDocument, documentFileName } from './document-file.js';
import { SESSION_MARKUP } from './session-markup.js';
import { mountPanelLayout } from './panel-layout.js';
import { DURATION_LIMITS, defaultRestSeconds, formatDuration, normalizeWorkoutTiming } from './duration.js';
import { mountDurationControls } from './duration-controls.js';
import {mountExercisePicker} from './exercise-picker.js';
import {snapshotExercise} from './catalog.js';
import {getCatalogStore} from './catalog-store.js';
import {canPairWithNext,moveBlockOrder,pairRole,pairWithNext,removeExercise,supersetBlocks,swapPair,unpair} from './superset.js';
import {createSupersetFrame,syncSupersetFrame} from './superset-frame.js';


export function mountSessionEditor(root,{workout,onChange=()=>{},onExport,onImport,onImportFile,api,onStartWorkout,maxSessionMinutes=null,onSaveStatusSlotChange=()=>{}}={}) {
root.innerHTML=SESSION_MARKUP;
onSaveStatusSlotChange(root.querySelector('[data-save-slot]'));
const sliderPresentation=mountSliderPresentation(root);
const disclosureTooltips=mountActionTooltips(root,{selector:'.card-head [data-action-tooltip], .superset-head [data-action-tooltip]'});
root.querySelector('#export-session svg').outerHTML=actionIcon('export');
const startWorkout=root.querySelector('#start-workout');
if(onStartWorkout){startWorkout.hidden=false;startWorkout.insertAdjacentHTML('afterbegin',actionIcon('start'));startWorkout.addEventListener('click',()=>onStartWorkout(structuredClone(session)));}
let destroyed=false;
if(api)getCatalogStore(api).load(true).catch(()=>{});
/**
 * The only domain state. Volume, goal status and errors are derived from it in refresh().
 * `goals` has a key only for muscles with a valid goal.
 */
const confirmationController=new AbortController();
let session = {...normalizeWorkoutTiming(structuredClone(workout)),coverId:normalizeWorkoutCover(workout.coverId)};
let lastDocument = JSON.stringify(session);
const exerciseCards=new Map(),exercisePickers=new Map(),exerciseInfos=new Map();
const nameInput=root.querySelector("[data-template-name]");
nameInput.value=session.name;
nameInput.addEventListener("input",()=>{session.name=nameInput.value;refresh();});
const durationControls=mountDurationControls(root.querySelector('[data-duration-controls]'),{workout:session,maxSessionMinutes,onChange:settings=>{Object.assign(session,settings);refresh();}});
const coverControls=mountWorkoutCoverControls(root.querySelector('[data-workout-cover-controls]'),{coverId:session.coverId,onChange:coverId=>{session.coverId=coverId;refresh();}});

/** View state for the volume panel: the clicked muscle, and the one under the mouse. */
let selectedMuscle = null;
let hoveredMuscle = null;

/** How long the hovered muscle outlives the pointer leaving it, so crossing a gap never flashes the hint. */
const HOVER_GRACE_MS = 150;
let hoverTimer = null;

/**
 * View state for the readout crossfade: the subject it shows now (a muscle, null for the hint, undefined before
 * the first render), the newest { subject, write } waiting for a fade-out to end, and that fade's timer.
 * The CSS opacity transition on #readout lasts READOUT_FADE_MS each way.
 */
const READOUT_FADE_MS = 75;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let readoutSubject;
let pendingReadout = null;
let readoutTimer = null;

/** View state for a pointer drag in progress: the pointer, the dragged card, and its index when the drag started. */
let sortable;
const moveMenu=mountReorderMenu();

/** View state: whether each exercise is collapsed, in session order. Never part of the session. */
let collapsed = session.exercises.map(() => true);

/**
 * View state for superset frames: each frame element keyed by its pair's `superset` object (which survives swaps),
 * a token that cancels a pending frame removal, and the frame still closing after Unlink, if any.
 */
const supersetFrames=new Map();
let frameToken=0,leavingFrame=null;

const list = root.querySelector('#exercises');
const empty = root.querySelector('#empty');
const listActions = root.querySelector('#list-actions');
const panel = root.querySelector('.panel');
const bodyMap = root.querySelector('#body-map');
const readout = root.querySelector('#readout');
const volumeList = root.querySelector('#volume');
const volumeEmpty = root.querySelector('#volume-empty');
const splitKey = root.querySelector('#split-key');
const orderStatus = root.querySelector('#order-status');
const goalsDialog = root.querySelector('#goals-dialog');
const goalFields = root.querySelector('#goal-fields');
const fileInput = root.querySelector('#import-file');
const fileMessage = root.querySelector('#file-message');

function muscleChips(role) {
  return MUSCLE_GROUPS.map((muscle) => `
    <label class="chip"><input type="checkbox" data-role="${role}" data-muscle="${muscle}"><span>${muscle}</span></label>`).join('');
}

/** `min`, `max` and `step` attributes for a range input. */
const rangeAttrs = ({ min, max, step }) => `min="${min}" max="${max}" step="${step}"`;

/** Position of a value along a slider's limits, from 0 to 1. */
const fraction = (value, { min, max }) => (value - min) / (max - min);

/** Fill a slider's track between two fractions (0 to 1). */
function setFill(slider, from, to) {
  slider.style.setProperty('--from', from);
  slider.style.setProperty('--to', to);
}

const CARD_HTML = `
  <div class="card-head">
    <div class="card-title-group">
    <h2 class="card-identity"><button type="button" class="heading-toggle" data-action="toggle" data-sortable-heading aria-expanded="true" aria-label="Collapse exercise" data-action-tooltip="Collapse exercise"><span class="card-index" aria-hidden="true"></span><span class="visually-hidden" data-position></span><span class="card-name"></span></button></h2>
    </div>
    <span class="hit-tag" data-hit-tag></span>
    <span class="fix-tag" data-fix-tag hidden>Needs fixing</span>
    <div class="card-controls">
    <button type="button" class="action-button" data-action="pair" data-action-tooltip="Superset with next exercise" aria-label="Superset with next exercise" hidden>${actionIcon('link')}</button>
    <button type="button" class="action-button reorder-action" data-action-tooltip="Reorder exercise" aria-label="Reorder exercise" aria-describedby="reorder-hint" aria-expanded="false">${actionIcon('reorder')}</button>
    <button type="button" class="action-button action-button--delete" data-action="remove" data-action-tooltip="Remove exercise" aria-label="Remove exercise">${actionIcon('delete')}</button>
    </div>
  </div>
  <div data-variant-metadata hidden></div>
  <div class="collapsible" data-collapse="summary"><p class="card-summary" data-summary></p></div>
  <div class="collapsible" data-collapse="body"><div class="card-body exercise-fields">
  <div class="exercise-main-fields">
  <div class="exercise-name-field">
  <label class="field">Exercise name <input type="text" data-field="name" placeholder="e.g. Bench press" autocomplete="off"></label>
  <p class="error" data-error="name"></p>
  </div>
  <div class="slider-field">
    <div class="slider-head"><span>Sets</span><span class="slider-value" data-value="sets" aria-hidden="true"></span></div>
    <div class="slider"><span class="slider-fill"></span>
      <input type="range" ${rangeAttrs(LIMITS.sets)} data-field="sets" aria-label="Sets"></div>
    <p class="error" data-error="sets"></p>
  </div>
  <div class="slider-field">
    <div class="slider-head"><span>Warm-up sets</span><span class="slider-value" data-value="warmupSets" aria-hidden="true"></span></div>
    <div class="slider"><span class="slider-fill"></span>
      <input type="range" ${rangeAttrs(LIMITS.warmupSets)} data-field="warmupSets" aria-label="Warm-up sets"></div>
    <p class="error" data-error="warmupSets"></p>
  </div>
  <div class="slider-field">
    <div class="slider-head"><span>Reps</span><span class="slider-value" data-value="reps" aria-hidden="true"></span></div>
    <div class="slider is-range"><span class="slider-fill"></span>
      <input type="range" ${rangeAttrs(LIMITS.reps)} data-field="min" aria-label="Reps min">
      <input type="range" ${rangeAttrs(LIMITS.reps)} data-field="max" aria-label="Reps max"></div>
    <p class="error" data-error="repRange"></p>
  </div>
  <p class="superset-rest-note" data-superset-rest hidden>Rest set by superset</p>
  <div class="slider-field" data-rest-field>
    <div class="slider-head"><span>Rest per set</span><span class="slider-value" data-value="restSeconds" aria-hidden="true"></span></div>
    <div class="slider"><span class="slider-fill"></span>
      <input type="range" ${rangeAttrs(DURATION_LIMITS.restSeconds)} data-field="restSeconds" aria-label="Rest per set"></div>
    <p class="error" data-error="restSeconds"></p>
  </div>
  </div>
  <div class="exercise-muscle-fields">
  <fieldset class="chips primary"><legend>Primary muscles</legend>${muscleChips('primary')}</fieldset>
  <fieldset class="chips secondary"><legend>Secondary muscles <span class="hint">count as ½ set</span></legend>${muscleChips('secondary')}</fieldset>
  </div>
  <p class="error" data-error="muscles"></p>
  </div></div>`;

/** Build the panel once; refresh() only updates levels and numbers, so hover state survives. */
function renderPanel() {
  bodyMap.innerHTML = ['front', 'back']
    .map((view) => `<figure>${bodySvg(view)}<figcaption>${view}</figcaption></figure>`)
    .join('');
  volumeList.replaceChildren(...MUSCLE_GROUPS.map((muscle) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <button type="button" class="volume-row" aria-pressed="false">
        <span class="name"></span>
        <span class="bar"><span class="bar-direct"></span><span class="bar-indirect"></span><span class="bar-goal" aria-hidden="true"></span></span>
        <span class="value"></span>
        <span class="status" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
        <span class="status-text visually-hidden"></span>
        <span class="split visually-hidden"></span>
      </button>`;
    const button = item.querySelector('button');
    button.dataset.muscle = muscle;
    button.querySelector('.name').textContent = muscle;
    return item;
  }));
}

/** Build the goal sliders once, one row per muscle. 0 on the slider means no goal. */
function renderGoalFields() {
  goalFields.replaceChildren(...MUSCLE_GROUPS.map((muscle, index) => {
    const row = document.createElement('div');
    row.className = 'goal-row';
    row.innerHTML = `
      <span class="goal-name"></span>
      <div class="slider"><span class="slider-fill"></span>
        <input type="range" min="0" max="${LIMITS.goal.max}" step="${LIMITS.goal.step}"></div>
      <span class="slider-value" aria-hidden="true"></span>
      <button type="button" class="info-btn" aria-expanded="false" aria-controls="goal-info-${index}" aria-describedby="goal-info-${index}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      </button>
      <div class="info-tip" id="goal-info-${index}" popover="manual">
        <p><strong>Productive sets</strong> <span class="info-sets"></span></p>
        <p><strong>Programming</strong> <span class="info-notes"></span></p>
      </div>`;
    row.querySelector('.goal-name').textContent = muscle;
    row.querySelector('.info-btn').setAttribute('aria-label', `About ${muscle}`);
    row.querySelector('.info-sets').textContent = MUSCLE_INFO[muscle].sets;
    row.querySelector('.info-notes').textContent = MUSCLE_INFO[muscle].notes;
    const input = row.querySelector('input');
    input.dataset.goal = muscle;
    input.setAttribute('aria-label', `${muscle} goal`);
    return row;
  }));
}

/** Show a goal slider's value text and fill; 0 reads `No goal`. */
function showGoal(input) {
  const value = input.valueAsNumber;
  const text = input.closest('.goal-row').querySelector('.slider-value');
  text.textContent = value === 0 ? 'No goal' : String(value);
  text.classList.toggle('is-empty', value === 0);
  if (value === 0) input.setAttribute('aria-valuetext', 'No goal');
  else input.removeAttribute('aria-valuetext');
  setFill(input.parentElement, 0, value / LIMITS.goal.max);
}

/** The goals dialog's one shown info tooltip, if any; `pinned` once clicked, so it outlasts hover and focus. */
let shownTip = null; // { button, pinned, byFocus }: a focus peek outlasts the mouse and hides on blur
let tipHideTimer = 0;

const tipFor = (button) => document.getElementById(button.getAttribute('aria-controls'));

/** Show a muscle's info tooltip next to its button, hiding any other one. */
function showTip(button, pinned) {
  document.dispatchEvent(new Event('gym-info-open'));
  clearTimeout(tipHideTimer);
  if (shownTip && shownTip.button !== button) hideTip();
  const tip = tipFor(button);
  const isOpen = tip.matches(':popover-open');
  // A closed tip is measured and placed while rendered hidden, so it opens from that spot: the entry slide then
  // starts on the side matching its placement.
  tip.classList.toggle('is-measuring', !isOpen);
  const { width, height } = tip.getBoundingClientRect();
  const { top, left, placement } = tooltipPosition(button.getBoundingClientRect(), { width, height },
    { width: innerWidth, height: innerHeight });
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.dataset.placement = placement;
  if (!isOpen) {
    getComputedStyle(tip).translate; // flush the placed, hidden style as the transition's start
    tip.classList.remove('is-measuring');
    tip.showPopover();
  }
  button.setAttribute('aria-expanded', 'true');
  shownTip = { button, pinned, byFocus: false };
}

function hideTip() {
  clearTimeout(tipHideTimer);
  if (!shownTip) return;
  tipFor(shownTip.button).hidePopover();
  shownTip.button.setAttribute('aria-expanded', 'false');
  shownTip = null;
}

/** The info button a pointer or focus event is about: its own, or the one whose tooltip it is on. */
function infoButtonAt(node) {
  const target = node instanceof Element ? node.closest('.info-btn, .info-tip') : null;
  if (!target) return null;
  return target.matches('.info-btn') ? target : target.closest('.goal-row').querySelector('.info-btn');
}

/** Show the applied goals on the sliders; a muscle without a goal sits at 0. */
function syncGoalFields() {
  goalFields.querySelectorAll('[data-goal]').forEach((input) => {
    input.value = session.goals[input.dataset.goal] ?? 0;
    showGoal(input);
  });
}

/** Open or close a card's collapsible part; a closed part is unfocusable and hidden from screen readers. */
function setOpen(part, open) {
  part.classList.toggle('is-closed', !open);
  part.toggleAttribute('inert', !open);
  part.setAttribute('aria-hidden',String(!open));
}

/**
 * Scroll a field into view once its card part has finished opening, so it is not measured at 0 height.
 * Reveals at once when nothing is animating (the part was already open, or motion is reduced).
 */
function revealWhenOpen(part, field) {
  const reveal = () => {
    part.firstElementChild.scrollTop = 0;
    field.scrollIntoView({ block: 'center' });
  };
  getComputedStyle(part).gridTemplateRows; // flush styles so a starting transition is visible to getAnimations()
  if (part.getAnimations().length === 0) return reveal();
  part.addEventListener('transitionend', function onEnd(event) {
    if (event.target !== part || event.propertyName !== 'grid-template-rows') return;
    part.removeEventListener('transitionend', onEnd);
    reveal();
  });
}

/**
 * Rebuild the exercise list. Only on load, add, remove, reorder and pair changes, so typing keeps focus. Ends any
 * drag, drops a now-stale file message and cancels a pending frame removal. Single exercises are `li.exercise`;
 * a pair is `li.superset[data-block-start]` holding its two cards in `ol.superset-members`. A frame created for
 * `entering` (a user pair action) starts closed so pairAt() can open it with the collapse transition.
 */
function renderExercises({entering=null}={}) {
  sortable?.cancel();
  moveMenu.close();
  fileMessage.textContent = '';
  frameToken++;leavingFrame=null;
  const active=document.activeElement;
  // Removing a focused control makes Chrome lay out the half-rebuilt list, which resets the page scroll (for example
  // Swap or Unlink at the bottom of a long template jumped to the top). Blur it first; focus is restored below.
  if(active&&list.contains(active))active.blur();
  for(const [ex,picker] of exercisePickers)if(!session.exercises.includes(ex)){picker.destroy();exercisePickers.delete(ex);exerciseCards.delete(ex);}
  for(const ex of exerciseCards.keys())if(!session.exercises.includes(ex))exerciseCards.delete(ex);
  for(const [ex,info]of exerciseInfos)if(!session.exercises.includes(ex)||!exerciseCards.has(ex)){info.controller.destroy();exerciseInfos.delete(ex);}
  const pairs=new Set(session.exercises.map(ex=>ex.superset).filter(Boolean));
  for(const key of supersetFrames.keys())if(!pairs.has(key))supersetFrames.delete(key);
  list.replaceChildren(...supersetBlocks(session.exercises).map(({start,length})=>{
    if(length===1)return buildCard(session.exercises[start],start);
    const pair=session.exercises[start].superset;
    let frame=supersetFrames.get(pair);
    if(!frame){
      frame=createSupersetFrame();supersetFrames.set(pair,frame);
      if(pair===entering){frame.classList.add('is-closed');setOpen(frame.querySelector('[data-collapse="frame"]'),false);}
    }
    frame.dataset.blockStart=start;
    frame.querySelector('.superset-members').replaceChildren(buildCard(session.exercises[start],start),buildCard(session.exercises[start+1],start+1));
    return frame;
  }));
  // Rebuilding re-inserts nodes, which drops focus; give it back to the same control when it is still shown.
  if(active&&active!==document.activeElement&&list.contains(active))active.focus({preventScroll:true});
  empty.hidden = session.exercises.length > 0;
  listActions.hidden = session.exercises.length === 0;
}

/** The exercise's card, built once and cached per exercise object, with its position labels updated. */
function buildCard(ex,i){
    let card=exerciseCards.get(ex);
    if(!card){
    card = document.createElement('li');
    card.className = 'exercise';
    card.innerHTML = CARD_HTML;
    const headingId='exercise-heading-'+crypto.randomUUID();
    card.querySelector('.card-identity').id=headingId;
    card.setAttribute('aria-labelledby',headingId);
    exerciseCards.set(ex,card);
    const legacy=!ex.catalogId&&Boolean(ex.name||ex.primaryMuscles.length||ex.secondaryMuscles.length);
    if(api){
      const host=document.createElement('div');host.className='exercise-picker';
      const name=card.querySelector('[data-field="name"]');
      if(legacy)name.closest('label').before(host);else name.closest('label').replaceWith(host);
      if(ex.catalogId||!legacy){
        const muscles=card.querySelector('.exercise-muscle-fields');muscles.replaceChildren();
        if(ex.catalogId)for(const [label,values] of [['Primary muscles',ex.primaryMuscles],['Secondary muscles',ex.secondaryMuscles]]){
          const p=document.createElement('p');p.className='linked-muscles';const title=document.createElement('strong');title.textContent=label+': ';p.append(title,values.join(', ')||'None');muscles.append(p);
        }
      }
      const picker=mountExercisePicker(host,{api,exercise:ex,legacy,showLinkedName:false,onView:()=>{location.hash='#/catalog/references/'+encodeURIComponent(ex.familyId)+'/variants/'+encodeURIComponent(ex.catalogId);},onSelect:entry=>{
        if(destroyed||!session.exercises.includes(ex))return;
        if(!ex.catalogId&&!legacy)ex.restSeconds=defaultRestSeconds(entry.exerciseType??undefined);
        Object.assign(ex,snapshotExercise(ex,entry));exercisePickers.get(ex)?.destroy();exercisePickers.delete(ex);exerciseCards.delete(ex);
        renderExercises();refresh();
        const updated=exerciseCards.get(ex);updated?.querySelector('[data-field="sets"]')?.focus({preventScroll:true});
      }});
      exercisePickers.set(ex,picker);
    }
    const infoButton=document.createElement('button');infoButton.type='button';infoButton.className='action-button exercise-info';infoButton.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2l-1.5 1.3V14m0 3h.01"/></svg>';
    card.querySelector('.card-title-group').append(infoButton);exerciseInfos.set(ex,{button:infoButton,controller:mountExerciseInfo(infoButton,{getDescriptions:()=>ex}),collapsed:null});
    if(card.querySelector('[data-field="name"]'))card.querySelector('[data-field="name"]').value = ex.name;
    }
    card.dataset.index = i;
    card.querySelector('.card-index').textContent = String(i + 1).padStart(2,'0');
    card.querySelector('[data-position]').textContent = `Exercise ${i + 1}: `;
    card.querySelector('.card-body').id = `exercise-body-${i}`;
    card.querySelector('[data-action="toggle"]').setAttribute('aria-controls', `exercise-body-${i}`);
    return card;
}

/** The card of the exercise at index i, wherever it sits (single, or inside a superset frame). */
const cardAt=i=>list.querySelector(`.exercise[data-index="${i}"]`);
const frameAt=start=>list.querySelector(`.superset[data-block-start="${start}"]`);

/** How the selected muscle is trained by an exercise: 'primary', 'secondary', 'none', or '' if nothing is selected. */
function hitFor(ex) {
  if (!selectedMuscle) return '';
  if (ex.primaryMuscles.includes(selectedMuscle)) return 'primary';
  if (ex.secondaryMuscles.includes(selectedMuscle)) return 'secondary';
  return 'none';
}

/** Update everything derived from state without recreating inputs. */
function refresh() {
  queueMicrotask(()=>sliderPresentation.sync());
  durationControls.update(session);
  const fingerprint=JSON.stringify(session);
  if(fingerprint!==lastDocument){lastDocument=fingerprint;onChange(structuredClone(session));}
  list.querySelectorAll('.exercise').forEach((card) => {
    const i = Number(card.dataset.index);
    const ex = session.exercises[i];
    card.querySelector('.card-name').textContent=ex.name.trim()||'Untitled exercise';
    card.querySelector('.card-identity').setAttribute('aria-label',`Exercise ${i+1}: ${ex.name.trim()||'Untitled exercise'}`);
    const errors = validateExercise(ex);
    const isCollapsed = collapsed[i];
    card.dataset.collapsed = String(isCollapsed);
    if(isCollapsed)exercisePickers.get(ex)?.close();
    renderVariantMetadata(card.querySelector('[data-variant-metadata]'),ex);
    const info=exerciseInfos.get(ex);if(info){if(info.collapsed!==isCollapsed)info.controller.hide();info.collapsed=isCollapsed;const target=!isCollapsed&&ex.catalogId?card.querySelector('.exercise-definition-actions'):card.querySelector('.card-title-group');if(target&&info.button.parentElement!==target)target.append(info.button);info.controller.update();}
    setOpen(card.querySelector('[data-collapse="body"]'), !isCollapsed);
    setOpen(card.querySelector('[data-collapse="summary"]'), isCollapsed);
    const role=pairRole(session.exercises,i),name=ex.name.trim()||'Untitled exercise';
    card.querySelector('[data-summary]').textContent = exerciseSummary(ex,{paired:role!==null});
    const pair=card.querySelector('[data-action="pair"]');
    pair.hidden=!canPairWithNext(session.exercises,i);
    pair.setAttribute('aria-label',`Superset ${name} with next exercise`);
    card.querySelector('.reorder-action').hidden=role!==null;
    card.querySelector('[data-rest-field]').hidden=role!==null;
    card.querySelector('[data-superset-rest]').hidden=role===null;
    const toggle = card.querySelector('[data-action="toggle"]');
    if(toggle.getAttribute('aria-expanded')!==String(!isCollapsed))disclosureTooltips.hide();
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    toggle.setAttribute('aria-label', `${isCollapsed ? 'Expand exercise' : 'Collapse exercise'}: ${ex.name.trim()||'Untitled exercise'}`);
    toggle.dataset.actionTooltip=isCollapsed ? 'Expand exercise' : 'Collapse exercise';
    const { min, max } = ex.repRange;
    const setsInput = card.querySelector('[data-field="sets"]');
    setsInput.value = ex.sets;
    const restInput=card.querySelector('[data-field="restSeconds"]');
    restInput.value=ex.restSeconds;
    restInput.setAttribute('aria-valuetext',formatDuration(ex.restSeconds));
    card.querySelector('[data-value="restSeconds"]').textContent=formatDuration(ex.restSeconds);
    setFill(restInput.parentElement,0,fraction(ex.restSeconds,DURATION_LIMITS.restSeconds));
    const warmup=Number.isInteger(ex.warmupSets)?ex.warmupSets:0;
    const warmupInput=card.querySelector('[data-field="warmupSets"]');
    warmupInput.value=warmup;
    warmupInput.setAttribute('aria-valuetext',warmup===0?'None':String(warmup));
    card.querySelector('[data-value="warmupSets"]').textContent=warmup===0?'None':String(warmup);
    setFill(warmupInput.parentElement,0,fraction(warmup,LIMITS.warmupSets));
    card.querySelector('[data-field="min"]').value = min;
    card.querySelector('[data-field="max"]').value = max;
    card.querySelector('[data-value="sets"]').textContent = String(ex.sets);
    card.querySelector('[data-value="reps"]').textContent = min === max ? String(min) : `${min}–${max}`;
    setFill(setsInput.parentElement, 0, fraction(ex.sets, LIMITS.sets));
    setFill(card.querySelector('.slider.is-range'), fraction(min, LIMITS.reps), fraction(max, LIMITS.reps));
    card.querySelector('[data-fix-tag]').hidden = !(isCollapsed && Object.keys(errors).length > 0);
    card.querySelectorAll('[data-error]').forEach((el) => {
      el.textContent = errors[el.dataset.error] ?? '';
    });
    card.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      const { role, muscle } = box.dataset;
      const own = role === 'primary' ? ex.primaryMuscles : ex.secondaryMuscles;
      const other = role === 'primary' ? ex.secondaryMuscles : ex.primaryMuscles;
      box.checked = own.includes(muscle);
      box.disabled = other.includes(muscle);
    });
    const hit = hitFor(ex);
    card.dataset.hit = hit;
    card.querySelector('[data-hit-tag]').textContent = hit === 'primary' || hit === 'secondary' ? `${hit} · ${selectedMuscle}` : '';
  });
  // A frame closing after Unlink keeps its last text until the rebuild removes it.
  list.querySelectorAll('.superset').forEach(frame=>{
    const pair=session.exercises[Number(frame.dataset.blockStart)]?.superset;
    if(pair&&frame!==leavingFrame)syncSupersetFrame(frame,pair);
  });

  const volume = computeVolume(session);
  const split = computeVolumeSplit(session);
  const splitText = (muscle) => ` (${split[muscle].direct} direct · ${split[muscle].indirect} indirect)`;
  const focus = hoveredMuscle ?? selectedMuscle;
  panel.classList.toggle('has-selection', selectedMuscle !== null);
  panel.querySelectorAll('[data-muscle]').forEach((el) => {
    const { muscle } = el.dataset;
    el.dataset.heat = heatLevel(volume[muscle]);
    el.classList.toggle('is-selected', muscle === selectedMuscle);
    el.classList.toggle('is-focus', muscle === focus);
  });
  const visible = visibleMuscles(volume, session.goals);
  volumeEmpty.hidden = visible.length > 0;
  splitKey.hidden = visible.length === 0;
  volumeList.classList.toggle('has-goals', Object.keys(session.goals).length > 0);
  const scale = barScale(volume, session.goals);
  volumeList.querySelectorAll('.volume-row').forEach((row) => {
    const { muscle } = row.dataset;
    row.parentElement.hidden = !visible.includes(muscle);
    const sets = volume[muscle];
    const goal = session.goals[muscle];
    const result = goalStatus(sets, goal);
    row.setAttribute('aria-pressed', String(muscle === selectedMuscle));
    row.classList.toggle('is-zero', sets === 0);
    row.querySelector('.value').textContent = result ? `${sets} / ${goal}` : String(sets);
    row.querySelector('.status-text').textContent = result?.status ?? '';
    const fill = barSegments(split[muscle].direct, split[muscle].indirect, scale);
    row.querySelector('.bar-direct').style.width = `${fill.direct * 100}%`;
    row.querySelector('.bar-indirect').style.width = `${fill.indirect * 100}%`;
    const bar = row.querySelector('.bar');
    bar.classList.toggle('no-direct', fill.direct === 0);
    bar.classList.toggle('no-indirect', fill.indirect === 0);
    const marker = row.querySelector('.bar-goal');
    marker.hidden = goal === undefined;
    if (goal !== undefined) marker.style.left = `${goal / scale * 100}%`;
    row.querySelector('.split').textContent = splitText(muscle);
    if (result) row.dataset.status = result.status;
    else delete row.dataset.status;
  });

  showReadout(focus, () => writeReadout(focus, volume, splitText));
}

/** Fill the readout with a muscle's details, or the hint when muscle is null. */
function writeReadout(focus, volume, splitText) {
  if (focus) {
    const count = session.exercises.filter((ex) =>
      ex.primaryMuscles.includes(focus) || ex.secondaryMuscles.includes(focus)).length;
    const name = document.createElement('strong');
    name.textContent = focus;
    const goal = session.goals[focus];
    const progress = goal === undefined ? '' : ` / ${goal}`;
    const status = goal === undefined ? '' : ` · ${goalStatus(volume[focus], goal).status}`;
    readout.replaceChildren(name, ` ${volume[focus]}${progress} sets${splitText(focus)}${status} · ${count} exercise${count === 1 ? '' : 's'}`);
  } else {
    readout.textContent = 'Tap a muscle to highlight its exercises.';
  }
}

/**
 * Show the readout for a subject. A new subject fades the old text out, then writes the newest pending content
 * and fades it in; the same subject, the first render, or reduced motion writes at once.
 */
function showReadout(subject, write) {
  const fading = pendingReadout !== null;
  if ((!fading && subject === readoutSubject) || readoutSubject === undefined || reducedMotion.matches) {
    clearTimeout(readoutTimer);
    pendingReadout = null;
    readout.classList.remove('is-fading');
    write();
    readoutSubject = subject;
    return;
  }
  pendingReadout = { subject, write };
  if (fading) return;
  readout.classList.add('is-fading');
  readoutTimer = setTimeout(() => {
    const { subject: next, write: writeNext } = pendingReadout;
    pendingReadout = null;
    writeNext();
    readoutSubject = next;
    readout.classList.remove('is-fading');
  }, READOUT_FADE_MS);
}

function indexOf(el) {
  return Number(el.closest('.exercise').dataset.index);
}

/** The block index (in supersetBlocks order) of the single card or superset frame containing el. */
function blockOf(el) {
  const frame = el.closest('.superset');
  const start = Number(frame ? frame.dataset.blockStart : el.closest('.exercise').dataset.index);
  return supersetBlocks(session.exercises).findIndex((block) => block.start === start);
}

/**
 * Move one block (a single exercise or a whole superset) to another block position, so a pair never splits and a
 * single never lands inside one. Applies the permutation to the exercises and the collapsed view state, rebuilds,
 * keeps focus on the moved block's Reorder handle and announces its new exercise positions.
 */
function commitBlockMove(fromBlock, toBlock) {
  const count = supersetBlocks(session.exercises).length;
  if (fromBlock < 0 || fromBlock >= count || toBlock < 0 || toBlock >= count || fromBlock === toBlock) return;
  const order = moveBlockOrder(session.exercises, fromBlock, toBlock);
  session.exercises = order.map((i) => session.exercises[i]);
  collapsed = order.map((i) => collapsed[i]);
  renderExercises();
  refresh();
  const { start, length } = supersetBlocks(session.exercises)[toBlock];
  const name = (i) => session.exercises[i].name.trim() || 'Untitled exercise';
  const total = session.exercises.length;
  if (length === 2) {
    frameAt(start).querySelector('.superset-head .reorder-action').focus();
    orderStatus.textContent = `Moved superset ${name(start)} and ${name(start + 1)} to positions ${start + 1}–${start + 2} of ${total}.`;
  } else {
    cardAt(start).querySelector('.reorder-action').focus();
    orderStatus.textContent = `Moved ${name(start)} to position ${start + 1} of ${total}.`;
  }
}

list.addEventListener('input', (event) => {
  const { field } = event.target.dataset;
  if (!field) return;
  const ex = session.exercises[indexOf(event.target)];
  if (field === 'name') ex.name = event.target.value;
  if (field === 'sets') ex.sets = event.target.valueAsNumber;
  if (field === 'warmupSets') ex.warmupSets = event.target.valueAsNumber;
  if (field === 'restSeconds') ex.restSeconds = event.target.valueAsNumber;
  if (field === 'min' || field === 'max') {
    ex.repRange = setRepBound(ex.repRange, field, event.target.valueAsNumber);
  }
  fileMessage.textContent = '';
  refresh();
});

list.addEventListener('change', (event) => {
  const { role, muscle } = event.target.dataset;
  if (!role) return;
  const i = indexOf(event.target);
  Object.assign(session.exercises[i],toggleMuscle(session.exercises[i], role, muscle));
  fileMessage.textContent = '';
  refresh();
});

function setExerciseCollapsed(index, nextCollapsed, {focusToggle=false}={}) {
  const card=cardAt(index);
  if(!card)return;
  const toggle=card.querySelector('[data-action="toggle"]');
  if(focusToggle||(nextCollapsed&&card.querySelector('[data-collapse="body"]').contains(document.activeElement)))toggle.focus({preventScroll:true});
  collapsed[index]=nextCollapsed;
  refresh();
}

list.addEventListener('click', (event) => {
  if(event.defaultPrevented||event.button!==0||!event.target.closest('.exercise'))return;
  const action = event.target.closest('[data-action]')?.dataset.action;
  const i = indexOf(event.target);
  if(i<0)return;
  if (action === 'toggle') {
    setExerciseCollapsed(i,!collapsed[i],{focusToggle:true});
    return;
  }
  if(!action){
    if(collapsed[i]&&!event.target.closest('button,input,select,textarea,a,label,[contenteditable]:not([contenteditable="false"]),[role],[tabindex]'))setExerciseCollapsed(i,false,{focusToggle:true});
    return;
  }
  if(action==='pair'){pairAt(i);return;}
  if(action!=='remove')return;
  // Removing a pair member dissolves the pair; the other member keeps its own rest.
  const next=removeExercise(session.exercises,i);
  session.exercises=session.exercises.filter((_,k)=>k!==i);
  adoptAll(next);
  collapsed.splice(i, 1);
  renderExercises();
  refresh();
});

/** Copy a pure helper's result into the existing exercise object, so its card, picker and info stay attached. */
function adopt(target,value){
  if(target===value)return;
  for(const key of Object.keys(target))if(!Object.hasOwn(value,key))delete target[key];
  Object.assign(target,value);
}
const adoptAll=next=>session.exercises.forEach((ex,k)=>adopt(ex,next[k]));

/** Pair exercise i with the next one. A new frame opens with the collapse transition; a closing one reopens. */
function pairAt(i){
  if(!canPairWithNext(session.exercises,i))return;
  const reopen=leavingFrame&&Number(leavingFrame.dataset.blockStart)===i?leavingFrame:null;
  adoptAll(pairWithNext(session.exercises,i));
  const pair=session.exercises[i].superset;
  if(reopen)supersetFrames.set(pair,reopen);
  renderExercises({entering:pair});
  refresh();
  const frame=frameAt(i),head=frame.querySelector('[data-collapse="frame"]');
  getComputedStyle(head).gridTemplateRows; // flush the closed state so opening transitions from it
  frame.classList.remove('is-closed');setOpen(head,true);
  frame.querySelector('[data-superset-action="unlink"]').focus({preventScroll:true});
}

/** Unlink the pair starting at `start`: data changes at once; the frame closes before the list is rebuilt. */
function unlinkAt(start){
  const frame=frameAt(start);
  adoptAll(unpair(session.exercises,start));
  refresh();
  cardAt(start)?.querySelector('[data-action="pair"]').focus({preventScroll:true});
  const head=frame?.querySelector('[data-collapse="frame"]');
  if(!head){renderExercises();refresh();return;}
  const token=++frameToken;leavingFrame=frame;
  frame.classList.add('is-closed');setOpen(head,false);
  getComputedStyle(head).gridTemplateRows; // flush styles so a starting transition is visible to getAnimations()
  const finish=()=>{if(token!==frameToken)return;renderExercises();refresh();};
  if(head.getAnimations().length===0)return finish();
  head.addEventListener('transitionend',function onEnd(event){
    if(event.target!==head||event.propertyName!=='grid-template-rows')return;
    head.removeEventListener('transitionend',onEnd);finish();
  });
  setTimeout(finish,400); // safety net when no transitionend arrives (for example a hidden tab)
}

/** Swap a pair's members in place, keeping each exercise object, its card and the frame. */
function swapAt(start){
  const next=swapPair(session.exercises,start),[a,b]=session.exercises.slice(start,start+2);
  session.exercises.splice(start,2,b,a);
  adoptAll(next);
  collapsed.splice(start,2,collapsed[start+1],collapsed[start]);
  renderExercises();
  refresh();
}

function setSupersetSettingsOpen(frame,open){
  const toggle=frame.querySelector('[data-superset-action="settings"]'),body=frame.querySelector('[data-collapse="settings"]');
  if(!open&&body.contains(document.activeElement))toggle.focus({preventScroll:true});
  toggle.setAttribute('aria-expanded',String(open));
  setOpen(body,open);
}

list.addEventListener('click',event=>{
  const button=event.target.closest('[data-superset-action]');
  if(!button||event.defaultPrevented)return;
  const frame=button.closest('.superset'),start=Number(frame.dataset.blockStart);
  if(frame===leavingFrame||!session.exercises[start]?.superset)return;
  const action=button.dataset.supersetAction;
  if(action==='settings')setSupersetSettingsOpen(frame,button.getAttribute('aria-expanded')!=='true');
  else if(action==='swap')swapAt(start);
  else if(action==='unlink')unlinkAt(start);
});

list.addEventListener('input',event=>{
  const field=event.target.dataset.supersetField;
  if(!field)return;
  const pair=session.exercises[Number(event.target.closest('.superset').dataset.blockStart)]?.superset;
  if(!pair)return;
  pair[field]=event.target.valueAsNumber;
  fileMessage.textContent='';
  refresh();
});

list.addEventListener('keydown', (event) => {
  if (!event.target.classList.contains('reorder-action')) return;
  const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const from = blockOf(event.target);
  commitBlockMove(from, from + step);
});

/** Put the last-touched thumb of a two-thumb slider on top, so it can be dragged where the thumbs overlap. */
function raiseThumb(event) {
  const input = event.target;
  if (!input.parentElement?.classList.contains('is-range')) return;
  input.parentElement.querySelectorAll('input').forEach((el) => el.classList.toggle('is-top', el === input));
}
list.addEventListener('pointerdown', raiseThumb);
list.addEventListener('focusin', raiseThumb);

sortable=mountSortable(list,{
  // Items are blocks: single cards and whole superset frames (members are never items, so nothing drops between them).
  // Keys are block start indexes, mapped to block positions on drop. A frame still closing after Unlink
  // (.is-closed) is no longer a pair, so it is not an item until the rebuild replaces it.
  itemSelector:'.exercise:not(.superset .exercise), .superset:not(.is-closed)',reorderSelector:'.reorder-action',getGroups:()=>[{element:list,key:'exercises'}],
  getKey:item=>item.matches('.superset')?item.dataset.blockStart:item.dataset.index,
  onCommit:({key,beforeKey})=>{
    const blocks=supersetBlocks(session.exercises),from=blocks.findIndex(b=>b.start===Number(key));
    const others=blocks.filter((_,i)=>i!==from);
    const to=beforeKey===null?others.length:others.findIndex(b=>b.start===Number(beforeKey));
    if(from>=0&&to>=0)commitBlockMove(from,to);
  }
});
list.addEventListener('click',event=>{
 const button=event.target.closest('.reorder-action');if(!button)return;
 const from=blockOf(button),count=supersetBlocks(session.exercises).length;
 moveMenu.toggle(button,[['Move up',-1],['Move down',1]].map(([label,step])=>({
  label,disabled:from+step<0||from+step>=count,run:()=>commitBlockMove(from,from+step)
 })));
});

root.querySelector('#add-exercise').addEventListener('click', () => {
  session.exercises.push(createExercise());
  collapsed.push(false);
  renderExercises();
  refresh();
  cardAt(session.exercises.length-1).querySelector('[role="combobox"],[data-field="name"]').focus();
});

root.querySelector('#expand-all').addEventListener('click', () => {
  collapsed.fill(false);
  refresh();
});

root.querySelector('#collapse-all').addEventListener('click', () => {
  const activeCard=document.activeElement?.closest('.exercise');
  if(activeCard&&list.contains(activeCard)&&activeCard.querySelector('[data-collapse="body"]').contains(document.activeElement))activeCard.querySelector('[data-action="toggle"]').focus({preventScroll:true});
  collapsed.fill(true);
  refresh();
});

/** The field to focus for each validateExercise error key. */
const ERROR_FIELDS = {
  name: '[data-field="name"]',
  sets: '[data-field="sets"]',
  warmupSets: '[data-field="warmupSets"]',
  restSeconds: '[data-field="restSeconds"]',
  repRange: '[data-field="min"]',
  // When every muscle is secondary, all primary chips are disabled; fall back to the first secondary chip.
  muscles: 'input[data-role="primary"]:not(:disabled), input[data-role="secondary"]',
};

/** Download the session as JSON, unless an exercise is invalid; then open that exercise at its first invalid field. */
function focusFirstError() {
  if(!session.name.trim()){nameInput.focus();return true;}
  const invalid=session.exercises.findIndex(ex=>Object.keys(validateExercise(ex)).length);
  if(invalid<0)return false;
  focusExerciseError(invalid,Object.keys(validateExercise(session.exercises[invalid]))[0],`Fix exercise ${invalid+1} before exporting.`);
  return true;
}
function focusExerciseError(index,key,message){
  collapsed[index]=false;refresh();fileMessage.textContent=message;
  const card=cardAt(index),field=card.querySelector('[role="combobox"]')||card.querySelector(ERROR_FIELDS[key]||ERROR_FIELDS.name);
  if(field){field.focus({preventScroll:true});revealWhenOpen(card.querySelector('[data-collapse="body"]'),field);}
}
root.querySelector('#export-session').addEventListener('click',()=>{
  if(focusFirstError())return;
  if(onExport){onExport(session);return;}
  const url=URL.createObjectURL(new Blob([serializeDocument('template',session)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=documentFileName('template');link.click();URL.revokeObjectURL(url);
});
root.querySelector('#import-session').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async()=>{
  const [file]=fileInput.files;if(!file)return;fileInput.value='';
  if(file.size>1048576){fileMessage.textContent='File must be at most 1 MiB.';return;}
  if(onImportFile){try{await onImportFile(file);}catch(error){if(!destroyed)fileMessage.textContent=error.message;}return;}
  const text=await file.text();
  if(destroyed)return;
  const result=parseDocument(text);
  if(result.error){fileMessage.textContent=result.error;return;}
  if(result.kind!=='template'){fileMessage.textContent='Import program files from Programs.';return;}
  const before=JSON.stringify(session);
  if((session.exercises.length||Object.keys(session.goals).length)&&!await confirmAction({title:'Replace template?',message:'Replace this session template?',confirmLabel:'Replace template',destructive:true,signal:confirmationController.signal}))return;
  if(destroyed||before!==JSON.stringify(session))return;
  setWorkout(result.document);onImport?.(result.document);
});
function setWorkout(value,{silent=false}={}){session={...normalizeWorkoutTiming(structuredClone(value)),coverId:normalizeWorkoutCover(value.coverId)};coverControls.setCoverId(session.coverId);if(silent)lastDocument=JSON.stringify(session);nameInput.value=session.name;collapsed=session.exercises.map(()=>true);renderExercises();syncGoalFields();refresh();}
function syncSaved(value){
 session.coverId=normalizeWorkoutCover(value.coverId);coverControls.setCoverId(session.coverId);
 let changed=false;
 const definition=ex=>JSON.stringify([ex.name,ex.catalogId,ex.catalogRevision,ex.familyId,ex.equipment,ex.primaryMuscles,ex.secondaryMuscles,ex.referenceDescription,ex.variantDescription,ex.brand,ex.focusTags]);
 session.exercises.forEach((ex,i)=>{
  const saved=value.exercises[i];if(!ex.catalogId||saved?.catalogId!==ex.catalogId)return;
  const before=definition(ex);Object.assign(ex,structuredClone(saved));delete ex.catalogCopyOf;
  if(before!==definition(ex)){
   exercisePickers.get(ex)?.update();
   const muscles=exerciseCards.get(ex)?.querySelectorAll('.linked-muscles');
   for(const [index,label,values] of [[0,'Primary muscles',ex.primaryMuscles],[1,'Secondary muscles',ex.secondaryMuscles]]){
    if(!muscles?.[index])continue;
    const title=document.createElement('strong');title.textContent=label+': ';
    muscles[index].replaceChildren(title,values.join(', ')||'None');
   }
   changed=true;
  }
 });
 lastDocument=JSON.stringify(session);
 if(changed)refresh();
}

root.querySelector('#open-goals').addEventListener('click', () => {
  syncGoalFields();
  hideTip();
  goalsDialog.showModal();
});

/** Clicking an info button pins its tooltip; clicking it again hides it. */
goalFields.addEventListener('click', (event) => {
  const button = event.target.closest('.info-btn');
  if (!button) return;
  if (shownTip?.button === button && shownTip.pinned) hideTip();
  else showTip(button, true);
});

/** A mouse over an info button, or its tooltip, peeks at the tooltip. */
goalFields.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const button = infoButtonAt(event.target);
  if (!button) return;
  if (shownTip?.button === button) clearTimeout(tipHideTimer);
  else showTip(button, false);
});

/** Leaving both the button and its tooltip hides a peeked tooltip after a short grace. */
goalFields.addEventListener('pointerout', (event) => {
  if (event.pointerType !== 'mouse' || !shownTip || shownTip.pinned || shownTip.byFocus) return;
  if (infoButtonAt(event.relatedTarget) === shownTip.button) return;
  clearTimeout(tipHideTimer);
  tipHideTimer = setTimeout(hideTip, 150);
});

goalFields.addEventListener('focusin', (event) => {
  if (!event.target.matches('.info-btn:focus-visible')) return;
  if (shownTip?.button !== event.target) showTip(event.target, false);
  shownTip.byFocus = true;
});

goalFields.addEventListener('focusout', (event) => {
  if (shownTip?.button === event.target && !shownTip.pinned) hideTip();
});

/** A press anywhere but the shown button and its tooltip hides it. */
goalsDialog.addEventListener('pointerdown', (event) => {
  if (shownTip && infoButtonAt(event.target) !== shownTip.button) hideTip();
}, true);

/** Escape hides a shown tooltip first; the dialog closes on the next one. */
goalsDialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !shownTip) return;
  event.preventDefault();
  hideTip();
});

goalsDialog.addEventListener('scroll', hideTip);
goalsDialog.addEventListener('close', hideTip);
window.addEventListener('resize', hideTip);

/** Apply a goal while sliding. 0 clears it. */
goalFields.addEventListener('input', (event) => {
  const { goal: muscle } = event.target.dataset;
  if (!muscle) return;
  const value = event.target.valueAsNumber;
  if (value === 0) delete session.goals[muscle];
  else session.goals[muscle] = value;
  showGoal(event.target);
  refresh();
});

/** Only a backdrop click lands on the dialog element itself; its content is wrapped in .dialog-body. */
goalsDialog.addEventListener('click', (event) => {
  if (event.target === goalsDialog) goalsDialog.close();
});

panel.addEventListener('click', (event) => {
  const target = event.target.closest('[data-muscle]');
  if (!target) return;
  const { muscle } = target.dataset;
  selectedMuscle = selectedMuscle === muscle ? null : muscle;
  refresh();
});

/** Hover a muscle at once; let go of one (muscle = null) only after HOVER_GRACE_MS, unless another is hovered first. */
function setHover(muscle) {
  if (muscle === null) {
    // Arm once: crossing more non-muscle elements must not push the fallback back.
    if (hoveredMuscle !== null && hoverTimer === null) {
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        setHoveredMuscle(null);
      }, HOVER_GRACE_MS);
    }
    return;
  }
  clearTimeout(hoverTimer);
  hoverTimer = null;
  setHoveredMuscle(muscle);
}

function setHoveredMuscle(muscle) {
  if (muscle === hoveredMuscle) return;
  hoveredMuscle = muscle;
  refresh();
}

panel.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  setHover(event.target.closest('[data-muscle]')?.dataset.muscle ?? null);
});

panel.addEventListener('pointerleave', () => setHover(null));

renderPanel();
renderGoalFields();
renderExercises();
refresh();

const panelLayout=mountPanelLayout(panel);
return {setWorkout,syncSaved,focusFirstError,setMaxSessionMinutes:durationControls.setMaxSessionMinutes,destroy(){
  onSaveStatusSlotChange(null);
  coverControls.destroy();
  confirmationController.abort();destroyed=true;frameToken++;supersetFrames.clear();sliderPresentation.destroy();disclosureTooltips.destroy();durationControls.destroy();panelLayout.destroy();sortable.destroy();moveMenu.destroy();
  exerciseInfos.forEach(info=>info.controller.destroy());exerciseInfos.clear();
  exercisePickers.forEach(picker=>picker.destroy());exercisePickers.clear();exerciseCards.clear();
  clearTimeout(hoverTimer);clearTimeout(readoutTimer);clearTimeout(tipHideTimer);
  hideTip();goalsDialog.close();window.removeEventListener('resize',hideTip);root.replaceChildren();
}};

}
