/** Visual interpolation only: native ranges remain the source of values and interaction. */
const owners=new WeakMap();
export function mountSliderPresentation(root){
 const states=new Map(),events=new AbortController(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,disposed=false;const touched=new Set();
 const values=inputs=>inputs.map(input=>(input.valueAsNumber-Number(input.min))/(Number(input.max)-Number(input.min)));
 function draw(state){
  const {slider,current,thumbs}=state;
  slider.style.setProperty('--visual-from',current.length===2?current[0]:0);
  slider.style.setProperty('--visual-to',current.at(-1));
  thumbs.forEach((thumb,i)=>{thumb.style.left=`calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${current[i]})`;});
 }
 function tick(now){
  frame=0;let moving=false;
  for(const state of states.values())if(state.start!==null){
   const progress=Math.min(1,Math.max(0,(now-state.start)/80)),ease=1-(1-progress)**3;
   state.current=state.target.map((v,i)=>state.from[i]+(v-state.from[i])*ease);draw(state);
   if(progress===1)state.start=null;else moving=true;
  }
  if(moving)frame=requestAnimationFrame(tick);
 }
 function sync(){
  if(disposed)return;
  for(const [slider,state] of states)if(!root.contains(slider)){for(const thumb of state.thumbs)thumb.remove();slider.classList.remove('has-slider-presentation');owners.delete(slider);states.delete(slider);}
  for(const slider of root.querySelectorAll('.slider')){
   if(owners.has(slider)&&owners.get(slider)!==states)continue;
   const inputs=[...slider.querySelectorAll('input[type="range"]')];if(!inputs.length)continue;
   const target=values(inputs);let state=states.get(slider);
   if(!state){
    const thumbs=inputs.map((input,i)=>{const thumb=document.createElement('span');thumb.className='slider-thumb';thumb.setAttribute('aria-hidden','true');thumb.dataset.thumb=String(i);slider.append(thumb);return thumb;});
    state={slider,inputs,thumbs,current:target,target,from:target,start:null};states.set(slider,state);owners.set(slider,states);slider.classList.add('has-slider-presentation');draw(state);
   }else if(target.some((v,i)=>v!==state.target[i])){
    state.from=[...state.current];state.target=target;
    if(touched.has(slider)&&!motion.matches){state.start=performance.now();if(!frame)frame=requestAnimationFrame(tick);}
    else{state.current=target;state.start=null;draw(state);}
   }
   inputs.forEach((input,i)=>{const thumb=state.thumbs[i];thumb.classList.toggle('is-focused',input===document.activeElement&&input.matches(':focus-visible'));thumb.classList.toggle('is-top',input.classList.contains('is-top'));});
  }
 }
 root.addEventListener('input',event=>{
  if(!event.target.matches('input[type="range"]'))return;
  const slider=event.target.closest('.slider');if(owners.get(slider)!==states)return;
  touched.add(slider);queueMicrotask(()=>{sync();touched.delete(slider);});
 },{capture:true,signal:events.signal});
 for(const name of ['focusin','focusout','pointerdown'])root.addEventListener(name,()=>queueMicrotask(sync),{signal:events.signal});
 motion.addEventListener('change',()=>{if(motion.matches){cancelAnimationFrame(frame);frame=0;for(const state of states.values()){state.current=[...state.target];state.start=null;draw(state);}}},{signal:events.signal});
 sync();
 return {sync,destroy(){disposed=true;events.abort();cancelAnimationFrame(frame);for(const [slider,state]of states){state.thumbs.forEach(thumb=>thumb.remove());slider.classList.remove('has-slider-presentation');slider.style.removeProperty('--visual-from');slider.style.removeProperty('--visual-to');owners.delete(slider);}states.clear();}};
}
