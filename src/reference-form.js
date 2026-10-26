import {invalidateCatalog} from './catalog-store.js';
function modal(title,{onClosed}){
 const invoker=document.activeElement,dialog=document.createElement('dialog'),titleId='reference-form-'+crypto.randomUUID();dialog.className='catalog-dialog';dialog.setAttribute('aria-labelledby',titleId);
 dialog.innerHTML='<form novalidate><h2></h2><div data-content></div><p class="error" role="alert"></p><div data-recovery class="catalog-recovery"></div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-cancel>Cancel</button><button class="add-btn" type="submit"></button></div></form>';
 dialog.querySelector('h2').id=titleId;dialog.querySelector('h2').textContent=title;document.body.append(dialog);
 const form=dialog.querySelector('form'),content=dialog.querySelector('[data-content]'),error=dialog.querySelector('.error'),save=dialog.querySelector('[type=submit]'),cancel=dialog.querySelector('[data-cancel]'),recovery=dialog.querySelector('[data-recovery]');
 let closed=false,busy=false;
 const close=()=>{if(closed)return;closed=true;dialog.close();dialog.remove();if(onClosed)onClosed();else if(invoker?.isConnected)invoker.focus({preventScroll:true});};
 cancel.onclick=()=>{if(!busy)close();};dialog.oncancel=e=>{e.preventDefault();if(!busy)close();};
 dialog.onclick=e=>{if(e.target!==dialog||busy)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();};
 function action(text,fn){const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent=text;b.onclick=()=>Promise.resolve().then(fn).catch(e=>{if(!closed)error.textContent=e.message;});recovery.append(b);return b;}
 async function perform(fn,onError){
  if(busy||closed)return;busy=true;error.textContent='';recovery.replaceChildren();
  const controls=[...form.elements].map(el=>[el,el.disabled]);controls.forEach(([el])=>{el.disabled=true;});
  try{await fn();if(!closed)close();}
  catch(e){if(!closed){error.textContent=e.message;onError?.(e);}}
  finally{busy=false;if(!closed)controls.forEach(([el,disabled])=>{el.disabled=disabled;});}
 }
 return {dialog,form,content,error,save,recovery,action,perform,close,get closed(){return closed;},show(){dialog.showModal();content.querySelector('input,select')?.focus();}};
}
export function openReferenceForm({api,reference,onSaved=()=>{},onClosed}){
 const ui=modal(reference?'Edit reference exercise':'New reference exercise',{onClosed});let current=reference;const id=reference?.id||crypto.randomUUID();
 ui.content.innerHTML='<label class="field">Reference exercise name<input type="text" maxlength="200" required autocomplete="off"></label><label class="field">Exercise type<select aria-label="Exercise type" required><option value="">Choose type</option><option value="compound">Compound · 3 min rest</option><option value="isolation">Isolation · 1 min 30 sec rest</option></select></label><p class="catalog-meta">Supplies initial rest for new selections. Existing workout rest stays unchanged.</p>';
 const input=ui.content.querySelector('input'),type=ui.content.querySelector('select');input.value=current?.name||'';type.value=current?.exerciseType||'';ui.save.textContent=current?'Save reference exercise':'Create reference exercise';
 const reload=async()=>{const value=await api.getReference(id);if(ui.closed)return;current=value;input.value=value.name;type.value=value.exerciseType||'';ui.save.textContent='Save reference exercise';ui.error.textContent='';ui.recovery.replaceChildren();};
 const submit=()=>{const name=input.value.trim();if(!name||name.length>200){ui.error.textContent='Enter a reference exercise name (up to 200 characters).';input.focus();return;}
  if(!type.value){ui.error.textContent='Choose Compound or Isolation.';type.focus();return;}
  ui.perform(async()=>{const saved=current?await api.updateReference({id,revision:current.revision,name,exerciseType:type.value}):await api.createReference({id,name,exerciseType:type.value});invalidateCatalog(api);if(!ui.closed)await onSaved(saved);},e=>{if(e.status===409)ui.action('Reload saved version',reload);else ui.action('Retry',submit);});
 };
 ui.form.onsubmit=e=>{e.preventDefault();submit();};ui.show();return {destroy:ui.close};
}
export function openReferenceArchive({api,reference,entries,onSaved=()=>{},onClosed}){
 const ui=modal(reference.archived?'Restore reference exercise':'Archive reference exercise',{onClosed});let current=reference,children=entries;
 ui.content.innerHTML='<p data-name></p><p data-description></p>';
 function render(){
  const count=children.filter(e=>e.familyId===current.id&&!(e.individuallyArchived??e.archived)).length;
  ui.dialog.querySelector('h2').textContent=current.archived?'Restore reference exercise':'Archive reference exercise';
  ui.content.querySelector('[data-name]').textContent=current.name;
  ui.content.querySelector('[data-description]').textContent=current.archived?count+' variant(s) will become available. Individually archived variants stay archived.':count+' active variant(s) will be removed from new selections. Existing workouts stay linked.';
  ui.save.textContent=current.archived?'Restore reference exercise':'Archive reference exercise';
 }
 const reload=async()=>{const data=await api.catalog();if(ui.closed)return;current=data.families.find(r=>r.id===current.id);if(!current)throw Error('Reference exercise not found.');children=data.entries;render();ui.error.textContent='';ui.recovery.replaceChildren();};
 const submit=()=>ui.perform(async()=>{const saved=await api.archiveReference({id:current.id,revision:current.revision,archived:!current.archived});invalidateCatalog(api);if(!ui.closed)await onSaved(saved);},e=>{if(e.status===409)ui.action('Reload saved version',reload);else ui.action('Retry',submit);});
 ui.form.onsubmit=e=>{e.preventDefault();submit();};render();ui.show();return {destroy:ui.close};
}
export function openVariantMove({api,entry,references,entries,onSaved=()=>{},onClosed}){
 const ui=modal('Move variant',{onClosed});let current=entry,refs=references,variants=entries,impact=[],ready=false;
 ui.content.innerHTML='<p data-source></p><p>Moves this variant and its linked workouts to another reference exercise. Muscle mappings, sets and reps stay unchanged.</p><label class="field">Destination reference exercise<select aria-label="Destination reference exercise"></select></label><p data-state></p><p data-usage role="status"></p>';
 const destination=ui.content.querySelector('select');
 function availability(){ui.save.disabled=!ready||!destination.value;}
 function render(){
  const selected=destination.value;destination.replaceChildren(new Option('Choose destination',''));
  for(const ref of refs.filter(r=>!r.archived&&r.id!==current.familyId).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))){
   const duplicate=refs.filter(r=>r.name===ref.name).length>1,preview=variants.filter(e=>e.familyId===ref.id).slice(0,2).map(e=>e.name).join(', ')||'No variants yet';
   destination.add(new Option(ref.name+(duplicate?' — '+preview:''),ref.id));
  }
  if([...destination.options].some(o=>o.value===selected))destination.value=selected;
  ui.content.querySelector('[data-source]').textContent=current.name+' · From '+(refs.find(r=>r.id===current.familyId)?.name||current.familyName);
  ui.content.querySelector('[data-state]').textContent=current.archived?'This variant will remain archived after moving.':'';
  availability();
 }
 async function preview({reload=false}={}){
  ready=false;availability();ui.error.textContent='';ui.recovery.replaceChildren();
  try{
   if(reload){const data=await api.catalog();if(ui.closed)return;refs=data.families;variants=data.entries;current=variants.find(e=>e.id===entry.id);if(!current)throw Error('Variant not found.');render();}
   const value=await api.catalogImpact(current.id);if(ui.closed)return;impact=value;ready=true;ui.content.querySelector('[data-usage]').textContent=impact.reduce((n,r)=>n+r.count,0)+' saved workout instance(s) will update.';availability();
  }catch(e){if(!ui.closed){ui.error.textContent=e.message;ui.action('Retry move preview',()=>preview({reload}));}}
 }
 const submit=()=>{
  if(!ready||!destination.value)return;
  const target=refs.find(r=>r.id===destination.value),source=refs.find(r=>r.id===current.familyId);
  ui.perform(async()=>{const saved=await api.moveCatalog({id:current.id,revision:current.revision,destinationReferenceId:target.id,sourceReferenceRevision:source.revision,destinationReferenceRevision:target.revision,impact});invalidateCatalog(api);if(!ui.closed)await onSaved(saved);},e=>{if(e.status===409)ui.action('Refresh move preview',()=>preview({reload:true}));else ui.action('Retry',submit);});
 };
 destination.onchange=availability;ui.form.onsubmit=e=>{e.preventDefault();submit();};ui.save.textContent='Move variant';render();ui.show();preview();return {destroy:ui.close};
}
