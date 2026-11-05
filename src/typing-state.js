const TEXT_FIELD='input:not([type=range],[type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=file],[type=color]),textarea,[contenteditable]:not([contenteditable=false])';
// A focus counts as the user's when it follows their press on that field, or a key press, within this window.
const USER_WINDOW=1000;
// After a tap leaves a field, the bars wait for that tap's click (or this long) before returning.
const TAP_GRACE=700;

/**
 * Marks `body.is-typing` while the user is typing in a text field inside `root` (CSS hides the phone tab bar).
 * Script focus (route changes, new rows) never enters the state, so the bars never vanish without a keyboard.
 * Leaving a field by tapping restores the bars only after that tap's click, so a returning bar never takes it,
 * whatever order the browser fires touch, pointer, mouse and focus events in.
 */
export function mountTypingState(root,{body=document.body}={}){
 let pressTarget=null,pressAt=-Infinity,keyAt=-Infinity,pending=false,timer=null;
 const now=()=>performance.now();
 const isField=el=>Boolean(el&&root.contains(el)&&el.matches?.(TEXT_FIELD));
 const pressedOn=el=>now()-pressAt<USER_WINDOW&&pressTarget&&(el===pressTarget||el.contains(pressTarget)||pressTarget.closest?.('label')?.control===el);
 const typing=()=>body.classList.contains('is-typing');
 const restore=()=>{pending=false;clearTimeout(timer);timer=null;body.classList.toggle('is-typing',typing()&&isField(document.activeElement));};
 function leave(){
  if(!typing()||isField(document.activeElement))return;
  if(now()-pressAt>=TAP_GRACE){restore();return;}
  if(!pending){pending=true;timer=setTimeout(restore,TAP_GRACE);}
 }
 // Tapping the field that already has focus (no focusin) brings the keyboard up too.
 const onPress=event=>{pressTarget=event.target;pressAt=now();if(isField(document.activeElement)&&pressedOn(document.activeElement)){pending=false;clearTimeout(timer);body.classList.add('is-typing');}};
 const onKey=()=>{keyAt=now();};
 const onFocusIn=event=>{
  if(!isField(event.target)){leave();return;}
  // Moving between fields keeps the keyboard; entering needs the user's own press or key.
  if(typing()||pressedOn(event.target)||now()-keyAt<USER_WINDOW){pending=false;clearTimeout(timer);body.classList.add('is-typing');}
 };
 const onFocusOut=()=>queueMicrotask(leave);
 const onClick=()=>{if(pending)setTimeout(restore,0);};
 const listeners=[['pointerdown',onPress],['keydown',onKey],['focusin',onFocusIn],['focusout',onFocusOut],['click',onClick]];
 for(const [type,fn] of listeners)document.addEventListener(type,fn,true);
 return {destroy(){for(const [type,fn] of listeners)document.removeEventListener(type,fn,true);clearTimeout(timer);body.classList.remove('is-typing');}};
}
