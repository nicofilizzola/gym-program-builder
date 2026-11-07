import {confirmAction,cancelActiveConfirmation} from './confirm-dialog.js';
import {duplicateName} from './duplicate-name.js';
import {hasProgramContext} from './program-context.js';
import {mountBreadcrumbs} from './breadcrumbs.js';
import {createWorkoutStartLauncher} from './workout-start-launcher.js';
import {resolveProgram,programArrangement} from './program-links.js';
import {createSharedSessionController} from './shared-session-controller.js';
import {parseDocumentBundle,serializeDocumentBundle} from './document-bundle.js';
import {mountTagView} from './tag-view.js';
import {createViewTransition} from './view-transition.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {createApiClient} from './api-client.js';
import {createAutosave} from './autosave.js';
import {createTemplate,createProgram,duplicateProgram} from './program.js';
import {parseRoute} from './router.js';
import {mountLibrary} from './library-view.js';
import {mountSessionEditor} from './session-editor.js';
import {mountCatalog} from './catalog-view.js';
import {mountProfileView} from './profile-view.js';
import {normalizeProfile} from './profile.js';
import {mountWorkoutHistory} from './workout-history-view.js';
import {openWorkoutStartSheet} from './workout-start-sheet.js';
import {readMirror,isNetworkError} from './workout-sync.js';
import {mountWorkoutLogger} from './workout-logger-view.js';
import {createWorkoutController,linkedVariantIds} from './workout-controller.js';
import {mountWorkoutBar} from './workout-bar.js';
import {mountTypingState} from './typing-state.js';
import {parseDocument,serializeDocument,documentFileName} from './document-file.js';

const api=createApiClient(),app=document.querySelector('#app'),shell=document.querySelector('#shell'),authHost=document.querySelector('#auth');
const message=document.querySelector('#app-message'),status=document.querySelector('[data-testid="save-status"]'),retry=document.querySelector('#retry-save'),reloadSaved=document.querySelector('#reload-saved'),copySaved=document.querySelector('#copy-saved');
let breadcrumb,updateCurrentBreadcrumb=()=>{};
let templateController,programTemplates=[],mounted,active,queue,routeVersion=0,currentHash=location.hash||'#/programs',authenticated=false,transitioning=false,creation=null,mountedVersion=0;
const retryCreation=document.querySelector('#retry-creation');
const viewTransition=createViewTransition(app),navigationStatus=document.querySelector('#navigation-status');
let loadingTimer,limitView=null;
const pendingConfirmations=new Set();
function cancelConfirmations(){for(const controller of pendingConfirmations)controller.abort();pendingConfirmations.clear();}
async function confirmCurrent(options){
 const controller=new AbortController(),version=routeVersion,mount=mountedVersion,owned=queue,record=active?.id,revision=active?.revision,document=JSON.stringify(active?.document);
 pendingConfirmations.add(controller);
 try{return await confirmAction({...options,signal:controller.signal})&&version===routeVersion&&mount===mountedVersion&&owned===queue&&record===active?.id&&revision===active?.revision&&document===JSON.stringify(active?.document);}
 finally{pendingConfirmations.delete(controller);}
}
function busy(version){
 cancelConfirmations();
 viewTransition.cancel();clearTimeout(loadingTimer);navigationStatus.hidden=true;app.inert=true;app.setAttribute('aria-busy','true');
 loadingTimer=setTimeout(()=>{if(version===routeVersion)navigationStatus.hidden=false;},250);
}
function idle(version){if(version!==routeVersion)return;clearTimeout(loadingTimer);navigationStatus.hidden=true;app.inert=false;app.setAttribute('aria-busy','false');}
function focusHeading(){const heading=app.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}

