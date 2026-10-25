import {createViewTransition} from './view-transition.js';
import {actionIcon,mountActionTooltips} from './action-controls.js';
import {createApiClient} from './api-client.js';
import {createAutosave} from './autosave.js';
import {createTemplate,createProgram,duplicateProgram} from './program.js';
import {parseRoute} from './router.js';
import {mountLibrary} from './library-view.js';
import {mountSessionEditor} from './session-editor.js';
import {mountCatalog} from './catalog-view.js';
import {parseDocument,serializeDocument,documentFileName} from './document-file.js';

const api=createApiClient(),app=document.querySelector('#app'),shell=document.querySelector('#shell'),authHost=document.querySelector('#auth');
const message=document.querySelector('#app-message'),status=document.querySelector('[data-testid="save-status"]'),retry=document.querySelector('#retry-save'),reloadSaved=document.querySelector('#reload-saved'),copySaved=document.querySelector('#copy-saved');
let mounted,active,queue,routeVersion=0,currentHash=location.hash||'#/programs',authenticated=false,transitioning=false,creation=null,mountedVersion=0;
const retryCreation=document.querySelector('#retry-creation');
const viewTransition=createViewTransition(app),navigationStatus=document.querySelector('#navigation-status');
let loadingTimer;
function busy(version){
 viewTransition.cancel();clearTimeout(loadingTimer);navigationStatus.hidden=true;app.inert=true;app.setAttribute('aria-busy','true');
 loadingTimer=setTimeout(()=>{if(version===routeVersion)navigationStatus.hidden=false;},250);
}
function idle(version){if(version!==routeVersion)return;clearTimeout(loadingTimer);navigationStatus.hidden=true;app.inert=false;app.setAttribute('aria-busy','false');}
function focusHeading(){const heading=app.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}

