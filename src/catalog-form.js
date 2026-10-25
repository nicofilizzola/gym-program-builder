import {EQUIPMENT,validateCatalogEntry} from './catalog.js';
import {MUSCLE_GROUPS} from './muscles.js';
import {invalidateCatalog} from './catalog-store.js';
const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent=text;b.onclick=fn;return b;};
export function openCatalogForm({api,entry,families=[],mode='create',onSaved=()=>{},initialName=''}) {
 const invoker=document.activeElement,dialog=document.createElement('dialog');dialog.className='catalog-dialog';
 dialog.setAttribute('aria-labelledby','catalog-form-title');
 dialog.innerHTML='<form novalidate><h2 id="catalog-form-title"></h2><p data-description></p><label class="field">Exercise name<input type="text" name="exerciseName" maxlength="200" required autocomplete="off"></label><label class="field" data-family-field>Exercise family<select name="family" aria-label="Exercise family"></select></label><label class="field" data-new-family>New family name<input type="text" name="familyName" maxlength="200" required></label><label class="field">Equipment<select name="equipment" aria-label="Equipment"></select></label><div class="catalog-muscles"><fieldset class="primary" data-role="primary"><legend>Primary muscles</legend><div class="chips"></div></fieldset><fieldset class="secondary" data-role="secondary"><legend>Secondary muscles</legend><div class="chips"></div></fieldset></div><p data-impact role="status"></p><p class="error" role="alert" data-error></p><div class="catalog-recovery"></div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-cancel>Cancel</button><button type="submit" class="add-btn"></button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector('form'),fields=form.elements,error=dialog.querySelector('[data-error]'),save=form.querySelector('[type=submit]'),recovery=dialog.querySelector('.catalog-recovery');
 let current=entry,operation=mode,id=crypto.randomUUID(),newFamilyId=crypto.randomUUID(),impact=[],saving=false,closed=false,usageReady=false;
 const close=()=>{if(closed)return;closed=true;dialog.close();dialog.remove();if(invoker?.isConnected)invoker.focus({preventScroll:true});};
 dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!saving)close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)if(!saving)close();}});
 for(const equipment of EQUIPMENT)fields.equipment.add(new Option(equipment,equipment));
 fields.family.add(new Option('New family',''));
 for(const family of families)fields.family.add(new Option(family.name,family.id));
 const familyVisibility=()=>{dialog.querySelector('[data-new-family]').hidden=operation!=='create'||Boolean(fields.family.value);};
 fields.family.onchange=familyVisibility;
 for(const role of ['primary','secondary'])for(const muscle of MUSCLE_GROUPS){
  const label=document.createElement('label');label.className='chip';const input=document.createElement('input');input.type='checkbox';input.value=muscle;input.dataset.role=role;
  const text=document.createElement('span');text.textContent=muscle;label.append(input,text);dialog.querySelector('[data-role="'+role+'"] .chips').append(label);
  input.onchange=()=>{if(input.checked)dialog.querySelectorAll('input[type=checkbox]').forEach(other=>{if(other!==input&&other.value===muscle)other.checked=false;});};
 }
 function populate(){
  fields.exerciseName.value=current?.name||initialName;fields.equipment.value=current?.equipment||'Barbell';fields.family.value=current?.familyId||'';
  fields.familyName.value='';
  for(const input of dialog.querySelectorAll('input[type=checkbox]'))input.checked=Boolean(current?.[input.dataset.role==='primary'?'primaryMuscles':'secondaryMuscles']?.includes(input.value));
  presentation();
 }
 function presentation(){
  dialog.querySelector('h2').textContent=operation==='edit'?'Edit exercise':operation==='variant'?'Create variant':'New exercise';
  dialog.querySelector('[data-description]').textContent=operation==='edit'?'Changes apply to every workout using this exercise.':operation==='variant'?'Creates a new catalog variant. Other workouts are unchanged.':'Save a reusable exercise with its muscle mappings.';
  dialog.querySelector('[data-family-field]').hidden=operation!=='create';
  save.textContent=operation==='edit'?'Save changes':operation==='variant'?'Save variant':'Save exercise';familyVisibility();
 }
 async function preview(){
  if(operation!=='edit')return;
  save.disabled=true;usageReady=false;
  try {impact=await api.catalogImpact(current.id);if(closed)return;usageReady=true;dialog.querySelector('[data-impact]').textContent=impact.reduce((n,r)=>n+r.count,0)+' saved workout instance(s) will update.';}
  catch(e){if(!closed){error.textContent=e.message;recovery.replaceChildren(button('Retry usage preview',()=>{error.textContent='';recovery.replaceChildren();preview();}));}}
  finally{if(!closed)save.disabled=!usageReady;}
 }
 async function submit(event){
  event.preventDefault();if(saving)return;
  if(operation==='edit'&&!usageReady){error.textContent='Load the usage preview before saving shared changes.';return;}
  const definition={name:fields.exerciseName.value,equipment:fields.equipment.value,primaryMuscles:[],secondaryMuscles:[]};
  for(const input of dialog.querySelectorAll('input[type=checkbox]:checked'))definition[input.dataset.role==='primary'?'primaryMuscles':'secondaryMuscles'].push(input.value);
  const validated=validateCatalogEntry(definition);if(validated.error){error.textContent=validated.error;return;}
  if(operation==='create'&&!fields.family.value&&!fields.familyName.value.trim()){error.textContent='Enter a family name.';fields.familyName.focus();return;}
  saving=true;save.disabled=true;error.textContent='';recovery.replaceChildren();dialog.querySelector('[data-cancel]').disabled=true;
  try{
   const saved=operation==='edit'?await api.updateCatalog({id:current.id,revision:current.revision,entry:validated.entry,impact}):await api.createCatalog({id,familyId:operation==='variant'?current.familyId:fields.family.value||newFamilyId,familyName:fields.familyName.value,entry:validated.entry});
   invalidateCatalog(api);if(closed)return;await onSaved(saved);close();
  }catch(e){
   if(closed)return;error.textContent=e.message;
   if(e.status===409&&operation==='edit'){
    recovery.append(button('Reload saved version',async()=>{try{const data=await api.catalog();if(closed)return;current=data.entries.find(e=>e.id===current.id);if(!current)throw Error('Exercise not found.');populate();error.textContent='';recovery.replaceChildren();await preview();}catch(err){error.textContent=err.message;}}));
    recovery.append(button('Save as variant',()=>{operation='variant';id=crypto.randomUUID();presentation();dialog.querySelector('[data-impact]').textContent='';error.textContent='Give this variant a distinct name, then save.';recovery.replaceChildren();fields.exerciseName.focus();}));
    recovery.append(button('Refresh usage preview',()=>{recovery.replaceChildren();error.textContent='';preview();}));
   }else recovery.append(button('Retry',()=>form.requestSubmit()));
  }finally{saving=false;if(!closed){save.disabled=operation==='edit'&&!usageReady;dialog.querySelector('[data-cancel]').disabled=false;}}
 }
 form.onsubmit=submit;populate();dialog.showModal();fields.exerciseName.focus();preview();
 return {destroy:close};
}
