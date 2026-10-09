import { MUSCLE_GROUPS } from './muscles.js';
import { computeVolume, volumeLevel } from './volume.js';
import { validateExercise } from './validate.js';
import { createExercise, toggleMuscle } from './exercise.js';
import { bodySvg } from './body.js';

/** The only domain state. Volume and errors are derived from it in refresh(). */
const session = { exercises: [] };

/** View state for the volume panel: the clicked muscle, and the one under the mouse. */
let selectedMuscle = null;
let hoveredMuscle = null;

const list = document.querySelector('#exercises');
const empty = document.querySelector('#empty');
const panel = document.querySelector('.panel');
const bodyMap = document.querySelector('#body-map');
const readout = document.querySelector('#readout');
const volumeList = document.querySelector('#volume');

function muscleChips(role) {
  return MUSCLE_GROUPS.map((muscle) => `
    <label class="chip"><input type="checkbox" data-role="${role}" data-muscle="${muscle}"><span>${muscle}</span></label>`).join('');
}

const CARD_HTML = `
  <div class="card-head">
    <span class="card-index"></span>
    <span class="hit-tag" data-hit-tag></span>
    <button type="button" class="icon-btn" data-action="remove" aria-label="Remove exercise">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
    </button>
  </div>
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
  <p class="error" data-error="muscles"></p>`;

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
        <span class="bar"><span class="bar-fill"></span></span>
        <span class="value"></span>
      </button>`;
    const button = item.querySelector('button');
    button.dataset.muscle = muscle;
    button.querySelector('.name').textContent = muscle;
    return item;
  }));
}

/** Rebuild the exercise list. Only on load, add and remove, so typing keeps focus. */
function renderExercises() {
  list.replaceChildren(...session.exercises.map((ex, i) => {
    const card = document.createElement('li');
    card.className = 'exercise';
    card.dataset.index = i;
    card.innerHTML = CARD_HTML;
    card.querySelector('.card-index').textContent = `Exercise ${i + 1}`;
    card.querySelector('[data-field="name"]').value = ex.name;
    card.querySelector('[data-field="sets"]').value = Number.isNaN(ex.sets) ? '' : ex.sets;
    card.querySelector('[data-field="min"]').value = Number.isNaN(ex.repRange.min) ? '' : ex.repRange.min;
    card.querySelector('[data-field="max"]').value = Number.isNaN(ex.repRange.max) ? '' : ex.repRange.max;
    return card;
  }));
  empty.hidden = session.exercises.length > 0;
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
  list.querySelectorAll('.exercise').forEach((card, i) => {
    const ex = session.exercises[i];
    const errors = validateExercise(ex);
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
  const focus = hoveredMuscle ?? selectedMuscle;
  panel.classList.toggle('has-selection', selectedMuscle !== null);
  panel.querySelectorAll('[data-muscle]').forEach((el) => {
    const { muscle } = el.dataset;
    el.dataset.level = volumeLevel(volume[muscle]);
    el.classList.toggle('is-selected', muscle === selectedMuscle);
    el.classList.toggle('is-focus', muscle === focus);
  });
  volumeList.querySelectorAll('.volume-row').forEach((row) => {
    const sets = volume[row.dataset.muscle];
    row.setAttribute('aria-pressed', String(row.dataset.muscle === selectedMuscle));
    row.querySelector('.value').textContent = String(sets);
    row.querySelector('.bar-fill').style.width = `${Math.min(sets / 10, 1) * 100}%`;
  });

  if (focus) {
    const count = session.exercises.filter((ex) =>
      ex.primaryMuscles.includes(focus) || ex.secondaryMuscles.includes(focus)).length;
    const name = document.createElement('strong');
    name.textContent = focus;
    readout.replaceChildren(name, ` ${volume[focus]} sets · ${count} exercise${count === 1 ? '' : 's'}`);
  } else {
    readout.textContent = 'Tap a muscle to highlight its exercises.';
  }
}

function indexOf(el) {
  return Number(el.closest('.exercise').dataset.index);
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
  refresh();
});

list.addEventListener('change', (event) => {
  const { role, muscle } = event.target.dataset;
  if (!role) return;
  const i = indexOf(event.target);
  session.exercises[i] = toggleMuscle(session.exercises[i], role, muscle);
  refresh();
});

list.addEventListener('click', (event) => {
  if (!event.target.closest('[data-action="remove"]')) return;
  session.exercises.splice(indexOf(event.target), 1);
  renderExercises();
  refresh();
});

document.querySelector('#add-exercise').addEventListener('click', () => {
  session.exercises.push(createExercise());
  renderExercises();
  refresh();
  list.lastElementChild.querySelector('[data-field="name"]').focus();
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
renderExercises();
refresh();