document.querySelector('#logout').innerHTML=actionIcon('logout');
const shellTooltips=mountActionTooltips(document.querySelector('.app-header'));
const uid=()=>crypto.randomUUID();
const errorText=error=>error.message||'Something went wrong. Please retry.';
function report(error){message.textContent=errorText(error);if(error.status===401)showLogin(true);}
const action=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
function createViewHost(){return app.appendChild(document.createElement('div'));}
function clearView(){shellTooltips.hide();mounted?.destroy();mounted=null;app.replaceChildren();}
async function transition(work){
 if(transitioning)return;
 transitioning=true;shell.inert=true;
 try{return await work();}finally{
  transitioning=false;shell.inert=false;
 }
}
function saveStatus(text){status.textContent=text;retry.hidden=!['Couldn’t save','Sign in to save'].includes(text);reloadSaved.hidden=copySaved.hidden=text!=='Conflict';if(text==='Sign in to save')showLogin(true);}
function track(record){
 queue?.dispose();active=structuredClone(record);saveStatus('Saved');
 let copyRequest;
 const owned=createAutosave({record,save:args=>api.update(args),createCopy:document=>{copyRequest??={id:uid(),kind:record.kind,document:structuredClone(document)};return api.create(copyRequest);},onStatus:text=>{if(queue===owned)saveStatus(text);},onRecord:value=>{if(queue===owned)active=value;}});
 queue=owned;
 return document=>{if(queue!==owned||active?.id!==record.id)return;active.document=document;owned.change(document);};
}
async function leave(){
 if(!queue?.isDirty())return true;
 try{await queue.flush();return true;}catch(error){report(error);if(error.status===401)return false;if(!confirm('Changes could not be saved. Discard them and leave?'))return false;return true;}
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
document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();action(()=>navigate(link.hash))();
}));
window.addEventListener('beforeunload',event=>{if(queue?.isDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',action(()=>{if(authenticated)return navigate(location.hash||'#/programs',{push:false});}));
function showLogin(resuming=false){
 routeVersion++;viewTransition.cancel();idle(routeVersion);
 shellTooltips.hide();
 authenticated=false;shell.hidden=true;authHost.hidden=false;
 authHost.innerHTML='<form class="login-card"><p class="eyebrow">Gym Program Builder</p><h1>Your training, saved</h1><p>Sign in to your personal program library.</p><label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label><p class="error" role="alert"></p><button class="add-btn" type="submit">Sign in</button></form>';
 const form=authHost.querySelector('form');form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{
   await api.login(form.elements.password.value);authenticated=true;authHost.hidden=true;shell.hidden=false;
   if(resuming&&active&&queue?.isDirty()){
    const remote=await api.get(active.id);
    // Retrying the exact envelope safely recovers a lost acknowledgement or yields a real 409.
    if(remote.kind!==active.kind)throw Error('The saved document kind changed.');
    await queue.retry();return;
   }
   await renderRoute();
  }catch(error){form.querySelector('.error').textContent=errorText(error);}finally{button.disabled=false;}
 });
 form.elements.password.focus();
}
document.querySelector('#logout').addEventListener('click',action(()=>transition(async()=>{if(!await leave())return;await api.logout();queue?.dispose();queue=null;active=null;clearView();showLogin();})));
retry.addEventListener('click',action(async()=>{await queue?.retry();}));
reloadSaved.addEventListener('click',action(()=>transition(async()=>{if(!active||!confirm('Discard local edits and reload the saved version?'))return;const record=await api.get(active.id);await openRecord(record,++routeVersion);})));
copySaved.addEventListener('click',action(()=>transition(async()=>{if(!queue)return;const record=await queue.saveAsCopy();queue=null;active=null;history.pushState(null,'',`#/${record.kind==='program'?'programs':'templates'}/${record.id}`);await renderRoute();})));
function download(kind,document){const text=serializeDocument(kind,document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=documentElement('a');a.href=url;a.download=documentFileName(kind);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
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
async function create(kind,document,{open=true}={}){return transition(async()=>{creation??={request:{id:uid(),kind,document:structuredClone(document)},open};await finishCreation();});}
retryCreation.addEventListener('click',action(()=>transition(async()=>{if(creation)await finishCreation();})));
async function importFile(kind,file,version){if(file.size>1048576)throw Error('File must be at most 1 MiB.');const text=await file.text();if(version!==mountedVersion)return;const parsed=parseDocument(text);if(parsed.error)throw Error(parsed.error);if(parsed.kind!==kind)throw Error(`Import this file from ${parsed.kind==='program'?'Programs':'Session templates'}.`);await create(kind,parsed.document);}
async function prepareRecord(record){
 let mountProgramView,templates;
 if(record.kind==='program'){const [module,items]=await Promise.all([import('./program-view.js'),api.list('template')]);mountProgramView=module.mountProgramView;templates=items;}
 return ()=>{
  const onChange=track(record),host=createViewHost();
  if(record.kind==='template')mounted=mountSessionEditor(host,{workout:active.document,onChange});
  else mounted=mountProgramView(host,{program:active.document,templates,onLoadTemplate:id=>api.get(id),onChange,onExport:document=>download('program',document)});
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
   clearView();queue?.dispose();queue=null;active=null;saveStatus('');mountedVersion=version;commit();currentHash=targetHash;
   document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',route.view.startsWith(a.dataset.nav.slice(0,-1))?'page':'false'));
   if(changed)window.scrollTo(0,0);
  },{focus:()=>{app.inert=false;if(changed)focusHeading();}});
 }catch(error){
  if(version!==routeVersion)return;
  history.replaceState(null,'',currentHash);report(error);
  if(!mounted&&error.status!==401){app.textContent='This page could not be opened. Choose Programs or Session templates to retry.';}
 }finally{idle(version);}
}
async function prepareRoute(route,version){
 if(route.view==='catalog')return ()=>{mounted=mountCatalog(createViewHost(),{api});};
 if(route.view==='not-found')return ()=>{app.textContent='Page not found. Choose Programs or Session templates.';};
 if(route.id)return prepareRecord(await api.get(route.id));
 const kind=route.view==='programs'?'program':'template',records=await api.list(kind);
 return ()=>{mounted=mountLibrary(createViewHost(),{
  kind,records,recordHref:record=>`#/${route.view}/${record.id}`,
  onCreate:action(()=>create(kind,kind==='program'?createProgram():createTemplate())),
  onOpen:action(record=>navigate(`#/${route.view}/${record.id}`)),
  onDuplicate:action(async record=>{
   const source=await api.get(record.id);
   if(version!==mountedVersion)return;
   await create(kind,kind==='program'?duplicateProgram(source.document,uid):structuredClone(source.document),{open:false});
  }),
  onDelete:action(record=>transition(async()=>{
   if(!confirm(`Delete ${record.name||'this item'}?`))return;
   await api.remove(record);await renderRoute();app.querySelector('[data-new]')?.focus();
  })),
  onExport:action(async record=>{
   const full=await api.get(record.id);
   if(version!==mountedVersion)return;
   try{download(kind,full.document);}catch(error){
    await navigate(`#/${route.view}/${record.id}`);await mounted?.focusFirstError?.();throw error;
   }
  }),
  onImport:action(file=>importFile(kind,file,version))
 });};
}
try{await api.passwordSession();authenticated=true;shell.hidden=false;authHost.hidden=true;await renderRoute();}catch(error){if(error.status===401)showLogin();else {shell.hidden=false;report(error);app.innerHTML='<button type="button" class="secondary-btn" onclick="location.reload()">Retry connection</button>';}}
