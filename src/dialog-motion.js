/** Native modal focus containment survives the closing animation. */
/** `duration` (ms, or a function read at each close) must match the closing transition in CSS. */
export function mountDialogMotion(dialog,{onClosed=()=>{},duration=150}={}){
 let timer=null,frame=null,closing=false,destroyed=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function finish(){clearTimeout(timer);timer=null;if(destroyed)return;closing=false;destroyed=true;reduced.removeEventListener('change',changed);dialog.close();dialog.remove();onClosed();}
 const changed=()=>{if(closing&&reduced.matches)finish();};reduced.addEventListener('change',changed);
 return {
  open(){if(destroyed)return;clearTimeout(timer);closing=false;dialog.inert=false;const form=dialog.querySelector('form');if(form){form.inert=false;form.removeAttribute('aria-hidden');}dialog.classList.remove('is-closing');dialog.classList.add('catalog-modal-motion');if(!dialog.open){dialog.classList.add('is-entering');dialog.showModal();getComputedStyle(dialog).opacity;frame=requestAnimationFrame(()=>dialog.classList.remove('is-entering'));}},
  close(){if(closing||destroyed)return;closing=true;cancelAnimationFrame(frame);dialog.classList.remove('is-entering');if(reduced.matches){finish();return;}dialog.tabIndex=-1;dialog.focus({preventScroll:true});const form=dialog.querySelector('form');if(form){form.inert=true;form.setAttribute('aria-hidden','true');}dialog.classList.add('is-closing');timer=setTimeout(finish,typeof duration==='function'?duration():duration);},
  destroy(){destroyed=true;clearTimeout(timer);cancelAnimationFrame(frame);reduced.removeEventListener('change',changed);if(dialog.open)dialog.close();dialog.remove();},
 };
}
