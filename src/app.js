import { MUSCLE_GROUPS } from './muscles.js';
import { barSegments, computeVolume, computeVolumeSplit, goalStatus, volumeLevel } from './volume.js';
import { validateExercise, validateGoal } from './validate.js';
import { createExercise, exerciseSummary, moveExercise, toggleMuscle } from './exercise.js';
import { bodySvg } from './body.js';
import { serializeSession, parseSession, exportFileName } from './session-file.js';

/**
 * The only domain state. Volume, goal status and errors are derived from it in refresh().
 * `goals` has a key only for muscles with a valid goal.
 */
const session = { exercises: [], goals: {} };

/** View state for the volume panel: the clicked muscle, and the one under the mouse. */
let selectedMuscle = null;
let hoveredMuscle = null;

/** View state for a pointer drag in progress: the pointer, the dragged card, and its index when the drag started. */
let drag = null;

/** View state: whether each exercise is collapsed, in session order. Never part of the session. */
let collapsed = [];

const list = document.querySelector('#exercises');
const empty = document.querySelector('#empty');
const listActions = document.querySelector('#list-actions');
const panel = document.querySelector('.panel');
const bodyMap = document.querySelector('#body-map');
const readout = document.querySelector('#readout');
const volumeList = document.querySelector('#volume');
const orderStatus = document.querySelector('#order-status');
const goalsDialog = document.querySelector('#goals-dialog');
const goalFields = document.querySelector('#goal-fields');
const fileInput = document.querySelector('#import-file');
const fileMessage = document.querySelector('#file-message');

function muscleChips(role) {
  return MUSCLE_GROUPS.map((muscle) => `
    <label class="chip"><input type="checkbox" data-role="${role}" data-muscle="${muscle}"><span>${muscle}</span></label>`).join('');
}

