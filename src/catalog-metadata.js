import {tooltipPosition} from './tooltip.js';

export function renderVariantMetadata(root,{equipment,brand,focusTags=[]}={}){
 root.replaceChildren();root.classList.add('variant-metadata');
 const add=(value,tag=false)=>{if(!value)return;const span=document.createElement('span');span.className=tag?'variant-tag':'catalog-meta';span.textContent=value;root.append(span);};
 add(equipment);add((typeof brand==='string'?brand:brand?.name)?'Brand: '+(typeof brand==='string'?brand:brand.name):'',true);
 for(const focus of focusTags){const name=typeof focus==='string'?focus:focus?.name;if(name)add('Focus: '+name,true);}
 root.hidden=!root.childElementCount;
}
let activeInfo=null;
export function mountExerciseInfo(button,{getDescriptions}){
 const tip=document.createElement('div');tip.id='exercise-info-'+crypto.randomUUID();tip.className='info-tip exercise-info-tip';tip.setAttribute('popover','manual');tip.setAttribute('role','tooltip');document.body.append(tip);
 button.setAttribute('aria-controls',tip.id);button.setAttribute('aria-describedby',tip.id);button.setAttribute('aria-expanded','false');
 const events=new AbortController(),options={signal:events.signal};let pinned=false,opened=false,hideTimer,descriptionsFingerprint,frame,positionReady=true;
 function render(){
  const value=getDescriptions();button.setAttribute('aria-label','About '+(value.name||'exercise'));button.hidden=!value.referenceDescription&&!value.variantDescription;const fingerprint=JSON.stringify([value.referenceDescription,value.variantDescription]);if(fingerprint===descriptionsFingerprint)return;descriptionsFingerprint=fingerprint;tip.replaceChildren();
  for(const [label,text]of [['Reference exercise',value.referenceDescription],['Variant',value.variantDescription]])if(text){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(text));tip.append(p);}
 }
 function position(){
  const anchor=button.getBoundingClientRect(),below=innerHeight-8-anchor.bottom-6,above=anchor.top-6-8;
  // Long descriptions scroll on the roomier side instead of covering their own trigger.
  tip.style.maxHeight=Math.max(0,Math.max(below,above))+'px';
  const r=tooltipPosition(anchor,tip.getBoundingClientRect(),{width:innerWidth,height:innerHeight});tip.style.left=r.left+'px';tip.style.top=r.top+'px';tip.dataset.placement=r.placement;
 }
 function hide(){
  clearTimeout(hideTimer);cancelAnimationFrame(frame);if(tip.contains(document.activeElement)&&button.isConnected)button.focus({preventScroll:true});opened=false;pinned=false;button.setAttribute('aria-expanded','false');tip.inert=true;tip.setAttribute('aria-hidden','true');if(tip.matches(':popover-open'))tip.hidePopover();if(activeInfo===controller)activeInfo=null;
 }
 function show(pin=false){
  clearTimeout(hideTimer);render();if(button.hidden)return;
  if(activeInfo!==controller)activeInfo?.hide();activeInfo=controller;pinned=pinned||pin;tip.inert=false;tip.removeAttribute('aria-hidden');
  if(!opened){tip.classList.add('is-measuring');position();getComputedStyle(tip).translate;tip.classList.remove('is-measuring');tip.showPopover();opened=true;positionReady=false;frame=requestAnimationFrame(()=>{if(opened){position();positionReady=true;}});}else position();button.setAttribute('aria-expanded','true');
 }
 const peek=e=>{if(e.pointerType==='mouse')show();};
 const depart=()=>{clearTimeout(hideTimer);if(opened&&!pinned&&document.activeElement!==button)hideTimer=setTimeout(hide,150);};
 button.addEventListener('pointerenter',peek,options);button.addEventListener('pointerleave',depart,options);
 tip.addEventListener('pointerenter',()=>clearTimeout(hideTimer),options);tip.addEventListener('pointerleave',depart,options);
 button.addEventListener('focus',()=>show(),options);button.addEventListener('blur',()=>{if(!pinned)hide();},options);
 button.addEventListener('click',()=>{if(opened&&pinned)hide();else show(true);},options);
 document.addEventListener('pointerdown',e=>{if(opened&&!button.contains(e.target)&&!tip.contains(e.target))hide();},options);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();e.stopImmediatePropagation();hide();}}, {...options,capture:true});
 document.addEventListener('scroll',e=>{if(opened&&!tip.contains(e.target)){if(positionReady)hide();else position();}},{...options,capture:true});window.addEventListener('resize',hide,options);
 document.addEventListener('gym-info-open',()=>hide(),options);
 const controller={hide,update(){render();if(button.hidden)hide();else if(opened)position();},destroy(){hide();events.abort();tip.remove();}};render();return controller;
}
