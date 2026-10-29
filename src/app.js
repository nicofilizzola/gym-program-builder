import {mountBreadcrumbs} from './breadcrumbs.js';
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
import {parseDocument,serializeDocument,documentFileName} from './document-file.js';

const api=createApiClient(),app=document.querySelector('#app'),shell=document.querySelector('#shell'),authHost=document.querySelector('#auth');
const message=document.querySelector('#app-message'),status=document.querySelector('[data-testid="save-status"]'),retry=document.querySelector('#retry-save'),reloadSaved=document.querySelector('#reload-saved'),copySaved=document.querySelector('#copy-saved');
let breadcrumb,updateCurrentBreadcrumb=()=>{};
let templateController,programTemplates=[],mounted,active,queue,routeVersion=0,currentHash=location.hash||'#/programs',authenticated=false,transitioning=false,creation=null,mountedVersion=0;
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
const programReturn=new Map();
const errorText=error=>error.message||'Something went wrong. Please retry.';
function report(error){message.textContent=errorText(error);if(error.status===401)showLogin(true);}
const action=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
function createViewHost(){return app.appendChild(document.createElement('div'));}
function clearView(){breadcrumb?.destroy();breadcrumb=null;updateCurrentBreadcrumb=()=>{};shellTooltips.hide();mounted?.destroy();mounted=null;app.replaceChildren();}
async function transition(work){
 if(transitioning)return;
 transitioning=true;shell.inert=true;
 try{return await work();}finally{
  transitioning=false;shell.inert=false;
 }
}
function saveStatus(text){status.textContent=text;retry.hidden=!['Couldn’t save','Sign in to save'].includes(text);reloadSaved.hidden=copySaved.hidden=text!=='Conflict';if(text==='Sign in to save')showLogin(true);}
function track(record,{project=value=>value}={}){
 templateController?.dispose();templateController=null;queue?.dispose();active=structuredClone(record);saveStatus('Saved');
 let copyRequest;
 const onStatus=text=>{if(queue===owned)saveStatus(text);};
 const onRecord=value=>{if(queue===owned){const changed=JSON.stringify(active?.document)!==JSON.stringify(value.document);active=value;updateCurrentBreadcrumb(value.document);if(changed&&!owned.isDirty())mounted?.syncSaved?.(project(value.document));}};
 let owned;
 if(record.kind==='template'){
  templateController=createSharedSessionController({api,onStatus,onTemplate:onRecord,onConflict:error=>{message.textContent=error.message+' Save as copy creates a new template; existing programs keep their original template.';}});owned=templateController.load(record);
 }else owned=createAutosave({record,save:args=>api.update(args),createCopy:document=>{copyRequest??={id:uid(),kind:record.kind,copyOf:record.id,document:structuredClone(document)};return api.create(copyRequest);},onStatus,onRecord});
 queue=owned;
 return document=>{if(queue!==owned||active?.id!==record.id)return;active.document=document;updateCurrentBreadcrumb(document);owned.change(document);};
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
window.addEventListener('focus',()=>{refreshActive().catch(report);});
async function refreshActive(){
 if(refreshing||!authenticated||!active||transitioning)return;
 if(templateController){const owned=queue,revision=active.revision;await templateController.refresh();if(queue===owned&&active.revision!==revision&&!owned.isDirty())mounted?.setWorkout?.(active.document,{silent:true});return;}
 const owned=queue,id=active.id,revision=active.revision,version=routeVersion;
 refreshing=true;
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
  const hasContent=kind==='program'?(active.document.workouts.length||active.document.sequence?.length||Object.keys(active.document.goals).length):(active.document.exercises.length||Object.keys(active.document.goals).length);
  if(hasContent&&!confirm(kind==='program'?'Replace this program and all of its workouts?':'Replace this shared session template everywhere it is used?'))return;
  await queue.flush();
 }
 const targetId=replace?active.id:undefined;
 if(!importRequest||importRequest.text!==text||importRequest.targetId!==targetId)importRequest={text,targetId,request:{operationId:uid(),bundle:parsed.bundle,...(replace?{targetId,revision:active.revision}:{})}};
 const result=await api.importDocument(importRequest.request);importRequest=null;
 if(version!==mountedVersion)return;
 if(replace)await renderRoute();else await navigate(`#/${kind==='program'?'programs':'templates'}/${result.record.id}`);
}
async function prepareRecord(record,context){
 let mountProgramView,templates,bundle;
 if(record.kind==='program'){const [module,items,loaded]=await Promise.all([import('./program-view.js'),api.list('template'),api.programBundle(record.id)]);mountProgramView=module.mountProgramView;templates=items;bundle=loaded;record=bundle.record;}
 return ()=>{
  programTemplates=bundle?.templates||[];
  const onChange=track(record,{project:document=>record.kind==='program'?resolveProgram(document,programTemplates):document}),host=createViewHost(),contentHost=host.appendChild(document.createElement('div'));
  const parents=context?[{label:'Programs',href:'#/programs'},{label:context.program.document.name.trim()||'Untitled program',href:'#/programs/'+context.program.id}]:[{label:record.kind==='template'?'Session templates':'Programs',href:record.kind==='template'?'#/templates':'#/programs'}];
  breadcrumb=mountBreadcrumbs(host,{items:[...parents,{label:record.document.name.trim()||'Untitled '+record.kind}],onNavigate:hash=>action(()=>navigate(hash))()});updateCurrentBreadcrumb=value=>breadcrumb?.update([...parents,{label:value.name.trim()||'Untitled '+record.kind}]);
  if(record.kind==='template'){
   const editorHost=contentHost;
   mounted=mountSessionEditor(editorHost,{api,workout:active.document,onChange,onImportFile:file=>importFile('template',file,mountedVersion,{replace:true}),analysisEnabled:null,onExport:action(()=>exportActive('template'))});
   if(context){const shared=document.createElement('a');shared.className='shared-template-link';shared.href=`#/templates/${record.id}`;shared.textContent='Shared template';shared.onclick=event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey){event.preventDefault();action(()=>navigate(shared.hash))();}};editorHost.querySelector('.editor-heading').append(shared);}
   const editor=mounted;api.analysisCapability().then(result=>{if(mounted===editor)editor.setAnalysisEnabled(result.enabled);}).catch(()=>{if(mounted===editor)editor.setAnalysisEnabled(false);});
  }else{
   let attachRequest;
   mounted=mountProgramView(contentHost,{api,program:resolveProgram(active.document,programTemplates),templates,onLoadTemplate:async id=>{const t=await api.get(id);programTemplates=[...programTemplates.filter(old=>old.id!==id),t];return t;},onChange:document=>onChange(programArrangement(document)),onOpenWorkout:async(id,{focusError=false}={})=>{programReturn.set(record.id,{id,scroll:window.scrollY});await navigate(`#/programs/${record.id}/workouts/${id}`);if(focusError)mounted?.focusFirstError?.();},onExport:action(()=>exportActive('program')),onImportFile:file=>importFile('program',file,mountedVersion,{replace:true}),onCreateEmpty:()=>transition(async()=>{
    const owned=queue,version=mountedVersion;await owned.flush();if(owned!==queue)return;
    attachRequest??={operationId:uid(),programId:record.id,revision:active.revision,templateId:uid(),occurrenceId:uid(),template:{...createTemplate(),name:'Untitled workout'}};
    const result=await api.createAndAttach(attachRequest);attachRequest=null;if(owned!==queue||version!==mountedVersion)return;
    programTemplates=result.templates;owned.reload(result.record);mounted.update(resolveProgram(result.record.document,programTemplates));
   })});
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
   if(changed&&!(route.view==='program'&&programReturn.has(route.id)))window.scrollTo(0,0);
  },{focus:()=>{app.inert=false;if(commit.focus){commit.focus();return;}if(changed){const returning=route.view==='program'?programReturn.get(route.id):null;if(returning){window.scrollTo(0,returning.scroll);app.querySelector(`[data-edit="${CSS.escape(returning.id)}"]`)?.focus({preventScroll:true});programReturn.delete(route.id);}else if(route.view==='program-workout')app.querySelector('[data-template-name]')?.focus({preventScroll:true});else focusHeading();}}});
 }catch(error){
  if(version!==routeVersion)return;
  history.replaceState(null,'',currentHash);report(error);
  if(!mounted&&error.status!==401){app.textContent='This page could not be opened. Choose Programs or Session templates to retry.';}
 }finally{idle(version);}
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
 if(route.view==='not-found')return ()=>{app.textContent='Page not found. Choose Programs or Session templates.';};
 if(route.view==='program-workout'){const bundle=await api.programBundle(route.id),occurrence=bundle.record.document.workouts.find(w=>w.id===route.occurrenceId);if(!occurrence)throw Error('Session occurrence not found. Choose Programs to return.');const template=bundle.templates.find(t=>t.id===occurrence.templateId);return prepareRecord(template,{program:bundle.record,occurrence});}
 if(route.id)return prepareRecord(await api.get(route.id));
 const kind=route.view==='programs'?'program':'template',records=await api.list(kind);
 return ()=>{mounted=mountLibrary(createViewHost(),{
  kind,records,recordHref:record=>`#/${route.view}/${record.id}`,
  onCreate:action(()=>create(kind,kind==='program'?createProgram():createTemplate())),
  onOpen:action(record=>navigate(`#/${route.view}/${record.id}`)),
  onDuplicate:action(async record=>{
   const source=await api.get(record.id);
   if(version!==mountedVersion)return;
   await create(kind,kind==='program'?duplicateProgram(source.document,uid):structuredClone(source.document),{open:false,copyOf:source.id});
  }),
  onDelete:action(record=>transition(async()=>{
   if(!confirm(`Delete ${record.name||'this item'}?`))return;
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
try{await api.passwordSession();authenticated=true;shell.hidden=false;authHost.hidden=true;await renderRoute();}catch(error){if(error.status===401)showLogin();else {shell.hidden=false;report(error);app.innerHTML='<button type="button" class="secondary-btn" onclick="location.reload()">Retry connection</button>';}}
