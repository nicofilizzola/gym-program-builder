import {actionIcon} from './action-controls.js';
import {supersetSummary} from './superset-frame.js';

/** Frame for a logged superset pair: `li.log-superset` > `.log-superset-head` (collapsible) + `ol.log-superset-members`. */
export function createLogSupersetFrame({editable}){
 const li=document.createElement('li');li.className='log-superset';
 li.innerHTML=`<div class="collapsible log-superset-head"><div class="superset-head">
  <p class="superset-title"><strong class="superset-label">Superset</strong><span class="superset-summary"></span></p>
  <div class="superset-actions"><button type="button" class="action-button reorder-action" data-frame-action="reorder" aria-label="Reorder superset" aria-expanded="false" data-action-tooltip="Reorder superset">${actionIcon('reorder')}</button><button type="button" class="action-button" data-frame-action="unlink" aria-label="Unlink superset" data-action-tooltip="Unlink superset">${actionIcon('unlink')}</button></div>
 </div></div><ol class="log-superset-members"></ol>`;
 const actions=li.querySelector('.superset-actions');actions.hidden=!editable;
 return {li,head:li.firstElementChild,members:li.lastElementChild,actions,summary:li.querySelector('.superset-summary'),reorder:li.querySelector('[data-frame-action="reorder"]'),unlink:li.querySelector('[data-frame-action="unlink"]')};
}

export const syncLogSupersetFrame=(frame,superset)=>{frame.summary.textContent=` · ${supersetSummary(superset)}`;};
