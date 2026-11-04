import { actionIcon } from './action-controls.js';
import { DURATION_LIMITS, formatDuration } from './duration.js';

// Markup and display sync for a superset frame in the session editor. The editor owns all state and events;
// this module only builds the frame and mirrors a pair's `superset` settings into it.

const range = ({ min, max, step }) => `min="${min}" max="${max}" step="${step}"`;
const SLIDERS = [['restBetweenSeconds', 'Rest between exercises'], ['restAfterRoundSeconds', 'Rest after round']];
let nextId = 0;

/** `30 sec between · 3 min after round` */
export const supersetSummary = ({ restBetweenSeconds, restAfterRoundSeconds }) =>
  `${formatDuration(restBetweenSeconds)} between · ${formatDuration(restAfterRoundSeconds)} after round`;

/**
 * Build an empty frame: `li.superset` > header wrapper (`.superset-frame-head` > `.superset-head` + settings)
 * and `ol.superset-members`, which the editor fills with the two member cards.
 */
export function createSupersetFrame() {
  const settingsId = `superset-settings-${++nextId}`;
  const frame = document.createElement('li');
  frame.className = 'superset';
  frame.innerHTML = `
  <div class="collapsible superset-frame-head" data-collapse="frame"><div class="superset-frame-inner">
    <div class="superset-head">
      <p class="superset-title"><strong class="superset-label">Superset</strong> <span class="superset-summary" data-superset-summary></span></p>
      <div class="superset-actions">
        <button type="button" class="action-button" data-superset-action="settings" aria-expanded="false" aria-controls="${settingsId}" aria-label="Superset rest settings" data-action-tooltip="Superset rest settings">${actionIcon('settings')}</button>
        <button type="button" class="action-button" data-superset-action="swap" aria-label="Swap exercises" data-action-tooltip="Swap exercises">${actionIcon('swap')}</button>
        <button type="button" class="action-button reorder-action" aria-label="Reorder superset" aria-describedby="reorder-hint" aria-expanded="false" data-action-tooltip="Reorder superset">${actionIcon('reorder')}</button>
        <button type="button" class="action-button" data-superset-action="unlink" aria-label="Unlink superset" data-action-tooltip="Unlink superset">${actionIcon('unlink')}</button>
      </div>
    </div>
    <div class="collapsible superset-settings is-closed" id="${settingsId}" data-collapse="settings" inert aria-hidden="true"><div class="superset-settings-body">
      ${SLIDERS.map(([field, label]) => `
      <div class="slider-field">
        <div class="slider-head"><span>${label}</span><span class="slider-value" data-superset-value="${field}" aria-hidden="true"></span></div>
        <div class="slider"><span class="slider-fill"></span>
          <input type="range" ${range(DURATION_LIMITS[field])} data-superset-field="${field}" aria-label="${label}"></div>
      </div>`).join('')}
    </div></div>
  </div></div>
  <ol class="superset-members"></ol>`;
  return frame;
}

/** Mirror a pair's settings into its frame: summary, slider values, value texts and fills. */
export function syncSupersetFrame(frame, superset) {
  frame.querySelector('[data-superset-summary]').textContent = supersetSummary(superset);
  for (const [field] of SLIDERS) {
    const value = superset[field];
    const { min, max } = DURATION_LIMITS[field];
    const input = frame.querySelector(`[data-superset-field="${field}"]`);
    if (input.valueAsNumber !== value) input.value = value;
    input.setAttribute('aria-valuetext', formatDuration(value));
    frame.querySelector(`[data-superset-value="${field}"]`).textContent = formatDuration(value);
    input.parentElement.style.setProperty('--from', 0);
    input.parentElement.style.setProperty('--to', (value - min) / (max - min));
  }
}
