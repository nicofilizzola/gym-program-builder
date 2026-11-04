import {mountDialogMotion} from './dialog-motion.js';

let active=false;
let cancelActive;

/** Authentication can interrupt any view without discarding its dirty draft. */
export function cancelActiveConfirmation(){cancelActive?.();}

/** Ask once; callers still own revision checks and cancellation on view teardown. */
export function confirmAction({title,message,confirmLabel,destructive=false,signal,returnFocus}={}){
 return ask({title,message,signal,returnFocus,cancelValue:false,choices:[{value:true,label:confirmLabel,destructive,primary:!destructive,submit:true}]});
}

/** Same dialog with several choices; resolves the chosen value, or null on Cancel, Escape, backdrop or abort. */
export function chooseAction({title,message,choices,signal,returnFocus}={}){
 return ask({title,message,signal,returnFocus,cancelValue:null,choices});
}

function ask({title,message,choices,signal,returnFocus,cancelValue}){
 if(active||signal?.aborted)return Promise.resolve(cancelValue);
 active=true;
 const invoker=document.activeElement,dialog=document.createElement('dialog');
 dialog.className='catalog-dialog confirm-dialog';
 const id='confirm-'+crypto.randomUUID();
 dialog.setAttribute('aria-labelledby',id);dialog.setAttribute('aria-describedby',id+'-message');
 const form=document.createElement('form'),heading=document.createElement('h2'),description=document.createElement('p'),actions=document.createElement('div');
 heading.id=id;heading.textContent=title;description.id=id+'-message';description.textContent=message;description.className='confirm-message';actions.className='catalog-form-actions';
 const cancel=document.createElement('button');
 cancel.type='button';cancel.className='secondary-btn';cancel.textContent='Cancel';cancel.autofocus=true;cancel.dataset.confirmCancel='';
 const buttons=choices.map(choice=>{
  const button=document.createElement('button');
  button.type=choice.submit?'submit':'button';button.className=choice.destructive?'secondary-btn confirm-destructive':choice.primary?'add-btn':'secondary-btn';button.textContent=choice.label;
  if(choice.submit)button.dataset.confirmAccept='';else button.dataset.choice='';
  return button;
 });
 actions.append(cancel,...buttons);form.append(heading,description,actions);dialog.append(form);document.body.append(dialog);
 const lastButton=buttons.at(-1);
 return new Promise(resolve=>{
  let decision=cancelValue,closing=false,settled=false;
  const finish=()=>{
   if(settled)return;settled=true;active=false;cancelActive=undefined;signal?.removeEventListener('abort',abort);
   const openDialog=document.querySelector('dialog[open]');
   const target=[typeof returnFocus==='function'?returnFocus():returnFocus,invoker].find(node=>node instanceof HTMLElement&&node.isConnected&&!node.closest('[inert],[hidden]')&&!node.matches(':disabled')&&node.getClientRects().length&&(!openDialog||node.closest('dialog[open]')));
   target?.focus({preventScroll:true});
   resolve(decision);
  };
  const motion=mountDialogMotion(dialog,{onClosed:finish});
  const choose=value=>{if(closing||settled)return;decision=value;closing=true;motion.close();};
  const abort=()=>{decision=cancelValue;motion.destroy();finish();};
  cancelActive=abort;
  cancel.onclick=()=>choose(cancelValue);
  buttons.forEach((button,index)=>{if(!choices[index].submit)button.onclick=()=>choose(choices[index].value);});
  form.onsubmit=event=>{event.preventDefault();const accept=choices.find(choice=>choice.submit);if(accept)choose(accept.value);};
  dialog.addEventListener('cancel',event=>{event.preventDefault();choose(cancelValue);});
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab'||closing)return;if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();lastButton.focus();}else if(!event.shiftKey&&document.activeElement===lastButton){event.preventDefault();cancel.focus();}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)choose(cancelValue);});
  signal?.addEventListener('abort',abort,{once:true});motion.open();cancel.focus();
 });
}