const CARD_HTML = `
  <div class="card-head">
    <button type="button" class="drag-handle" aria-label="Reorder exercise" aria-describedby="reorder-hint">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
    </button>
    <span class="card-index"></span>
    <span class="hit-tag" data-hit-tag></span>
    <span class="fix-tag" data-fix-tag hidden>Needs fixing</span>
    <button type="button" class="toggle-btn" data-action="toggle" aria-expanded="true" aria-label="Collapse exercise">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <button type="button" class="icon-btn" data-action="remove" aria-label="Remove exercise">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
    </button>
  </div>
  <p class="card-summary" data-summary hidden></p>
  <div class="card-body">
  <label class="field">Exercise name <input type="text" data-field="name" placeholder="e.g. Bench press" autocomplete="off"></label>
  <p class="error" data-error="name"></p>
  <div class="numbers">
    <label class="field">Sets <input type="number" min="1" step="1" inputmode="numeric" data-field="sets"></label>
    <label class="field">Reps min <input type="number" min="1" step="1" inputmode="numeric" data-field="min"></label>
    <label class="field">Reps max <input type="number" min="1" step="1" inputmode="numeric" data-field="max"></label>
  </div>
  <p class="error" data-error="sets"></p>
  <p class="error" data-error="repRange"></p>
  <fieldset class="chips primary"><legend>Primary muscles</legend>${muscleChips('primary')}</fieldset>
  <fieldset class="chips secondary"><legend>Secondary muscles <span class="hint">count as ½ set</span></legend>${muscleChips('secondary')}</fieldset>
  <p class="error" data-error="muscles"></p>
  </div>`;

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
        <span class="bar"><span class="bar-direct"></span><span class="bar-indirect"></span></span>
        <span class="value"></span>
        <span class="status"></span>
        <span class="split visually-hidden"></span>
      </button>`;
    const button = item.querySelector('button');
    button.dataset.muscle = muscle;
    button.querySelector('.name').textContent = muscle;
    return item;
  }));
}

/** Build the goal fields once, one per muscle. */
function renderGoalFields() {
  goalFields.replaceChildren(...MUSCLE_GROUPS.map((muscle) => {
    const item = document.createElement('div');
    item.innerHTML = `
      <label class="field"><span></span><input type="number" min="0.5" step="0.5" inputmode="decimal"></label>
      <p class="error"></p>`;
    item.querySelector('span').textContent = muscle;
    item.querySelector('input').dataset.goal = muscle;
    item.querySelector('.error').dataset.goalError = muscle;
    return item;
  }));
}

/** Show the applied goals in the fields and drop any discarded text and errors. */
function syncGoalFields() {
  goalFields.querySelectorAll('[data-goal]').forEach((input) => {
    input.value = session.goals[input.dataset.goal] ?? '';
  });
  goalFields.querySelectorAll('[data-goal-error]').forEach((el) => {
    el.textContent = '';
  });
}

/** Rebuild the exercise list. Only on load, add, remove and reorder, so typing keeps focus. Ends any drag and drops a now-stale file message. */
function renderExercises() {
  drag = null;
  fileMessage.textContent = '';
  list.replaceChildren(...session.exercises.map((ex, i) => {
    const card = document.createElement('li');
    card.className = 'exercise';
    card.dataset.index = i;
    card.innerHTML = CARD_HTML;
    card.querySelector('.card-index').textContent = `Exercise ${i + 1}`;
    card.querySelector('.card-body').id = `exercise-body-${i}`;
    card.querySelector('[data-action="toggle"]').setAttribute('aria-controls', `exercise-body-${i}`);
    card.querySelector('[data-field="name"]').value = ex.name;
    card.querySelector('[data-field="sets"]').value = Number.isNaN(ex.sets) ? '' : ex.sets;
    card.querySelector('[data-field="min"]').value = Number.isNaN(ex.repRange.min) ? '' : ex.repRange.min;
    card.querySelector('[data-field="max"]').value = Number.isNaN(ex.repRange.max) ? '' : ex.repRange.max;
    return card;
  }));
  empty.hidden = session.exercises.length > 0;
  listActions.hidden = session.exercises.length === 0;
}

/** How the selected muscle is trained by an exercise: 'primary', 'secondary', 'none', or '' if nothing is selected. */
function hitFor(ex) {
  if (!selectedMuscle) return '';
  if (ex.primaryMuscles.includes(selectedMuscle)) return 'primary';
  if (ex.secondaryMuscles.includes(selectedMuscle)) return 'secondary';
  return 'none';
}

/** Update everything derived from state without recreating inputs. */
function refresh() {
  list.querySelectorAll('.exercise').forEach((card) => {
    const i = Number(card.dataset.index);
    const ex = session.exercises[i];
    const errors = validateExercise(ex);
    const isCollapsed = collapsed[i];
    card.querySelector('.card-body').hidden = isCollapsed;
    const summary = card.querySelector('[data-summary]');
    summary.hidden = !isCollapsed;
    summary.textContent = exerciseSummary(ex);
    const toggle = card.querySelector('[data-action="toggle"]');
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    toggle.setAttribute('aria-label', isCollapsed ? 'Expand exercise' : 'Collapse exercise');
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

  const volume = computeVolume(session);
  const split = computeVolumeSplit(session);
  const splitText = (muscle) => ` (${split[muscle].direct} direct · ${split[muscle].indirect} indirect)`;
  const focus = hoveredMuscle ?? selectedMuscle;
  panel.classList.toggle('has-selection', selectedMuscle !== null);
  panel.querySelectorAll('[data-muscle]').forEach((el) => {
    const { muscle } = el.dataset;
    el.dataset.level = volumeLevel(volume[muscle]);
    el.classList.toggle('is-selected', muscle === selectedMuscle);
    el.classList.toggle('is-focus', muscle === focus);
  });
  volumeList.classList.toggle('has-goals', Object.keys(session.goals).length > 0);
  volumeList.querySelectorAll('.volume-row').forEach((row) => {
    const { muscle } = row.dataset;
    const sets = volume[muscle];
    const goal = session.goals[muscle];
    const result = goalStatus(sets, goal);
    row.setAttribute('aria-pressed', String(muscle === selectedMuscle));
    row.querySelector('.value').textContent = result ? `${sets} / ${goal}` : String(sets);
    row.querySelector('.status').textContent = result?.status ?? '';
    const fill = barSegments(split[muscle].direct, split[muscle].indirect, goal ?? 10);
    row.querySelector('.bar-direct').style.width = `${fill.direct * 100}%`;
    row.querySelector('.bar-indirect').style.width = `${fill.indirect * 100}%`;
    row.querySelector('.split').textContent = splitText(muscle);
    if (result) row.dataset.status = result.status;
    else delete row.dataset.status;
  });

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

function indexOf(el) {
  return Number(el.closest('.exercise').dataset.index);
}

/** Commit a reorder to state, rebuild the list, and keep focus on the moved exercise's handle. */
function commitMove(from, to) {
  if (from === to) return;
  session.exercises = moveExercise(session.exercises, from, to);
  collapsed = moveExercise(collapsed, from, to);
  renderExercises();
  refresh();
  list.children[to].querySelector('.drag-handle').focus();
  const name = session.exercises[to].name.trim() || 'exercise';
  orderStatus.textContent = `Moved ${name} to position ${to + 1} of ${session.exercises.length}.`;
}

list.addEventListener('input', (event) => {
  const { field } = event.target.dataset;
  if (!field) return;
  const ex = session.exercises[indexOf(event.target)];
  if (field === 'name') ex.name = event.target.value;
  if (field === 'sets') ex.sets = event.target.valueAsNumber;
  if (field === 'min' || field === 'max') {
    ex.repRange = { ...ex.repRange, [field]: event.target.valueAsNumber };
  }
  fileMessage.textContent = '';
  refresh();
});

list.addEventListener('change', (event) => {
  const { role, muscle } = event.target.dataset;
  if (!role) return;
  const i = indexOf(event.target);
  session.exercises[i] = toggleMuscle(session.exercises[i], role, muscle);
  fileMessage.textContent = '';
  refresh();
});

list.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  const i = indexOf(event.target);
  if (action === 'toggle') {
    collapsed[i] = !collapsed[i];
    refresh();
    return;
  }
  session.exercises.splice(i, 1);
  collapsed.splice(i, 1);
  renderExercises();
  refresh();
});

list.addEventListener('keydown', (event) => {
  if (!event.target.classList.contains('drag-handle')) return;
  const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const from = indexOf(event.target);
  const to = from + step;
  if (to >= 0 && to < session.exercises.length) commitMove(from, to);
});

list.addEventListener('pointerdown', (event) => {
  const handle = event.target.closest('.drag-handle');
  if (!handle || event.button !== 0 || drag) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  drag = { pointerId: event.pointerId, card: handle.closest('.exercise'), from: indexOf(handle) };
  drag.card.classList.add('is-dragging');
});

/**
 * While dragging, reorder DOM nodes only; state changes on drop. The dragged card itself
 * is never detached, because removing it from the document would release pointer capture.
 */
list.addEventListener('pointermove', (event) => {
  if (event.pointerId !== drag?.pointerId) return;
  const others = [...list.children].filter((card) => card !== drag.card);
  const target = others.filter((card) => {
    const rect = card.getBoundingClientRect();
    return rect.top + rect.height / 2 < event.clientY;
  }).length;
  if ([...list.children].indexOf(drag.card) === target) return;
  others.slice(0, target).forEach((card) => list.insertBefore(card, drag.card));
  others.slice(target).forEach((card) => list.append(card));
});

list.addEventListener('pointerup', (event) => {
  if (event.pointerId !== drag?.pointerId) return;
  const { card, from } = drag;
  drag = null;
  card.classList.remove('is-dragging');
  commitMove(from, [...list.children].indexOf(card));
});

/** Abandon a drag: state was never changed, so rebuilding from it restores the order. */
function cancelDrag(event) {
  if (event.pointerId !== drag?.pointerId) return;
  renderExercises();
  refresh();
}

list.addEventListener('pointercancel', cancelDrag);
list.addEventListener('lostpointercapture', cancelDrag);

document.querySelector('#add-exercise').addEventListener('click', () => {
  session.exercises.push(createExercise());
  collapsed.push(false);
  renderExercises();
  refresh();
  list.lastElementChild.querySelector('[data-field="name"]').focus();
});

document.querySelector('#expand-all').addEventListener('click', () => {
  collapsed.fill(false);
  refresh();
});

document.querySelector('#collapse-all').addEventListener('click', () => {
  collapsed.fill(true);
  refresh();
});

/** The field to focus for each validateExercise error key. */
const ERROR_FIELDS = {
  name: '[data-field="name"]',
  sets: '[data-field="sets"]',
  repRange: '[data-field="min"]',
  // When every muscle is secondary, all primary chips are disabled; fall back to the first secondary chip.
  muscles: 'input[data-role="primary"]:not(:disabled), input[data-role="secondary"]',
};

/** Download the session as JSON, unless an exercise is invalid; then open that exercise at its first invalid field. */
document.querySelector('#export-session').addEventListener('click', () => {
  fileMessage.textContent = '';
  const invalid = session.exercises.findIndex((ex) => Object.keys(validateExercise(ex)).length > 0);
  if (invalid !== -1) {
    fileMessage.textContent = `Fix exercise ${invalid + 1} before exporting.`;
    collapsed[invalid] = false;
    refresh();
    const [firstError] = Object.keys(validateExercise(session.exercises[invalid]));
    list.children[invalid].querySelector(ERROR_FIELDS[firstError]).focus();
    return;
  }
  const url = URL.createObjectURL(new Blob([serializeSession(session)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName();
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#import-session').addEventListener('click', () => {
  fileMessage.textContent = '';
  fileInput.click();
});

/** Replace the session with a valid file. A bad file is rejected before asking to confirm. */
fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  if (!file) return;
  fileInput.value = '';
  fileMessage.textContent = '';
  const text = await file.text();
  const result = parseSession(text);
  if (result.error) {
    fileMessage.textContent = result.error;
    return;
  }
  const hasContent = session.exercises.length > 0 || Object.keys(session.goals).length > 0;
  if (hasContent && !confirm('Replace the current session? Its exercises and goals will be lost.')) return;
  session.exercises = result.session.exercises;
  session.goals = result.session.goals;
  collapsed = result.session.exercises.map(() => true);
  renderExercises();
  refresh();
});

document.querySelector('#open-goals').addEventListener('click', () => {
  syncGoalFields();
  goalsDialog.showModal();
});

/** Apply a goal as it is typed. Empty clears it; an invalid value shows an error and keeps the old goal. */
goalFields.addEventListener('input', (event) => {
  const { goal: muscle } = event.target.dataset;
  if (!muscle) return;
  const error = goalFields.querySelector(`[data-goal-error="${muscle}"]`);
  if (event.target.value.trim() === '' && !event.target.validity.badInput) {
    delete session.goals[muscle];
    error.textContent = '';
  } else {
    const message = validateGoal(event.target.valueAsNumber);
    error.textContent = message ?? '';
    if (!message) session.goals[muscle] = event.target.valueAsNumber;
  }
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

panel.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const muscle = event.target.closest('[data-muscle]')?.dataset.muscle ?? null;
  if (muscle === hoveredMuscle) return;
  hoveredMuscle = muscle;
  refresh();
});

panel.addEventListener('pointerleave', () => {
  hoveredMuscle = null;
  refresh();
});

renderPanel();
renderGoalFields();
renderExercises();
refresh();
