import {actionIcon} from './action-controls.js';

export const LONG_SESSION_TOOLTIP='Longer than your max session length (Profile)';

/**
 * Non-blocking profile limit hint: warning icon plus visible text, never colour alone; never animated.
 * `source` adds visually hidden text naming where the limit is set, so keyboard, touch and screen-reader
 * users get what the mouse-only tooltip says. The visible text stays in `data-limit-text`.
 */
export function limitHint(text,{tag='span',tooltip,source}={}){
 const hint=document.createElement(tag);hint.className='limit-hint';hint.dataset.limitHint='';hint.dataset.limitText=text;
 hint.innerHTML=actionIcon('warning');hint.append(text);
 if(source){const hidden=document.createElement('span');hidden.className='visually-hidden';hidden.textContent=` (set in ${source})`;hint.append(hidden);}
 if(tooltip)hint.dataset.actionTooltip=tooltip;
 return hint;
}
