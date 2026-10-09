import { MUSCLE_GROUPS } from './muscles.js';
import { computeVolume } from './volume.js';
import { validateExercise, validateSessionName } from './validate.js';
import { createExercise, toggleMuscle } from './exercise.js';

/** The only state. Volume and errors are derived from it in refresh(). */
const session ={ name: '', exercises: [] };

const nameInput = document.querySelector('#session-name');
const nameError = document.querySelector('#session-name-error');
const list = document.querySelector('#exercises');
const volumeBody = document.querySelector('#volume');

function muscleCheckboxes(role) {
  return MUSCLE_GROUPS.map((muscle) => `
    <label><input type="checkbox" data-role="${role}" data-muscle="${muscle}"> ${muscle}</label>`).join('');
}

const CARD_HTML = `
  <div class="row">
    <label class="field">Exercise name <input type="text" data-field="name"></label>
    <button type="button" data-action="remove">Remove</button>
  </div>
  <p class="error" data-error="name"></p>
  <div class="row">
    <label class="field">Sets <input type="number" min="1" step="1" data-field="sets"></label>
    <label class="field">Reps min <input type="number" min="1" step="1" data-field="min"></label>
    <label class="field">Reps max <input type="number" min="1" step="1" data-field="max"></label>
  </div>
  <p class="error" data-error="sets"></p>
  <p class="error" data-error="repRange"></p>
  <fieldset><legend>Primary</legend>${muscleCheckboxes('primary')}</fieldset>
  <fieldset><legend>Secondary</legend>${muscleCheckboxes('secondary')}</fieldset>
  <p class="error" data-error="muscles"></p>`;

/** Rebuild the exercise list. Only on load, add and remove, so typing keeps focus. */
function renderExercises() {
  list.replaceChildren(...session.exercises.map((ex, i) => {
    const card = document.createElement('li');
    card.className = 'exercise';
    card.dataset.index = i;
    card.innerHTML = CARD_HTML;
    card.querySelector('[data-field="name"]').value = ex.name;
    card.querySelector('[data-field="sets"]').value = Number.isNaN(ex.sets) ? '' : ex.sets;
    card.querySelector('[data-field="min"]').value = Number.isNaN(ex.repRange.min) ? '' : ex.repRange.min;
    card.querySelector('[data-field="max"]').value = Number.isNaN(ex.repRange.max) ? '' : ex.repRange.max;
    return card;
  }));
}

/** Update everything derived from state without recreating inputs. */
function refresh() {
  nameError.textContent = validateSessionName(session.name) ?? '';

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
  });

  const volume = computeVolume(session);
  volumeBody.replaceChildren(...MUSCLE_GROUPS.map((muscle) => {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    const value = document.createElement('td');
    name.textContent = muscle;
    value.textContent = String(volume[muscle]);
    row.append(name, value);
    return row;
  }));
}

function indexOf(el) {
  return Number(el.closest('.exercise').dataset.index);
}

nameInput.addEventListener('input', () => {
  session.name = nameInput.value;
  refresh();
});

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
  if (event.target.dataset.action !== 'remove') return;
  session.exercises.splice(indexOf(event.target), 1);
  renderExercises();
  refresh();
});

document.querySelector('#add-exercise').addEventListener('click', () => {
  session.exercises.push(createExercise());
  renderExercises();
  refresh();
});

renderExercises();
refresh();