document.querySelector('#logout').innerHTML=actionIcon('logout');
const profileButton=document.querySelector('#profile');profileButton.innerHTML=actionIcon('profile');
const shellTooltips=mountActionTooltips(document.querySelector('.app-header'));
const uid=()=>crypto.randomUUID();
const programReturn=new Map();
const errorText=error=>error.message||'Something went wrong. Please retry.';
function report(error){message.textContent=errorText(error);if(error.status===401)showLogin(true);}
const action=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
function createViewHost(){return app.appendChild(document.createElement('div'));}
const workoutBar=mountWorkoutBar(document.querySelector('#workout-bar-host'),{onResume:id=>action(()=>navigate('#/workouts/'+id))()});
const workouts=createWorkoutController({api,navigate:hash=>navigate(hash),bar:workoutBar,onError:report,onSignIn:()=>{if(authenticated)showLogin(true);}});
let barRendered=false;
const startWorkout=action(options=>workouts.start(options));
// Set by Log out, cleared by a successful sign-in: offline startup never bypasses the password after a sign-out.
const SIGNED_OUT_KEY='gpb.signedOut';
function signedOut(){try{return localStorage.getItem(SIGNED_OUT_KEY)==='1';}catch{return false;}}
function setSignedOut(value){try{if(value)localStorage.setItem(SIGNED_OUT_KEY,'1');else localStorage.removeItem(SIGNED_OUT_KEY);}catch{/* storage unavailable */}}
function clearView(){limitView=null;cancelConfirmations();breadcrumb?.destroy();breadcrumb=null;updateCurrentBreadcrumb=()=>{};shellTooltips.hide();mounted?.destroy();mounted=null;app.replaceChildren();}
async function transition(work){
 if(transitioning)return;
 const invoker=document.activeElement;
 transitioning=true;shell.inert=true;
 try{return await work();}finally{
  transitioning=false;shell.inert=false;
  if(document.activeElement===document.body&&invoker?.isConnected&&!invoker.closest('[inert]'))invoker.focus({preventScroll:true});
 }
}
function saveStatus(text){status.textContent=text;retry.hidden=!['Couldn’t save','Sign in to save'].includes(text);reloadSaved.hidden=text!=='Conflict';copySaved.hidden=text!=='Conflict'||['profile','workout'].includes(active?.kind);if(text==='Sign in to save')showLogin(true);}
// The profile is not a document: it has one fixed id, its own endpoint and no Save as copy.
const profileRecord=({profile,revision})=>({id:'profile',kind:'profile',revision,document:profile});
// A finished workout log is edited through the same autosave; it has no Save as copy.
const workoutRecord=({id,revision,log})=>({id,kind:'workout',revision,document:log});
function track(record,{project=value=>value}={}){
 templateController?.dispose();templateController=null;queue?.dispose();active=structuredClone(record);saveStatus('Saved');
 let copyRequest;
 const onStatus=text=>{if(queue===owned)saveStatus(text);};
 const onRecord=value=>{if(queue===owned){const changed=JSON.stringify(active?.document)!==JSON.stringify(value.document);active=value;updateCurrentBreadcrumb(value.document);if(changed&&!owned.isDirty())mounted?.syncSaved?.(project(value.document));}};
 let owned;
 if(record.kind==='template'){
  templateController=createSharedSessionController({api,onStatus,onTemplate:onRecord,onConflict:error=>{message.textContent=error.message+' Save as copy creates a new template; existing programs keep their original template.';}});owned=templateController.load(record);
 }else if(record.kind==='workout')owned=createAutosave({record,save:({id,revision,document})=>api.saveWorkout({id,revision,log:document}).then(workoutRecord),onStatus,onRecord,onConflict:error=>{message.textContent=error.message+' Reload saved version to continue.';}});
 else if(record.kind==='profile')owned=createAutosave({record,save:({revision,document})=>api.updateProfile({revision,profile:document}).then(profileRecord),onStatus,onRecord,onConflict:error=>{message.textContent=error.message+' Reload saved version to continue.';}});
 else owned=createAutosave({record,save:args=>api.update(args),createCopy:document=>{copyRequest??={id:uid(),kind:record.kind,copyOf:record.id,document:structuredClone(document)};return api.create(copyRequest);},onStatus,onRecord});
 queue=owned;
 return document=>{if(queue!==owned||active?.id!==record.id)return;active.document=document;updateCurrentBreadcrumb(document);owned.change(document);};
}
async function leave(){
 if(mounted?.hasUnsavedDraft?.()&&!await confirmCurrent({title:'Discard unsaved changes?',message:'A set without reps is not saved. Discard it and leave?',confirmLabel:'Discard and leave',destructive:true}))return false;
 if(!queue?.isDirty())return true;
 try{await queue.flush();return true;}catch(error){report(error);if(error.status===401)return false;if(!await confirmCurrent({title:'Discard unsaved changes?',message:'Changes could not be saved. Discard them and leave?',confirmLabel:'Discard and leave',destructive:true}))return false;return true;}
}
async function navigate(hash,{push=true}={}){
 const version=++routeVersion;busy(version);
 try{
  if(!await leave()){if(version===routeVersion)history.replaceState(null,'',currentHash);return;}
  if(version!==routeVersion)return;
  if(push&&(location.hash||'#/programs')!==hash)history.pushState(null,'',hash);
  await renderRoute(version);
 }finally{idle(version);}
}
mountTypingState(app);
const NAV_ICONS={programs:'calendar',templates:'template',catalog:'catalog',workouts:'dumbbell'};
document.querySelectorAll('[data-nav]').forEach(link=>link.insertAdjacentHTML('afterbegin',actionIcon(NAV_ICONS[link.dataset.nav])));
document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();action(()=>navigate(link.hash))();
}));
window.addEventListener('beforeunload',event=>{if(queue?.isDirty()||mounted?.hasUnsavedDraft?.()){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',action(()=>{if(authenticated)return navigate(location.hash||'#/programs',{push:false});}));
function showLogin(resuming=false){
 cancelActiveConfirmation();
 cancelConfirmations();
 routeVersion++;viewTransition.cancel();idle(routeVersion);
 shellTooltips.hide();
 authenticated=false;shell.hidden=true;authHost.hidden=false;
 authHost.innerHTML='<form class="login-card"><p class="eyebrow">Gym Program Builder</p><h1>Your training, saved</h1><p>Sign in to your personal program library.</p><label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label><p class="error" role="alert"></p><button class="add-btn" type="submit">Sign in</button></form>';
 const form=authHost.querySelector('form');form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{
   await api.login(form.elements.password.value);setSignedOut(false);authenticated=true;authHost.hidden=true;shell.hidden=false;
   // A workout sync paused by 401 continues; a first sign-in recovers the active workout.
   workouts.resume();await workouts.boot().catch(report);
   if(resuming&&active&&queue?.isDirty()){
    // Retrying the exact envelope safely recovers a lost acknowledgement or yields a real 409.
    if(!['profile','workout'].includes(active.kind)){const remote=await api.get(active.id);if(remote.kind!==active.kind)throw Error('The saved document kind changed.');}
    await queue.retry();return;
   }
   await renderRoute();
  }catch(error){form.querySelector('.error').textContent=errorText(error);}finally{button.disabled=false;}
 });
 form.elements.password.focus();
}
document.querySelector('#logout').addEventListener('click',action(()=>transition(async()=>{if(!await leave())return;await workouts.flush();await api.logout();setSignedOut(true);workouts.signOut();queue?.dispose();queue=null;active=null;clearView();showLogin();})));
profileButton.addEventListener('click',action(()=>navigate('#/profile')));
retry.addEventListener('click',action(async()=>{await queue?.retry();}));
reloadSaved.addEventListener('click',action(()=>transition(async()=>{if(!active||!await confirmCurrent({title:'Reload saved version?',message:'Discard local edits and reload the saved version?',confirmLabel:'Reload saved version',destructive:true}))return;if(active.kind==='workout'){const owned=queue,saved=await api.getWorkout(active.id);if(queue!==owned)return;owned.reload(workoutRecord(saved));message.textContent='';mounted?.setLog?.(saved.log);return;}if(active.kind==='profile'){const owned=queue,saved=await api.getProfile();if(queue!==owned)return;owned.reload(profileRecord(saved));message.textContent='';mounted?.setProfile?.(saved.profile);return;}const record=await api.get(active.id);await openRecord(record,++routeVersion);})));
copySaved.addEventListener('click',action(()=>transition(async()=>{if(!queue)return;const record=await queue.saveAsCopy();queue=null;active=null;history.pushState(null,'',`#/${record.kind==='program'?'programs':'templates'}/${record.id}`);await renderRoute();})));
function download(kind,document,templates=[]){const text=serializeDocumentBundle({record:{kind,document},templates}),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=documentElement('a');a.href=url;a.download=documentFileName(kind);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function externalConflict(owned){
 const error=Object.assign(Error('The saved workout changed. Reload saved version, or Save as copy to keep your workout settings with current catalog definitions.'),{status:409,code:'CONFLICT'});
 owned.conflict(error);message.textContent=error.message;return error;
}
async function exportActive(kind){
 const owned=queue,recordId=active?.id;if(!owned||!recordId)return;
 await owned.flush();if(queue!==owned)return;
 const revision=active.revision;
 if(kind==='program'){
  const bundle=await api.programBundle(recordId);if(queue!==owned)return;
  if(bundle.record.revision!==revision||queue.isDirty()||bundle.templates.some(t=>programTemplates.find(old=>old.id===t.id)?.revision!==t.revision))throw externalConflict(owned);
  download(kind,bundle.record.document,bundle.templates);
 }else{
  const remote=await api.get(recordId);if(queue!==owned)return;
  if(remote.revision!==revision||queue.isDirty())throw externalConflict(owned);
  download(kind,remote.document);
 }
}
let refreshing=false;
window.addEventListener('focus',()=>{refreshActive().catch(report);refreshLimitHints();});
/** Profile limits for non-blocking hints. Any failure resolves to null, which silently hides hints. */
const loadLimitProfile=()=>api.getProfile().then(saved=>normalizeProfile(saved.profile)).catch(()=>null);
function applyLimitProfile(view,profile){view.setProfile?.(profile);view.setMaxSessionMinutes?.(profile?.maxSessionMinutes??null);}
// Each load takes a token when issued; only the latest load's response may apply, and only to the same mounted view.
let limitRequest=0;
function applyLimitLoad(view,load){const token=++limitRequest;load.then(profile=>{if(token===limitRequest&&view===limitView&&view===mounted)applyLimitProfile(view,profile);});}
function refreshLimitHints(){
 const view=limitView;if(!authenticated||!view||view!==mounted)return;
 applyLimitLoad(view,loadLimitProfile());
}
async function refreshActive(){
 if(refreshing||!authenticated||!active||transitioning||active.kind==='workout')return;
 if(templateController){const owned=queue,revision=active.revision;await templateController.refresh();if(queue===owned&&active.revision!==revision&&!owned.isDirty())mounted?.setWorkout?.(active.document,{silent:true});return;}
 const owned=queue,id=active.id,revision=active.revision,version=routeVersion;
 refreshing=true;
 if(active.kind==='profile')try{
  const remote=await api.getProfile();
  if(queue!==owned||routeVersion!==version||active?.revision!==revision||owned.isSaving()||remote.revision===revision)return;
  if(owned.isDirty())owned.conflict(Object.assign(Error('Profile changed on another device.'),{status:409,code:'CONFLICT'}));else owned.reload(profileRecord(remote));
  return;
 }finally{refreshing=false;}
 try {
  const bundle=active.kind==='program'?await api.programBundle(id):null;
  const remote=bundle?bundle.record:await api.get(id);
  if(queue!==owned||routeVersion!==version||!active||active.revision!==revision||owned.isSaving())return;
  if(remote.revision!==revision){
   if(owned.isDirty()){externalConflict(owned);return;}
   owned.reload(remote);
   if(remote.kind==='template')mounted?.setWorkout?.(remote.document,{silent:true});
  }
  if(bundle){const dependenciesChanged=JSON.stringify(programTemplates.map(t=>[t.id,t.revision]))!==JSON.stringify(bundle.templates.map(t=>[t.id,t.revision]));programTemplates=bundle.templates;if(dependenciesChanged||remote.revision!==revision)mounted?.update?.(resolveProgram(active.document,programTemplates));
  }
 }finally{refreshing=false;}
}
function documentElement(tag){return window.document.createElement(tag);}
async function finishCreation(){
 const operation=creation,version=routeVersion;
 try{
  const record=await api.create(operation.request);
  creation=null;retryCreation.hidden=true;
  if(version!==routeVersion)return;
  if(operation.open)history.pushState(null,'',`#/${record.kind==='program'?'programs':'templates'}/${record.id}`);
  await renderRoute();
 }catch(error){retryCreation.hidden=false;throw error;}
}
async function create(kind,document,{open=true,copyOf}={}){return transition(async()=>{creation??={request:{id:uid(),kind,document:structuredClone(document),...(copyOf?{copyOf}:{})},open};await finishCreation();});}
retryCreation.addEventListener('click',action(()=>transition(async()=>{if(creation)await finishCreation();})));
let importRequest=null;
async function importFile(kind,file,version,{replace=false}={}){
 if(file.size>1048576)throw Error('File must be at most 1 MiB.');const text=await file.text();if(version!==mountedVersion)return;
 const parsed=parseDocumentBundle(text);if(parsed.error)throw Error(parsed.error);if(parsed.bundle.kind!==kind)throw Error(`Import this file from ${parsed.bundle.kind==='program'?'Programs':'Session templates'}.`);
 if(replace){
  const hasContent=kind==='program'?(active.document.workouts.length||active.document.sequence?.length||Object.keys(active.document.goals).length||hasProgramContext(active.document)):(active.document.exercises.length||Object.keys(active.document.goals).length);
  if(hasContent&&!await confirmCurrent({title:kind==='program'?'Replace program?':'Replace shared template?',message:kind==='program'?'Replace this program and all of its workouts?':'Replace this shared session template everywhere it is used?',confirmLabel:kind==='program'?'Replace program':'Replace shared template',destructive:true}))return;
  const owned=queue;await owned.flush();if(version!==mountedVersion||owned!==queue)return;
 }
 const targetId=replace?active.id:undefined;
 if(!importRequest||importRequest.text!==text||importRequest.targetId!==targetId)importRequest={text,targetId,request:{operationId:uid(),bundle:parsed.bundle,...(replace?{targetId,revision:active.revision}:{})}};
 const result=await api.importDocument(importRequest.request);importRequest=null;
 if(version!==mountedVersion)return;
 if(replace)await renderRoute();else await navigate(`#/${kind==='program'?'programs':'templates'}/${result.record.id}`);
}
async function prepareRecord(record,context,profileLoad=loadLimitProfile()){
 // The profile never delays route entry: views mount without hints and adopt them when the load settles.
 let mountProgramView,templates,bundle;
 if(record.kind==='program'){const [module,items,loaded]=await Promise.all([import('./program-view.js'),api.list('template'),api.programBundle(record.id)]);mountProgramView=module.mountProgramView;templates=items;bundle=loaded;record=bundle.record;}
 return ()=>{
  programTemplates=bundle?.templates||[];
  const onChange=track(record,{project:document=>record.kind==='program'?resolveProgram(document,programTemplates):document}),host=createViewHost(),contentHost=host.appendChild(document.createElement('div'));
  const parents=context?[{label:'Programs',href:'#/programs'},{label:context.program.document.name.trim()||'Untitled program',href:'#/programs/'+context.program.id}]:[{label:record.kind==='template'?'Session templates':'Programs',href:record.kind==='template'?'#/templates':'#/programs'}];
  breadcrumb=mountBreadcrumbs(host,{items:[...parents,{label:record.document.name.trim()||'Untitled '+record.kind}],onNavigate:hash=>action(()=>navigate(hash))()});updateCurrentBreadcrumb=value=>breadcrumb?.update([...parents,{label:value.name.trim()||'Untitled '+record.kind}]);
  if(record.kind==='template'){
   const editorHost=contentHost;
   const programSource=context?{program:{id:context.program.id,name:context.program.document.name.trim()||'Untitled program'},occurrenceId:context.occurrence.id}:{};
   mounted=mountSessionEditor(editorHost,{api,workout:active.document,onChange,onStartWorkout:session=>startWorkout({template:{id:record.id,document:session},...programSource}),onImportFile:file=>importFile('template',file,mountedVersion,{replace:true}),onExport:action(()=>exportActive('template'))});
   limitView=mounted;applyLimitLoad(mounted,profileLoad);
   if(context){const shared=document.createElement('a');shared.className='shared-template-link';shared.href=`#/templates/${record.id}`;shared.textContent='Shared template';shared.onclick=event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey){event.preventDefault();action(()=>navigate(shared.hash))();}};editorHost.querySelector('.editor-heading').append(shared);}
  }else{
   let attachRequest;
   host.classList.add('program-route');const reviewDock=document.createElement('aside');reviewDock.className='review-dock';host.append(reviewDock);
   mounted=mountProgramView(contentHost,{api,reviewDock,analysisEnabled:null,onStartWorkout:workout=>startWorkout({template:{id:workout.templateId,document:workout},program:{id:record.id,name:active.document.name.trim()||'Untitled program'},occurrenceId:workout.id}),program:resolveProgram(active.document,programTemplates),templates,onLoadTemplate:async id=>{const t=await api.get(id);programTemplates=[...programTemplates.filter(old=>old.id!==id),t];return t;},onChange:document=>onChange(programArrangement(document)),workoutHref:id=>`#/programs/${record.id}/workouts/${id}`,onOpenWorkout:async(id,{focusError=false}={})=>{programReturn.set(record.id,{id,scroll:window.scrollY});await navigate(`#/programs/${record.id}/workouts/${id}`);if(focusError)mounted?.focusFirstError?.();},onExport:action(()=>exportActive('program')),onImportFile:file=>importFile('program',file,mountedVersion,{replace:true}),onCreateEmpty:()=>transition(async()=>{
    const owned=queue,version=mountedVersion;await owned.flush();if(owned!==queue)return;
    attachRequest??={operationId:uid(),programId:record.id,revision:active.revision,templateId:uid(),occurrenceId:uid(),template:{...createTemplate(),name:'Untitled workout'}};
    const result=await api.createAndAttach(attachRequest);attachRequest=null;if(owned!==queue||version!==mountedVersion)return;
    programTemplates=result.templates;owned.reload(result.record);mounted.update(resolveProgram(result.record.document,programTemplates));
   })});
   limitView=mounted;applyLimitLoad(mounted,profileLoad);
   const programView=mounted;api.analysisCapability().then(result=>{if(mounted===programView)programView.setAnalysisEnabled(result.enabled);}).catch(()=>{if(mounted===programView)programView.setAnalysisEnabled(false);});
  }
 };
}
async function openRecord(record,version){
 busy(version);
 try{const commit=await prepareRecord(record);if(version!==routeVersion)return;await viewTransition.swap(()=>{clearView();mountedVersion=version;commit();});}finally{idle(version);}
}
async function renderRoute(version=++routeVersion){
 busy(version);const targetHash=location.hash||'#/programs',route=parseRoute(targetHash),changed=targetHash!==currentHash;message.textContent='';
 try{
  const commit=await prepareRoute(route,version);if(version!==routeVersion)return;
  await viewTransition.swap(()=>{
   clearView();queue?.dispose();queue=null;active=null;saveStatus('');mountedVersion=version;commit();currentHash=commit.canonicalHash||targetHash;if(commit.canonicalHash)history.replaceState(null,'',commit.canonicalHash);
   document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',route.view.startsWith(a.dataset.nav.slice(0,-1))?'page':'false'));
   if(route.view==='profile')profileButton.setAttribute('aria-current','page');else profileButton.removeAttribute('aria-current');
   if(changed&&!(route.view==='program'&&programReturn.has(route.id)))window.scrollTo(0,0);
   workouts.refreshBar({animate:barRendered});barRendered=true;
  },{focus:()=>{app.inert=false;if(commit.focus){commit.focus();return;}if(changed){const returning=route.view==='program'?programReturn.get(route.id):null;if(returning){window.scrollTo(0,returning.scroll);app.querySelector(`[data-workout-title="${CSS.escape(returning.id)}"]`)?.focus({preventScroll:true});programReturn.delete(route.id);}else if(route.view==='program-workout')app.querySelector('[data-template-name]')?.focus({preventScroll:true});else focusHeading();}}});
 }catch(error){
  if(version!==routeVersion)return;
  history.replaceState(null,'',currentHash);report(error);
  if(!mounted&&error.status!==401){app.textContent='This page could not be opened. Choose Programs or Session templates to retry.';}
 }finally{idle(version);}
}
async function prepareWorkout(route){
 // Recovers this device's mirror first (retried after a failed boot), so a stray dirty log is never overwritten.
 await workouts.boot();
 // The active (or unsynced finished) log lives in the controller; the logger only attaches to its sync.
 let record=null;
 if(!workouts.owns(route.id)){
  try{record=await api.getWorkout(route.id);}catch(error){if(error.status!==404)throw error;}
  if(!record)return ()=>{app.textContent='Page not found. Choose Programs or Session templates.';};
  if(record.log.status==='active'&&!workouts.adopt(record))
   return ()=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Resume or finish your current workout before opening another active workout.';createViewHost().append(p);};
 }
 const local=workouts.owns(route.id)?workouts.snapshot():null,log=local?local.log:record.log,owned=local&&log.status==='active';
 // A finished log is edited through the app's autosave, unless the controller still holds it as an unsynced pending finish (read-only).
 const editFinished=log.status==='finished'&&!local;
 const lastTime=local?local.lastTime:await (linkedVariantIds(log).length?api.lastTime({variantIds:linkedVariantIds(log),exclude:route.id}).catch(error=>{if(isNetworkError(error))return null;report(error);return {};}):Promise.resolve({}));
 const commit=()=>{
  let logger=null,binding=null,change=null,disposed=false;const bestRequests=new Map();
  if(editFinished)change=track(workoutRecord(record));
  const handlers={setStatus:text=>logger?.setStatus(text),setLog:value=>logger?.setLog(value),setLastTime:map=>logger?.setLastTime(map),setBestPerformance:map=>logger?.setBestPerformance(map),setBestStatus:value=>logger?.setBestStatus(value)};
  logger=mountWorkoutLogger(createViewHost(),{api,log,lastTime,bestPerformance:local?.bestPerformance??null,mode:log.status==='active'?'active':'finished',readOnly:log.status==='finished'&&!editFinished,
   onChange:value=>(change||binding?.onChange)?.(value),
   onDelete:async()=>{
    await queue.flush();
    await api.deleteWorkout({id:active.id,revision:active.revision});
    queue?.dispose();queue=null;active=null;saveStatus('');
    await navigate('#/workouts');
   },
   onFinish:()=>binding?.onFinish(),
   onDiscard:()=>binding?.onDiscard(),
   onRetry:()=>binding?.onRetry(),
   onBestPerformanceNeeded:ids=>binding?binding.onBestPerformanceNeeded(ids):finishedBest(ids),
   onLastTimeNeeded:ids=>binding?binding.onLastTimeNeeded(ids):editFinished?finishedLastTime(ids):Promise.resolve()});
  const finishedLastTime=async ids=>{
   const map=await api.lastTime({variantIds:ids,exclude:route.id});
   if(mounted?.setLog&&logger)logger.setLastTime(map);
  };
  const finishedBest=async ids=>{
   if(!ids.length||disposed)return;
   const versions=new Map(ids.map(id=>{const n=(bestRequests.get(id)||0)+1;bestRequests.set(id,n);return [id,n];}));
   const validIds=()=>disposed?[]:ids.filter(id=>bestRequests.get(id)===versions.get(id));
   logger.setBestStatus({variantIds:ids,status:'loading'});
   try{const map=await api.bestPerformance({variantIds:ids,exclude:route.id});const valid=validIds();if(valid.length){logger.setBestPerformance(Object.fromEntries(valid.filter(id=>Object.hasOwn(map,id)).map(id=>[id,map[id]])));logger.setBestStatus({variantIds:valid,status:'ready'});}}
   catch(error){const valid=validIds();if(!valid.length)return;logger.setBestStatus({variantIds:valid,status:isNetworkError(error)?'offline':'error'});if(!isNetworkError(error))report(error);}
  };
  if(owned)binding=workouts.attach(route.id,handlers);
  else void finishedBest(linkedVariantIds(log));
  mounted={destroy(){disposed=true;binding?.detach();logger.destroy();},setLog:value=>logger.setLog(value),hasUnsavedDraft:()=>logger.hasUnsavedDraft()};
 };
 commit.focus=()=>app.querySelector('.logger-title')?.focus({preventScroll:true});
 return commit;
}
async function prepareRoute(route,version){
 if(route.view==='catalog-tags')return ()=>{const host=createViewHost(),content=host.appendChild(document.createElement('div'));breadcrumb=mountBreadcrumbs(host,{items:[{label:'Exercise catalog',href:'#/catalog'},{label:'Tags'}],onNavigate:hash=>action(()=>navigate(hash))()});mounted=mountTagView(content,{api,kind:route.kind,query:route.query,onNavigate:action(({kind,query,replace=false})=>{const hash='#/catalog/tags?'+new URLSearchParams({kind,q:query});if(replace){history.replaceState(null,'',hash);currentHash=hash;}else return navigate(hash);})});};
 if(['catalog','catalog-reference','catalog-variant'].includes(route.view)){
  const data=route.view==='catalog'?undefined:await api.catalog();
  const variant=route.variantId?data.entries.find(e=>e.id===route.variantId):null,reference=data?.families.find(r=>r.id===(variant?.familyId||route.referenceId));
  const commit=()=>{
   const host=createViewHost(),content=host.appendChild(document.createElement('div'));
   if(data&&(!reference||(route.variantId&&!variant))){breadcrumb=mountBreadcrumbs(host,{items:[{label:'Exercise catalog',href:'#/catalog'},{label:'Not found'}],onNavigate:hash=>action(()=>navigate(hash))()});const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='This reference exercise or variant is unavailable. Return to Exercise catalog.';content.append(p);return;}
   if(data)breadcrumb=mountBreadcrumbs(host,{items:[],onNavigate:hash=>action(()=>navigate(hash))()});
   mounted=mountCatalog(content,{api,initialData:data,target:data?{referenceId:reference.id,variantId:variant?.id}:undefined,onNavigate:hash=>action(()=>navigate(hash))(),onTargetChange:({reference,variant})=>{
    breadcrumb?.update([{label:'Exercise catalog',href:'#/catalog'},...(variant?[{label:reference.name,href:'#/catalog/references/'+reference.id},{label:variant.name}]:[{label:reference.name}])]);
    const hash='#/catalog/references/'+reference.id+(variant?'/variants/'+variant.id:'');if(location.hash!==hash){history.replaceState(null,'',hash);currentHash=hash;}
   }});
  };
  if(data&&reference&&(!route.variantId||variant)){commit.canonicalHash='#/catalog/references/'+reference.id+(variant?'/variants/'+variant.id:'');commit.focus=()=>mounted?.focusTarget?.();}
  return commit;
 }
 if(route.view==='profile'){const saved=await api.getProfile();return ()=>{const onChange=track(profileRecord(saved));mounted=mountProfileView(createViewHost(),{profile:active.document,onChange});};}
 if(route.view==='workouts'){
  let page,error='';
  // The start sheet's lists load with the history; a list lost to the network shows Retry in the sheet.
  const optional=promise=>promise.catch(failure=>{if(!isNetworkError(failure))throw failure;return null;});
  const lists=Promise.all([optional(api.list('program')),optional(api.list('template')),optional(api.getSettings())]);
  try{page=await api.listWorkouts();}catch(failure){if(!isNetworkError(failure))throw failure;page={records:[],hasMore:false};error='Workouts could not be loaded. Connect to see your history.';}
  let [programs,templates,settings]=await lists;
  const summary=workouts.pendingSummary(),pending=summary&&!page.records.some(r=>r.id===summary.id)?summary:null;
  return ()=>{const data={programs,templates,logs:page.records,activeProgramId:settings?.activeProgramId??null};
   const launcher=createWorkoutStartLauncher({api,onStart:options=>workouts.start(options),onNavigate:hash=>action(()=>navigate(hash))(),onError:report});
   const historyView=mountWorkoutHistory(createViewHost(),{records:page.records,hasMore:page.hasMore,pending,error,
   onLoadMore:last=>api.listWorkouts({before:last.startedAt,beforeId:last.id}),
   onStart:()=>launcher.open({data}),
   onOpen:id=>action(()=>navigate('#/workouts/'+id))(),workoutHref:id=>'#/workouts/'+id});
   mounted={destroy(){historyView.destroy();launcher.destroy();}};};
 }
 if(route.view==='not-found')return ()=>{app.textContent='Page not found. Choose Programs or Session templates.';};
 if(route.view==='workout')return prepareWorkout(route);
 if(route.view==='program-workout'){const profileLoad=loadLimitProfile(),bundle=await api.programBundle(route.id),occurrence=bundle.record.document.workouts.find(w=>w.id===route.occurrenceId);if(!occurrence)throw Error('Session occurrence not found. Choose Programs to return.');const template=bundle.templates.find(t=>t.id===occurrence.templateId);return prepareRecord(template,{program:bundle.record,occurrence},profileLoad);}
 if(route.id){const profileLoad=loadLimitProfile();return prepareRecord(await api.get(route.id),undefined,profileLoad);}
 const kind=route.view==='programs'?'program':'template';
 // A settings failure on the network just shows no active program; anything else is reported.
 const [records,settings]=await Promise.all([api.list(kind),kind==='program'?api.getSettings().catch(error=>{if(!isNetworkError(error))report(error);return {activeProgramId:null};}):null]);
 return ()=>{
 // Star taps apply at once; one request is in flight at a time and only the latest choice is sent next.
 let confirmed=settings?.activeProgramId??null,wanted=confirmed,sending=false;
 const toggleActive=action(async record=>{
  wanted=wanted===record.id?null:record.id;mounted.update(records,{activeProgramId:wanted});
  if(sending)return;sending=true;
  try{
   while(wanted!==confirmed){
    const target=wanted;
    try{confirmed=(await api.setActiveProgram(target)).activeProgramId;}
    catch(error){if(wanted!==target)continue;wanted=confirmed;if(version===mountedVersion)mounted.update(records,{activeProgramId:confirmed});throw error;}
   }
  }finally{sending=false;}
 });
 mounted=mountLibrary(createViewHost(),{
  kind,records,recordHref:record=>`#/${route.view}/${record.id}`,activeProgramId:settings?.activeProgramId??null,onToggleActive:kind==='program'?toggleActive:undefined,
  onStartWorkout:kind==='template'?action(async record=>{const template=await api.get(record.id);if(version!==mountedVersion)return;await startWorkout({template:{id:template.id,document:template.document}});}):undefined,
  onCreate:action(()=>create(kind,kind==='program'?createProgram():createTemplate())),
  onOpen:action(record=>navigate(`#/${route.view}/${record.id}`)),
  onDuplicate:action(async record=>{
   const [source,latest]=await Promise.all([api.get(record.id),api.list(kind)]);
   if(version!==mountedVersion)return;
   const document=kind==='program'?duplicateProgram(source.document,uid):structuredClone(source.document);
   document.name=duplicateName(source.document.name,latest.map(item=>item.name),kind==='program'?'Untitled program':'Untitled template');
   await create(kind,document,{open:false,copyOf:source.id});
  }),
  onDelete:action(record=>transition(async()=>{
   if(!await confirmCurrent({title:'Delete '+(record.name||'this item')+'?',message:'This item will be deleted. This cannot be undone.',confirmLabel:'Delete',destructive:true}))return;
   try{await api.remove(record);}catch(error){if(error.code==='IN_USE'){message.textContent=error.message;for(const program of error.details?.programs||[]){const a=document.createElement('a');a.href=`#/programs/${program.id}`;a.textContent=' '+(program.name||'Untitled program');message.append(a);}return;}throw error;}await renderRoute();app.querySelector('[data-new]')?.focus();
  })),
  onExport:action(async record=>{
   const bundle=kind==='program'?await api.programBundle(record.id):null,full=bundle?.record||await api.get(record.id);
   if(version!==mountedVersion)return;
   try{download(kind,full.document,bundle?.templates);}catch(error){
    await navigate(`#/${route.view}/${record.id}`);await mounted?.focusFirstError?.();throw error;
   }
  }),
  onImport:action(file=>importFile(kind,file,version))
 });};
}
async function start(){
 try{await api.passwordSession();}catch(error){
  if(error.status===401){showLogin();return;}
  // After an explicit Log out the password gate always applies, even offline.
  if(isNetworkError(error)&&signedOut()){showLogin();return;}
  // Offline with a workout saved on this device: keep logging from the mirror; sync resumes on reconnect.
  if(!(isNetworkError(error)&&readMirror(localStorage))){shell.hidden=false;report(error);app.innerHTML='<button type="button" class="secondary-btn" onclick="location.reload()">Retry connection</button>';return;}
 }
 authenticated=true;shell.hidden=false;authHost.hidden=true;
 await workouts.boot().catch(report);
 await renderRoute();
}
await start();
