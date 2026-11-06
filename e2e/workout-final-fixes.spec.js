import {test,expect} from '@playwright/test';
import {login,resetWorkouts} from './workout-helper.js';

const rawLog=()=>({id:'optional-notes',logVersion:2,status:'active',name:'Legacy v2',startedAt:'2026-11-05T10:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[{id:'a',variantId:null,referenceId:null,name:'Row',equipment:null,primaryMuscles:['Lats'],secondaryMuscles:[],target:null,sets:[{id:'s1',kind:'working',weightKg:null,reps:null,rir:null,done:false}]}]});

for(const source of ['server','mirror'])for(const kind of ['exercise','set'])test(`optional v2 ${source}: opening ${kind} note first never saves undefined`,async({page})=>{
 await login(page);await resetWorkouts(page);
 const raw=rawLog();let saved=null;
 await page.route('**/api/workouts/optional-notes',async route=>{
  if(route.request().method()==='PUT'){
   const body=route.request().postDataJSON();saved=body.log;
   return route.fulfill({json:{record:{id:raw.id,revision:body.revision+1,log:saved}}});
  }
  await route.fulfill({json:{record:{id:raw.id,revision:3,log:raw}}});
 });
 if(source==='mirror'){
  await page.evaluate(log=>localStorage.setItem('gpb.activeWorkout',JSON.stringify({log,baseRevision:3,dirty:false,lastTime:null})),raw);
  await page.route('**/api/workouts/active',route=>route.abort('internetdisconnected'));
  // A fresh boot must resume the local mirror while the server is unreachable.
  await page.reload();
 }
 await page.goto('/#/workouts/optional-notes');
 await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue('Legacy v2');
 if(kind==='exercise')await page.getByRole('button',{name:'Add note, Row',exact:true}).click();
 else{
  await page.getByRole('button',{name:'Set 1 actions, Row',exact:true}).click();
  await page.getByRole('group',{name:'Set actions'}).getByRole('button',{name:'Add note',exact:true}).click();
 }
 const input=page.getByLabel(kind==='exercise'?'Note, Row':'Note, set 1, Row',{exact:true});
 await expect(input).toHaveValue('');await page.getByLabel('Workout name',{exact:true}).focus();
 // Force a subsequent ordinary save; opening/closing an empty canonical note itself need not save.
 await page.getByLabel('Workout name',{exact:true}).fill('Canonical notes');await page.getByLabel('Workout name',{exact:true}).press('Tab');
 await expect.poll(()=>saved?.name).toBe('Canonical notes');
 expect(saved.exercises[0].note).toBe('');expect(saved.exercises[0].sets[0].note).toBe('');
 expect(JSON.stringify(saved)).not.toContain('undefined');
 const mirrored=await page.evaluate(()=>JSON.parse(localStorage.getItem('gpb.activeWorkout')).log);
 expect(mirrored.exercises[0].note).toBe('');expect(mirrored.exercises[0].sets[0].note).toBe('');
});

// Mount the real logger with saved notes. Release is signalled in the same browser turn as opening,
// avoiding a race to find a control during the 200ms closing interval.
for(const action of ['unlink','remove-first','remove-second'])for(const kind of ['exercise','set'])test(`frame ${action} preserves ${kind} note node, typing and caret`,async({page})=>{
 await page.goto('/');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async()=>{
  const {mountWorkoutLogger}=await import('/src/workout-logger-view.js');
  const ex=(id,name)=>({id,variantId:null,referenceId:null,name,equipment:null,primaryMuscles:['Lats'],secondaryMuscles:[],target:null,note:'  Saved exercise  ',sets:[{id:'s'+id,kind:'working',weightKg:null,reps:8,rir:null,done:false,note:'  Saved set  '}]});
  const exercises=[ex('a','Row A'),ex('b','Row B')];exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:120};
  const root=document.createElement('div');document.body.replaceChildren(root);
  window.logger=mountWorkoutLogger(root,{api:{},log:{id:'pair',logVersion:2,status:'active',name:'Pair',startedAt:'2026-11-05T10:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises},onChange:log=>window.saved=log});
 });
 const before=await page.evaluate(({action,kind})=>{
  const frame=document.querySelector('.log-superset'),head=frame.querySelector('.log-superset-head');
  if(action==='unlink')frame.querySelector('[data-frame-action="unlink"]').click();
  else frame.querySelectorAll('[data-card-action="remove"]')[action==='remove-first'?0:1].click();
  const card=document.querySelector(`[data-exercise-id="${action==='remove-first'?'b':'a'}"]`);
  if(kind==='exercise')card.querySelector('.log-note-text').click();else card.querySelector('.log-set-note-text').click();
  const input=card.querySelector(kind==='exercise'?'.log-note-input':'.log-set-note-input');window.originalNote=input;
  input.value='  Typed note  ';input.dispatchEvent(new Event('input',{bubbles:true}));input.setSelectionRange(3,5,'backward');
  const closing={connected:frame.isConnected,inert:head.inert,closed:frame.classList.contains('is-closed')};
  head.dispatchEvent(new TransitionEvent('transitionend',{propertyName:'grid-template-rows',bubbles:true}));
  return {closing,connected:input.isConnected,focused:document.activeElement===input,inert:!!input.closest('[inert]'),range:[input.selectionStart,input.selectionEnd,input.selectionDirection],value:input.value,frame:frame.isConnected};
 },{action,kind});
 expect(before).toEqual({closing:{connected:true,inert:true,closed:true},connected:true,focused:true,inert:false,range:[3,5,'backward'],value:'  Typed note  ',frame:false});
 const input=page.locator(kind==='exercise'?'.log-note-input':'.log-set-note-input');
 await input.press('ArrowRight');await input.pressSequentially('!');
 expect(await input.evaluate(el=>el===window.originalNote)).toBe(true);
 if(kind==='set')await input.press('Enter');else await page.getByLabel('Workout name',{exact:true}).focus();
 await expect(page.locator(kind==='exercise'?'.log-note-text':'.log-set-note-text').filter({hasText:'Typ!ed note'})).toBeVisible();
 const saved=await page.evaluate(({kind,action})=>{const ex=window.saved.exercises.find(e=>e.id===(action==='remove-first'?'b':'a'));return kind==='exercise'?ex.note:ex.sets[0].note;},{kind,action});
 expect(saved).toBe('Typ!ed note');
});

for(const [width,touch] of [[390,true],[1366,false]])test(`note font and header grid align at ${width}px`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:touch,reducedMotion:'reduce'}),page=await context.newPage();
 await page.goto('/');
 await page.evaluate(async log=>{const {mountWorkoutLogger}=await import('/src/workout-logger-view.js');const root=document.createElement('div');document.body.replaceChildren(root);window.logger=mountWorkoutLogger(root,{api:{},log});},rawLog());
 await page.getByRole('button',{name:'Add note, Row',exact:true}).click();
 const geometry=await page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return [r.left,r.right,(r.left+r.right)/2];};
  return {font:parseFloat(getComputedStyle(document.querySelector('.log-note-input')).fontSize),head:[...document.querySelectorAll('.log-set-head span')].slice(0,3).map(rect),row:['.log-set-number','[data-kind="weight"]','[data-kind="reps"]'].map(s=>rect(document.querySelector(s)))};
 });
 if(touch)expect(geometry.font).toBeGreaterThanOrEqual(16);
 for(let i=0;i<3;i++)for(let edge=0;edge<3;edge++)expect(Math.abs(geometry.head[i][edge]-geometry.row[i][edge]),`track ${i} edge/center ${edge}`).toBeLessThanOrEqual(1);
 await context.close();
});
