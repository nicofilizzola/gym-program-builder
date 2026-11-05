const TEXT_FIELD='input:not([type=range],[type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=file],[type=color]),textarea,[contenteditable]:not([contenteditable=false])';

/**
 * Marks `body.is-typing` while a text field inside `root` has focus (CSS hides the phone tab bar).
 * Leaving the field during a tap restores the bars only after that tap's click, so a returning bar never takes it.
 */
export function mountTypingState(root,{body=document.body}={}){
 let pointerDown=false,pending=false;
 const typing=()=>root.contains(document.activeElement)&&document.activeElement.matches(TEXT_FIELD);
 const apply=()=>{pending=false;body.classList.toggle('is-typing',typing());};
 // Entering a field hides the bars at once; leaving waits for an in-flight tap to finish.
 const sync=()=>{if(pointerDown&&!typing())pending=true;else apply();};
 const onDown=()=>{pointerDown=true;};
 const onUp=()=>{pointerDown=false;if(pending)setTimeout(apply,0);};
 const onFocusOut=()=>queueMicrotask(sync);
 document.addEventListener('pointerdown',onDown,true);
 document.addEventListener('pointerup',onUp,true);
 document.addEventListener('pointercancel',onUp,true);
 document.addEventListener('focusin',sync,true);
 document.addEventListener('focusout',onFocusOut,true);
 apply();
 return {destroy(){for(const [type,fn] of [['pointerdown',onDown],['pointerup',onUp],['pointercancel',onUp],['focusin',sync],['focusout',onFocusOut]])document.removeEventListener(type,fn,true);body.classList.remove('is-typing');}};
}
