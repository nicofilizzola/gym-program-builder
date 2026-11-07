import {actionIcon} from './action-controls.js';
import {workoutCover} from './workout-cover.js';
import {recommendationTiming} from './workout-up-next.js';
import {durationLabel} from './duration.js';

const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
export function mountWorkoutHome(root,{state,onStart,onResume,onChoose,onSetup,onRetry}){
 const page=document.createElement('main');page.className='workout-home';
 page.innerHTML=`<header class="home-heading"><h1>Your training</h1><p data-today></p></header>
 <section class="home-cover" aria-labelledby="home-session-title">
 <img class="home-cover-image" alt=""><p class="home-program" data-program></p>
 <div class="home-cover-content"><p class="home-timing"><time data-timing></time></p><h2 id="home-session-title"></h2>
 <p class="home-meta" data-meta></p><div class="home-progress"><p data-progress></p><progress aria-label="Working sets completed"></progress></div>
 <p class="home-hint" data-hint></p><button type="button" class="add-btn home-start"><span data-primary-label></span></button></div></section>
 <button type="button" class="home-alternative">Choose another workout</button>
 <div class="home-feedback"><p role="status" data-status></p><p role="alert" class="error" data-error></p>
 <button type="button" class="secondary-btn" data-retry>Retry</button><button type="button" class="secondary-btn" data-setup></button></div>`;
 root.append(page);const $=selector=>page.querySelector(selector),events=new AbortController();
 const primary=$('.home-start'),alternative=$('.home-alternative'),image=$('img'),program=$('[data-program]'),timing=$('[data-timing]'),title=$('h2'),meta=$('[data-meta]'),progress=$('.home-progress'),track=$('progress'),hint=$('[data-hint]'),status=$('[data-status]'),error=$('[data-error]'),retry=$('[data-retry]'),setup=$('[data-setup]');
 let current=state,coverId=null;
 primary.insertAdjacentHTML('afterbegin',actionIcon('start'));
 primary.addEventListener('click',()=>current.kind==='resume'?onResume():current.kind==='recommendation'?onStart():onChoose(),{signal:events.signal});
 alternative.addEventListener('click',()=>onChoose(),{signal:events.signal});
 retry.addEventListener('click',()=>onRetry(),{signal:events.signal});
 setup.addEventListener('click',()=>onSetup(current.setupAction),{signal:events.signal});
 image.addEventListener('error',()=>{image.hidden=true;},{signal:events.signal});
 const shell=document.querySelector('.app-header');
 const size=()=>page.style.setProperty('--home-shell-height',(shell?.getBoundingClientRect().height||0)+'px');
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(size):null;if(shell)observer?.observe(shell);size();
 function update(value){
  current=value;
  const resume=value.kind==='resume',recommended=value.kind==='recommendation',loading=value.kind==='loading';
  const workout=resume?value.activeLog:recommended?value.recommendation.workout:null;
  const cover=workoutCover(workout?.coverId);
  if(coverId!==cover.id){coverId=cover.id;image.hidden=false;image.width=cover.width;image.height=cover.height;image.style.objectPosition=cover.objectPosition;image.src=cover.src;}
  text($('[data-today]'),value.today.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}));
  const programName=resume?workout.source?.programName:value.program?.name;
  text(program,programName||'');program.hidden=!programName;
  const when=resume?{text:'Workout in progress',date:null}:recommended?recommendationTiming(value.recommendation.next,value.today):{text:'',date:null};
  text(timing,when.text);timing.parentElement.hidden=!when.text;
  if(when.date)timing.dateTime=when.date;else timing.removeAttribute('datetime');
  text(title,workout?.name?.trim()||(loading?'Finding your next workout…':value.kind==='error'?"Couldn't load your next workout":value.program?'No scheduled sessions':'Choose a workout'));
  text(meta,recommended?`${durationLabel(workout)} · ${workout.exercises.length} ${workout.exercises.length===1?'exercise':'exercises'}`:'');meta.hidden=!recommended;
  progress.hidden=!resume;
  if(resume){
   const sets=workout.exercises.flatMap(ex=>ex.sets).filter(set=>set.kind!=='warmup'),done=sets.filter(set=>set.done).length;
   text($('[data-progress]'),sets.length?`${done} of ${sets.length} working sets completed`:'No working sets yet');
   track.hidden=!sets.length;track.max=sets.length||1;track.value=done;
  }
  const explanation=!workout&&!loading?(value.kind==='error'?'Choose a workout or try again.':value.program?'Choose any session to train now.':value.setupAction==='programs'?'Start with a template or a blank workout.':'Choose a session, or set an active program for recommendations.'):'';
  text(hint,explanation);hint.hidden=!explanation;
  text($('[data-primary-label]'),value.starting?'Starting…':resume?'Resume workout':recommended?'Start workout':'Choose a workout');
  primary.hidden=loading;primary.disabled=value.starting||(recommended&&!value.canStart);primary.setAttribute('aria-busy',String(value.starting));
  alternative.hidden=!workout&&!loading;alternative.disabled=value.starting;
  text(status,loading?'Finding your next workout…':value.refreshing&&!resume?'Updating your next workout…':'');status.hidden=!status.textContent;
  text(error,value.error||'');error.hidden=!value.error;retry.hidden=!value.error;retry.disabled=value.refreshing||value.starting;
  setup.hidden=!value.setupAction;setup.disabled=value.starting;
  text(setup,{'set-active':'Set active program',programs:'Go to Programs','open-program':'Open program'}[value.setupAction]||'');
  $('.home-feedback').hidden=!value.error&&!value.setupAction&&!status.textContent;
 }
 update(state);
 return {update,destroy(){events.abort();observer?.disconnect();page.remove();}};
}
