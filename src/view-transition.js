/** One opacity lifecycle; cancel always settles promises and removes animation effects. */
export function createViewTransition(root) {
 let generation=0,animation=null,destroyed=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 async function fade(from,to,duration) {
  const owned=root.animate([{opacity:from},{opacity:to}],{duration,easing:'ease-out',fill:'both'});
  animation=owned;
  try{await owned.finished;}catch{/* Cancellation is an expected navigation outcome. */}
  return owned;
 }
 function cancel(){generation++;animation?.cancel();animation=null;}
 return {
  cancel,destroy(){cancel();destroyed=true;},
  async swap(commit,{focus}={}) {
   cancel();const version=generation;if(destroyed)return false;
   if(reduced.matches){commit();focus?.();return true;}
   try{
    if(root.childElementCount){await fade(1,0,75);if(version!==generation||destroyed)return false;}
    animation?.cancel();commit();
    const entrance=fade(0,1,100);await entrance;
    if(version!==generation||destroyed)return false;
    animation?.cancel();animation=null;focus?.();return true;
   }catch(error){if(version===generation){animation?.cancel();animation=null;}throw error;}
  }
 };
}
