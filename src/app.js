import {actionIcon,mountActionTooltips} from './action-controls.js';
import {createApiClient} from './api-client.js';
import {createAutosave} from './autosave.js';
import {createTemplate,createProgram,duplicateProgram} from './program.js';
import {parseRoute} from './router.js';
import {mountLibrary} from './library-view.js';
import {mountSessionEditor} from './session-editor.js';
import {parseDocument,serializeDocument,documentFileName} from './document-file.js';

const api=createApiClient(),app=document.querySelector('#app'),shell=document.querySelector('#shell'),authHost=document.querySelector('#auth');
const message=document.querySelector('#app-message'),status=document.querySelector('[data-testid="save-status"]'),retry=document.querySelector('#retry-save'),reloadSaved=document.querySelector('#reload-saved'),copySaved=document.querySelector('#copy-saved');
let mounted,active,queue,routeVersion=0,currentHash=location.hash||'#/programs',authenticated=false,transitioning=false,creation=null,pendingRoute=false;
const retryCreation=document.querySelector('#retry-creation');
document.querySelector('#logout').innerHTML=actionIcon('logout');
const shellTooltips=mountActionTooltips(document.querySelector('.app-header'));
const uid=()=>crypto.randomUUID();
const errorText=error=>error.message||'Something went wrong. Please retry.';
function report(error){message.textContent=errorText(error);if(error.status===401)showLogin(true);}
const action=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
function clearView(){shellTooltips.hide();mounted?.destroy();mounted=null;app.replaceChildren();}
async function transition(work){
 if(transitioning)return;
 transitioning=true;shell.inert=true;
 try{return await work();}finally{
  transitioning=false;shell.inert=false;
  if(pendingRoute){pendingRoute=false;queueMicrotask(()=>action(()=>transition(handleHashChange))());}
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
 try{await queue.flush();return true;}catch(error){report(error);if(error.status===401)return false;if(!confirm('Changes could not be saved. Discard them and leave?'))return false;queue.dispose();return true;}
}
async function navigate(hash){return transition(async()=>{if(!await leave())return;currentHash=hash;history.pushState(null,'',hash);await renderRoute();});}
document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();action(()=>navigate(link.hash))();}));
window.addEventListener('beforeunload',event=>{if(queue?.isDirty()){event.preventDefault();event.returnValue='';}});
async function handleHashChange(){
 const target=location.hash||'#/programs';
 if(target===currentHash)return;
 if(!await leave()){history.replaceState(null,'',currentHash);return;}
 currentHash=target;if(authenticated)await renderRoute();
}
window.addEventListener('hashchange',action(async()=>{
 if(transitioning){pendingRoute=true;routeVersion++;return;}
 await transition(handleHashChange);
}));
function showLogin(resuming=false){
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
reloadSaved.addEventListener('click',action(()=>transition(async()=>{if(!active||!confirm('Discard local edits and reload the saved version?'))return;const record=await api.get(active.id);queue?.dispose();queue=null;active=null;await openRecord(record,++routeVersion);})));
copySaved.addEventListener('click',action(()=>transition(async()=>{if(!queue)return;const record=await queue.saveAsCopy();queue=null;active=null;currentHash=`#/${record.kind==='program'?'programs':'templates'}/${record.id}`;history.pushState(null,'',currentHash);await renderRoute();})));
function download(kind,document){const text=serializeDocument(kind,document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=documentElement('a');a.href=url;a.download=documentFileName(kind);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function documentElement(tag){return window.document.createElement(tag);}
async function finishCreation(){
 const operation=creation;
 try{
  const record=await api.create(operation.request);
  creation=null;retryCreation.hidden=true;
  if(operation.open){currentHash=`#/${record.kind==='program'?'programs':'templates'}/${record.id}`;history.pushState(null,'',currentHash);}
  await renderRoute();
 }catch(error){retryCreation.hidden=false;throw error;}
}
async function create(kind,document,{open=true}={}){return transition(async()=>{creation??={request:{id:uid(),kind,document:structuredClone(document)},open};await finishCreation();});}
retryCreation.addEventListener('click',action(()=>transition(async()=>{if(creation)await finishCreation();})));
async function importFile(kind,file,version){if(file.size>1048576)throw Error('File must be at most 1 MiB.');const text=await file.text();if(version!==routeVersion)return;const parsed=parseDocument(text);if(parsed.error)throw Error(parsed.error);if(parsed.kind!==kind)throw Error(`Import this file from ${parsed.kind==='program'?'Programs':'Session templates'}.`);await create(kind,parsed.document);}
async function openRecord(record,version){
 let mountProgramView,templates;
 if(record.kind==='program'){({mountProgramView}=await import('./program-view.js'));templates=await api.list('template');}
 if(version!==routeVersion)return;
 clearView();const onChange=track(record);
 if(record.kind==='template')mounted=mountSessionEditor(app,{workout:active.document,onChange});
 else {
  mounted=mountProgramView(app,{program:active.document,templates,onLoadTemplate:id=>api.get(id),onChange,onExport:document=>download('program',document)});
 }
}
async function renderRoute(){
 const version=++routeVersion,route=parseRoute(location.hash||'#/programs');message.textContent='';
 queue?.dispose();queue=null;active=null;saveStatus('');clearView();app.textContent='Loading…';
 document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',route.view.startsWith(a.dataset.nav.slice(0,-1))?'page':'false'));
 if(route.view==='not-found'){clearView();app.textContent='Page not found. Choose Programs or Session templates.';return;}
 if(route.id){
  try {const record=await api.get(route.id);if(version!==routeVersion)return;await openRecord(record,version);}catch(error){if(version!==routeVersion)return;clearView();report(error);app.textContent='This item could not be opened. Choose Programs or Session templates to return.';}return;
 }
 queue?.dispose();queue=null;active=null;saveStatus('');clearView();app.textContent='Loading…';
 const kind=route.view==='programs'?'program':'template',records=await api.list(kind);if(version!==routeVersion)return;
 mounted=mountLibrary(app,{
  kind,records,recordHref:record=>`#/${route.view}/${record.id}`,
  onCreate:action(()=>create(kind,kind==='program'?createProgram():createTemplate())),
  onOpen:action(record=>navigate(`#/${route.view}/${record.id}`)),
  onDuplicate:action(async record=>{
   const source=await api.get(record.id);
   if(version!==routeVersion)return;
   await create(kind,kind==='program'?duplicateProgram(source.document,uid):structuredClone(source.document),{open:false});
  }),
  onDelete:action(record=>transition(async()=>{
   if(!confirm(`Delete ${record.name||'this item'}?`))return;
   await api.remove(record);await renderRoute();app.querySelector('[data-new]')?.focus();
  })),
  onExport:action(async record=>{
   const full=await api.get(record.id);
   if(version!==routeVersion)return;
   try{download(kind,full.document);}catch(error){
    await navigate(`#/${route.view}/${record.id}`);mounted?.focusFirstError?.();throw error;
   }
  }),
  onImport:action(file=>importFile(kind,file,version))
 });
}
try{await api.passwordSession();authenticated=true;shell.hidden=false;authHost.hidden=true;await renderRoute();}catch(error){if(error.status===401)showLogin();else {shell.hidden=false;report(error);app.innerHTML='<button type="button" class="secondary-btn" onclick="location.reload()">Retry connection</button>';}}
