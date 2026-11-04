import {actionIcon} from './action-controls.js';

export const LONG_SESSION_TOOLTIP='Longer than your max session length (Profile)';

/** Non-blocking profile limit hint: warning icon plus visible text, never colour alone; never animated. */
export function limitHint(text,{tag='span',tooltip}={}){
 const hint=document.createElement(tag);hint.className='limit-hint';hint.dataset.limitHint='';
 hint.innerHTML=actionIcon('warning');hint.append(text);
 if(tooltip)hint.dataset.actionTooltip=tooltip;
 return hint;
}
