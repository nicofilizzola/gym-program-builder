import {createAnalysisController} from './analysis-controller.js';
import {mountAnalysisReport} from './analysis-report.js';
import {mountActionTooltips} from './action-controls.js';

let sequence=0;
export function mountAnalysisPanel({anchor,getWorkout,getSnapshot,scope='session',onValidationError=()=>{},request,enabled=true,dock=null}){
 const programScope=scope==='program',subject=programScope?'Program':'Session';
 const id=`analysis-${++sequence}`,fullscreen=matchMedia(dock?'(max-width: 1279px)':'(max-width: 760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const desktop=document.createElement('section');desktop.className='analysis-panel';desktop.popover='manual';desktop.setAttribute('role','region');
 const dialog=document.createElement('dialog');dialog.className='analysis-panel analysis-modal';const wide=dock??desktop;if(dock){desktop.classList.add('analysis-panel--review');dialog.classList.add('analysis-panel--review');}
 const content=document.createElement('div');content.className='analysis-content';
 content.innerHTML=`<header class="analysis-head"><div class="analysis-identity"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17V7m5 13V4m5 12V8m5 11V5"/></svg><div><h2 class="analysis-title" id="${id}-title" tabindex="-1">Session analysis</h2><p class="analysis-caption">AI-generated · Hypertrophy review</p></div></div><button type="button" class="icon-btn analysis-close" aria-label="Close session analysis" data-action-tooltip="Close session analysis"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><p class="analysis-snapshot"></p><div class="analysis-context"><p class="analysis-status" role="status" aria-live="polite"></p><span class="analysis-stale" hidden>Session changed</span></div><div class="analysis-scroll" tabindex="0" aria-label="Analysis report"><div class="analysis-report"></div></div><footer class="analysis-footer"><button type="button" class="secondary-btn analysis-run">Analyze again</button><button type="button" class="secondary-btn analysis-stop">Stop</button><button type="button" class="secondary-btn analysis-jump" aria-hidden="true" inert>Jump to latest</button></footer>`;
 for(const host of [desktop,dialog]){host.setAttribute('aria-labelledby',`${id}-title`);document.body.append(host);}
 desktop.id=id;dialog.id=`${id}-mobile`;
 const title=content.querySelector('.analysis-title'),scroll=content.querySelector('.analysis-scroll'),report=content.querySelector('.analysis-report'),status=content.querySelector('.analysis-status'),stale=content.querySelector('.analysis-stale'),snapshot=content.querySelector('.analysis-snapshot'),run=content.querySelector('.analysis-run'),stop=content.querySelector('.analysis-stop'),jump=content.querySelector('.analysis-jump'),closeButton=content.querySelector('.analysis-close');
 const renderer=mountAnalysisReport(report),tooltips=mountActionTooltips(content);
 if(dock){content.classList.add('analysis-content--review');title.textContent='AI review';content.querySelector('.analysis-caption').textContent='Hypertrophy · AI-generated';closeButton.setAttribute('aria-label','Close AI review');closeButton.dataset.actionTooltip='Close AI review';stale.textContent='Program changed';if(!dock.id)dock.id=`${id}-dock`;dock.inert=true;dock.setAttribute('aria-hidden','true');}
 let host=fullscreen.matches?dialog:wide,topRaf=null,opened=false,destroyed=false,closing=false,closeTimer=null,raf=null,follow=true,lastText='',latest=null,lastPhase='',available=enabled;
 const explanation=document.createElement('p');explanation.className='analysis-unavailable';explanation.id=`${id}-unavailable`;explanation.hidden=true;explanation.textContent='Session analysis is not configured yet.';anchor.after(explanation);
 anchor.setAttribute('aria-describedby',explanation.id);anchor.setAttribute('aria-expanded','false');
 host.append(content);
 function position(){if(dock||host!==desktop||!desktop.matches(':popover-open'))return;desktop.style.left='16px';desktop.style.top='16px';const box=anchor.getBoundingClientRect(),rect=desktop.getBoundingClientRect();const below=box.bottom+8,top=below+rect.height<=innerHeight-16?below:Math.max(16,box.top-rect.height-8);desktop.style.left=`${Math.max(16,Math.min(box.left,innerWidth-rect.width-16))}px`;desktop.style.top=`${Math.max(16,Math.min(top,innerHeight-rect.height-16))}px`;}
  function setDockTop(){topRaf=null;if(dock?.parentElement)dock.style.setProperty('--review-dock-top',`${Math.max(0,dock.parentElement.getBoundingClientRect().top)}px`);}
 function onDockScroll(){if(topRaf===null)topRaf=requestAnimationFrame(setDockTop);}
 function onDockResize(){setDockTop();}
 function setJump(){const show=!follow&&Boolean(latest?.text);jump.classList.toggle('is-visible',show);jump.inert=!show;jump.setAttribute('aria-hidden',String(!show));}
 function paint(){raf=null;if(destroyed||!latest)return;
  renderer.update(latest.text);lastText=latest.text;
  if(follow)scroll.scrollTop=scroll.scrollHeight;setJump();position();
 }
 function update(state){latest=state;const busy=['connecting','streaming'].includes(state.phase);
  if(dock)anchor.classList.toggle('is-generating',busy);else{anchor.querySelector('[data-analysis-label]').textContent=busy?'Analyzing':state.phase==='idle'?'Analyze':'View analysis';anchor.classList.toggle('is-analyzing',busy);}
  const messages={idle:'',connecting:'Preparing analysis',streaming:programScope?'Analyzing program':'Analyzing session',complete:'Analysis complete',stopped:'Stopped · Partial report is incomplete',error:state.error?.message||'Analysis interrupted'};
  if(state.phase!==lastPhase||state.phase==='error')status.textContent=messages[state.phase];lastPhase=state.phase;
  status.classList.toggle('is-working',busy);snapshot.textContent=state.snapshotName;stale.hidden=!state.stale;report.setAttribute('aria-busy',String(busy));run.textContent=state.phase==='error'?'Retry':'Analyze again';
  const replacement=busy?stop:run,retiring=busy?run:stop;replacement.hidden=false;if(document.activeElement===retiring)replacement.focus({preventScroll:true});retiring.hidden=true;
  if(state.text!==lastText&&raf===null)raf=requestAnimationFrame(paint);
  if(state.phase==='error'&&state.error?.code==='INVALID'){close();onValidationError(state.error);}
 }
 const controller=createAnalysisController({getWorkout,getSnapshot,request,onState:update});latest=controller.getState();update(latest);
 function visible(){return host===dialog?dialog.open:host===dock?dock.classList.contains('is-open'):desktop.matches(':popover-open');}
 function finishClose(){clearTimeout(closeTimer);closeTimer=null;if(opened)return;if(desktop.matches(':popover-open'))desktop.hidePopover();if(dialog.open)dialog.close();desktop.classList.remove('is-open');dialog.classList.remove('is-open');closing=false;}
 function close({restoreFocus=true}={}){if(!opened&&!closing)return;opened=false;closing=true;anchor.setAttribute('aria-expanded','false');
  // Release a modal's focus containment before restoring focus, but keep it painted for exit.
  if(dialog.open){dialog.close();desktop.append(content);host=desktop;desktop.classList.add('is-mobile-exit','is-open');desktop.showPopover();desktop.getBoundingClientRect();}
  if(restoreFocus)anchor.focus({preventScroll:true});
  host.inert=true;host.setAttribute('aria-hidden','true');host.classList.remove('is-open');tooltips.hide?.();
  clearTimeout(closeTimer);if(reduced.matches||host===dock)finishClose();else closeTimer=setTimeout(finishClose,180);
 }
 function open(){if(!available){explanation.hidden=false;return;}clearTimeout(closeTimer);closeTimer=null;opened=true;closing=false;desktop.classList.remove('is-mobile-exit');
  const target=fullscreen.matches?dialog:wide;
  if(host!==target){if(desktop.matches(':popover-open'))desktop.hidePopover();if(dialog.open)dialog.close();target.append(content);host=target;}
  host.inert=false;host.removeAttribute('aria-hidden');anchor.setAttribute('aria-controls',host.id);anchor.setAttribute('aria-expanded','true');
  if(!visible()){host.classList.remove('is-open');if(host===dialog)dialog.showModal();else if(host===desktop)desktop.showPopover();}
  if(host===dock)setDockTop();position();host.getBoundingClientRect();host.classList.add('is-open');title.focus({preventScroll:true});
  if(controller.getState().phase==='idle')controller.start();else paint();
 }
 function adapt(){if(!opened){if(closing)finishClose();return;}const active=document.activeElement,oldScroll=scroll.scrollTop;const target=fullscreen.matches?dialog:wide;if(host===target){position();return;}
  if(desktop.matches(':popover-open'))desktop.hidePopover();if(dialog.open)dialog.close();host.classList.remove('is-open');if(host===dock){dock.inert=true;dock.setAttribute('aria-hidden','true');}target.append(content);host=target;host.inert=false;host.removeAttribute('aria-hidden');anchor.setAttribute('aria-controls',host.id);if(host===dialog)dialog.showModal();else if(host===desktop)desktop.showPopover();else setDockTop();host.classList.add('is-open');scroll.scrollTop=oldScroll;position();if(content.contains(active))active.focus({preventScroll:true});else if(host===dialog)title.focus({preventScroll:true});
 }
 function onAnchor(){if(opened)close();else open();}
 function onKey(event){if(event.key!=='Escape'||!opened||event.defaultPrevented)return;const otherModal=[...document.querySelectorAll('dialog[open]')].some(node=>node!==dialog);if(otherModal)return;if(host===dock&&!content.contains(document.activeElement))return;event.preventDefault();close();}
 function onScroll(){follow=scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<=48;setJump();}
 function onWindowScroll(event){if(!content.contains(event.target))position();}
 anchor.addEventListener('click',onAnchor);closeButton.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});document.addEventListener('keydown',onKey);fullscreen.addEventListener('change',adapt);if(dock){window.addEventListener('scroll',onDockScroll,{passive:true});window.addEventListener('resize',onDockResize);}window.addEventListener('resize',position);window.addEventListener('scroll',onWindowScroll,true);scroll.addEventListener('scroll',onScroll);
 run.addEventListener('click',()=>{follow=true;controller.start();});stop.addEventListener('click',()=>controller.stop());jump.addEventListener('click',()=>{follow=true;scroll.scrollTop=scroll.scrollHeight;setJump();scroll.focus({preventScroll:true});});
 function setEnabled(value){available=value;anchor.setAttribute('aria-disabled',String(!value));explanation.textContent=value===null?'Checking analysis availability…':subject+' analysis is not configured yet.';if(value){explanation.hidden=true;anchor.removeAttribute('aria-describedby');}else anchor.setAttribute('aria-describedby',explanation.id);}
 const sizeObserver=new ResizeObserver(position);sizeObserver.observe(desktop);sizeObserver.observe(anchor);
 setEnabled(enabled);
 function dismissModal(){if(host===dialog)close({restoreFocus:false});}
 return {refresh:controller.refresh,setEnabled,close,dismissModal,destroy(){destroyed=true;sizeObserver.disconnect();controller.destroy();clearTimeout(closeTimer);cancelAnimationFrame(raf);renderer.destroy();tooltips.destroy();anchor.removeEventListener('click',onAnchor);document.removeEventListener('keydown',onKey);fullscreen.removeEventListener('change',adapt);cancelAnimationFrame(topRaf);if(dock){window.removeEventListener('scroll',onDockScroll);window.removeEventListener('resize',onDockResize);dock.replaceChildren();dock.classList.remove('is-open');dock.inert=false;dock.removeAttribute('aria-hidden');dock.style.removeProperty('--review-dock-top');}window.removeEventListener('resize',position);window.removeEventListener('scroll',onWindowScroll,true);if(dialog.open)dialog.close();desktop.remove();dialog.remove();explanation.remove();}};
}
