import {createApiClient} from './api-client.js';
import {createAutosave} from './autosave.js';
import {createTemplate,createProgram,duplicateProgram} from './program.js';
import {parseRoute} from './router.js';
import {mountLibrary} from './library-view.js';
import {mountSessionEditor} from './session-editor.js';
import {parseDocument,serializeDocument,documentFileName} from './document-file.js';

const api=createApiClient(),app=document.querySelector('#app'),shell=document.querySelector('#shell'),authHost=document.querySelector('#auth');
const message=document.querySelector('#app-message'),status=document.querySelector('[data-testid="save-status"]'),retry=document.querySelector('#retry-save'),reloadSaved=document.querySelector('#reload-saved'),copySaved=document.querySelector('#copy-saved');
let mounted,active,queue,routeVersion=0,currentHash=location.hash||'#/programs',authenticated=false;
const uid=()=>crypto.randomUUID();
const errorText=error=>error.message||'Something went wrong. Please retry.';
function report(error){message.textContent=errorText(error);if(error.status===401)showLogin(true);}
const action=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
function clearView(){mounted?.destroy();mounted=null;app.replaceChildren();}
function saveStatus(text){status.textContent=text;retry.hidden=!['Couldn’t save','Sign in to save'].includes(text);reloadSaved.hidden=copySaved.hidden=text!=='Conflict';if(text==='Sign in to save')showLogin(true);}
function track(record){
 queue?.dispose();active=structuredClone(record);saveStatus('Saved');
 queue=createAutosave({record,save:args=>api.update(args),createCopy:document=>api.create({id:uid(),kind:active.kind,document}),onStatus:saveStatus,onRecord:value=>{active=value;}});
}
async function leave(){
 if(!queue?.isDirty())return true;
 try{await queue.flush();return true;}catch(error){report(error);if(error.status===401)return false;if(!confirm('Changes could not be saved. Discard them and leave?'))return false;queue.dispose();return true;}
}
async function navigate(hash){if(!await leave())return;location.hash=hash;}
document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();action(()=>navigate(link.hash))();}));
window.addEventListener('beforeunload',event=>{if(queue?.isDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',action(async()=>{
 const target=location.hash||'#/programs';
 if(target===currentHash)return;
 if(!await leave()){history.replaceState(null,'',currentHash);return;}
 currentHash=target;if(authenticated)await renderRoute();
}));
function showLogin(resuming=false){
 authenticated=false;shell.hidden=true;authHost.hidden=false;
 authHost.innerHTML='<form class="login-card"><p class="eyebrow">Gym Program Builder</p><h1>Your training, saved</h1><p>Sign in to your personal program library.</p><label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label><p class="error" role="alert"></p><button class="add-btn" type="submit">Sign in</button></form>';
 const form=authHost.querySelector('form');form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{
   await api.login(form.elements.password.value);authenticated=true;authHost.hidden=true;shell.hidden=false;
   if(resuming&&active&&queue?.isDirty()){
    const remote=await api.get(active.id);
    if(remote.revision!==active.revision){saveStatus('Conflict');return;}
    await queue.retry();return;
   }
   await renderRoute();
  }catch(error){form.querySelector('.error').textContent=errorText(error);}finally{button.disabled=false;}
 });
 form.elements.password.focus();
}
document.querySelector('#logout').addEventListener('click',action(async()=>{if(!await leave())return;await api.logout();queue?.dispose();queue=null;active=null;clearView();showLogin();}));
retry.addEventListener('click',action(async()=>{await queue?.retry();}));
reloadSaved.addEventListener('click',action(async()=>{if(!active||!confirm('Discard local edits and reload the saved version?'))return;const record=await api.get(active.id);queue?.dispose();queue=null;active=null;await openRecord(record);}));
copySaved.addEventListener('click',action(async()=>{const record=await queue.saveAsCopy();queue=null;active=null;location.hash=`#/${record.kind==='program'?'programs':'templates'}/${record.id}`;}));
function download(kind,document){const text=serializeDocument(kind,document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=documentElement('a');a.href=url;a.download=documentFileName(kind);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function documentElement(tag){return window.document.createElement(tag);}
async function create(kind,document){const record=await api.create({id:uid(),kind,document});await navigate(`#/${kind==='program'?'programs':'templates'}/${record.id}`);}
async function importFile(kind,file){if(file.size>1048576)throw Error('File must be at most 1 MiB.');const parsed=parseDocument(await file.text());if(parsed.error)throw Error(parsed.error);if(parsed.kind!==kind)throw Error(`Import this file from ${parsed.kind==='program'?'Programs':'Session templates'}.`);await create(kind,parsed.document);}
async function openRecord(record){
 clearView();track(record);
 if(record.kind==='template')mounted=mountSessionEditor(app,{workout:active.document,onChange:document=>{active.document=document;queue.change(document);}});
 else {
  const {mountProgramView}=await import('./program-view.js');
  const templates=await api.list('template');
  mounted=mountProgramView(app,{program:active.document,templates,onLoadTemplate:id=>api.get(id),onChange:document=>{active.document=document;queue.change(document);},onExport:document=>download('program',document)});
 }
}
async function renderRoute(){
 const version=++routeVersion,route=parseRoute(location.hash||'#/programs');message.textContent='';
 document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',route.view.startsWith(a.dataset.nav.slice(0,-1))?'page':'false'));
 if(route.view==='not-found'){clearView();app.textContent='Page not found. Choose Programs or Session templates.';return;}
 if(route.id){
  try {const record=await api.get(route.id);if(version!==routeVersion)return;await openRecord(record);}catch(error){if(version!==routeVersion)return;clearView();report(error);app.textContent='This item could not be opened. Choose Programs or Session templates to return.';}return;
 }
 queue?.dispose();queue=null;active=null;saveStatus('');clearView();app.textContent='Loading…';
 const kind=route.view==='programs'?'program':'template',records=await api.list(kind);if(version!==routeVersion)return;
 mounted=mountLibrary(app,{kind,records,onCreate:action(()=>create(kind,kind==='program'?createProgram():createTemplate())),onOpen:action(record=>navigate(`#/${route.view}/${record.id}`)),onDuplicate:action(async record=>{const source=await api.get(record.id);await api.create({id:uid(),kind,document:kind==='program'?duplicateProgram(source.document,uid):structuredClone(source.document)});await renderRoute();}),onDelete:action(async record=>{if(!confirm(`Delete ${record.name||'this item'}?`))return;await api.remove(record);await renderRoute();app.querySelector('[data-new]')?.focus();}),onExport:action(async record=>{const full=await api.get(record.id);try{download(kind,full.document);}catch(error){await navigate(`#/${route.view}/${record.id}`);setTimeout(()=>mounted?.focusFirstError?.(),0);throw error;}}),onImport:action(file=>importFile(kind,file))});
}
try{await api.passwordSession();authenticated=true;shell.hidden=false;authHost.hidden=true;await renderRoute();}catch(error){if(error.status===401)showLogin();else {shell.hidden=false;report(error);app.innerHTML='<button type="button" class="secondary-btn" onclick="location.reload()">Retry connection</button>';}}
