import {mountDialogMotion} from './dialog-motion.js';

let active=false;
let cancelActive;

/** Authentication can interrupt any view without discarding its dirty draft. */
export function cancelActiveConfirmation(){cancelActive?.();}

/** Ask once; callers still own revision checks and cancellation on view teardown. */
export function confirmAction({title,message,confirmLabel,destructive=false,signal,returnFocus}={}){
 if(active||signal?.aborted)return Promise.resolve(false);
 active=true;
 const invoker=document.activeElement,dialog=document.createElement('dialog');
 dialog.className='catalog-dialog confirm-dialog';
 const id='confirm-'+crypto.randomUUID();
 dialog.setAttribute('aria-labelledby',id);dialog.setAttribute('aria-describedby',id+'-message');
 const form=document.createElement('form'),heading=document.createElement('h2'),description=document.createElement('p'),actions=document.createElement('div');
 heading.id=id;heading.textContent=title;description.id=id+'-message';description.textContent=message;description.className='confirm-message';actions.className='catalog-form-actions';
 const cancel=document.createElement('button'),confirm=document.createElement('button');
 cancel.type='button';cancel.className='secondary-btn';cancel.textContent='Cancel';cancel.autofocus=true;cancel.dataset.confirmCancel='';
 confirm.type='submit';confirm.className=destructive?'secondary-btn confirm-destructive':'add-btn';confirm.textContent=confirmLabel;confirm.dataset.confirmAccept='';
 actions.append(cancel,confirm);form.append(heading,description,actions);dialog.append(form);document.body.append(dialog);
 return new Promise(resolve=>{
  let decision=false,closing=false,settled=false;
  const finish=()=>{
   if(settled)return;settled=true;active=false;cancelActive=undefined;signal?.removeEventListener('abort',abort);
   const openDialog=document.querySelector('dialog[open]');
   const target=[typeof returnFocus==='function'?returnFocus():returnFocus,invoker].find(node=>node instanceof HTMLElement&&node.isConnected&&!node.closest('[inert],[hidden]')&&!node.matches(':disabled')&&node.getClientRects().length&&(!openDialog||node.closest('dialog[open]')));
   target?.focus({preventScroll:true});
   resolve(decision);
  };
  const motion=mountDialogMotion(dialog,{onClosed:finish});
  const choose=value=>{if(closing||settled)return;decision=value;closing=true;motion.close();};
  const abort=()=>{decision=false;motion.destroy();finish();};
  cancelActive=abort;
  cancel.onclick=()=>choose(false);form.onsubmit=event=>{event.preventDefault();choose(true);};
  dialog.addEventListener('cancel',event=>{event.preventDefault();choose(false);});
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab'||closing)return;if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();confirm.focus();}else if(!event.shiftKey&&document.activeElement===confirm){event.preventDefault();cancel.focus();}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)choose(false);});
  signal?.addEventListener('abort',abort,{once:true});motion.open();cancel.focus();
 });
}
