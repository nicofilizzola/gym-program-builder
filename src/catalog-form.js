import {mountEquipmentPills} from './equipment-controls.js';
import {mountMuscleChoices,mountDescriptionField,mountDisclosure,mountVariantTags} from './catalog-controls.js';
import {mountDialogMotion} from './dialog-motion.js';
import {EQUIPMENT,validateCatalogEntry} from './catalog.js';
import {MUSCLE_GROUPS} from './muscles.js';
import {invalidateCatalog} from './catalog-store.js';
const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent=text;b.onclick=fn;return b;};
export function openCatalogForm({api,entry,families=[],tags=[],mode='create',onSaved=()=>{},initialName='',referenceId,referenceRevision,onClosed}) {
 const invoker=document.activeElement,dialog=document.createElement('dialog');dialog.className='catalog-dialog';
 dialog.setAttribute('aria-labelledby','catalog-form-title');
 dialog.innerHTML='<form novalidate><h2 id="catalog-form-title"></h2><p data-description></p><label class="field">Variant name<input type="text" name="exerciseName" maxlength="200" required autocomplete="off"></label><label class="field" data-family-field>Reference exercise<select name="family" aria-label="Reference exercise"></select></label><label class="field" data-new-family>New reference exercise name<input type="text" name="familyName" maxlength="200" required></label><label class="field" data-reference-type>Exercise type<select name="referenceType" aria-label="Exercise type"><option value="">Choose type</option><option value="compound">Compound (3 min rest)</option><option value="isolation">Isolation (1 min 30 sec rest)</option></select></label><div data-reference-equipment></div><div data-reference-details></div><p class="catalog-meta" data-inherited-equipment></p><div data-variant-description></div><div data-variant-muscles></div><div data-tags></div><p data-impact role="status"></p><p class="error" role="alert" data-error></p><div class="catalog-recovery"></div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-cancel>Cancel</button><button type="submit" class="add-btn"></button></div></form>';
 document.body.append(dialog);
 const referenceLabel=document.createElement('p');referenceLabel.className='catalog-meta';dialog.querySelector('[data-description]').after(referenceLabel);
 const form=dialog.querySelector('form'),fields=form.elements,error=dialog.querySelector('[data-error]'),save=form.querySelector('[type=submit]'),recovery=dialog.querySelector('.catalog-recovery');
 let current=entry,operation=mode,id=crypto.randomUUID(),newFamilyId=crypto.randomUUID(),impact=[],saving=false,closed=false,usageReady=false,refreshingReference=false;
 const targetReferenceId=()=>referenceId||(operation==='variant'?current?.familyId:fields.family.value);
 const referenceUnavailable=()=>operation!=='edit'&&Boolean(targetReferenceId())&&!families.some(r=>r.id===targetReferenceId()&&!r.archived&&r.equipment);
 const updateSave=()=>{save.disabled=saving||refreshingReference||(operation==='edit'?!usageReady:referenceUnavailable());};
 const motion=mountDialogMotion(dialog,{onClosed:()=>{if(onClosed)onClosed();else if(invoker?.isConnected&&!document.querySelector('dialog[open]'))invoker.focus({preventScroll:true});}});
 const close=()=>{if(closed)return;closed=true;motion.close();};
 dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!saving)close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)if(!saving)close();}});
 const equipment=mountEquipmentPills(dialog.querySelector('[data-reference-equipment]'),{name:'referenceEquipment'});
 let musclesTouched=Boolean(current?.primaryMuscles?.length);
 const muscles=mountMuscleChoices(dialog.querySelector('[data-variant-muscles]'),{onChange:()=>{musclesTouched=true;}});
 const notes=mountDescriptionField(dialog.querySelector('[data-variant-description]'),{label:'Variant description',name:'variantDescription',value:current?.description||current?.variantDescription||''});
 const tagFields=mountVariantTags(dialog.querySelector('[data-tags]'),{tags});
 const referenceDetails=mountDisclosure(dialog.querySelector('[data-reference-details]'),{label:'Reference defaults'});
 const referenceNotes=mountDescriptionField(referenceDetails.content,{label:'Reference description',name:'referenceDescription'});
 const referenceMuscles=mountMuscleChoices(referenceDetails.content,{primaryLabel:'Default primary muscles',secondaryLabel:'Default secondary muscles',onChange:()=>{if(!musclesTouched)muscles.setValue(referenceMuscles.getValue());}});
 fields.family.add(new Option('New reference exercise',''));
 for(const family of families.filter(r=>!r.archived&&r.equipment))fields.family.add(new Option(family.name,family.id));
 const familyVisibility=()=>{
  const hidden=operation!=='create'||Boolean(referenceId)||Boolean(fields.family.value);
  for(const selector of ['[data-new-family]','[data-reference-type]','[data-reference-equipment]','[data-reference-details]'])dialog.querySelector(selector).hidden=hidden;
  const parent=families.find(r=>r.id===targetReferenceId());dialog.querySelector('[data-inherited-equipment]').hidden=!hidden;dialog.querySelector('[data-inherited-equipment]').textContent='Equipment: '+(parent?.equipment||current?.equipment||'Needs equipment');
 };
 fields.family.onchange=()=>{familyVisibility();if(!musclesTouched){const parent=families.find(r=>r.id===fields.family.value);muscles.setValue({primaryMuscles:parent?.defaultPrimaryMuscles||[],secondaryMuscles:parent?.defaultSecondaryMuscles||[]});}updateSave();};
 function populate(){
  fields.exerciseName.value=current?.name||initialName||(referenceId?families.find(r=>r.id===referenceId)?.name||'':'');fields.family.value=referenceId||current?.familyId||'';
  fields.familyName.value='';
  const parent=families.find(r=>r.id===targetReferenceId());musclesTouched=Boolean(current?.primaryMuscles?.length);
  muscles.setValue(current?current:{primaryMuscles:parent?.defaultPrimaryMuscles||[],secondaryMuscles:parent?.defaultSecondaryMuscles||[]});notes.setValue(current?.description||current?.variantDescription||'');tagFields.setValue(current||{});
  presentation();
 }
 function presentation(){
  dialog.querySelector('h2').textContent=operation==='edit'?'Edit variant':operation==='variant'?'Create variant':'New variant';
  dialog.querySelector('[data-description]').textContent=operation==='edit'?'Changes apply to every workout using this exercise.':operation==='variant'?'Creates a new catalog variant. Other workouts are unchanged.':'Save a reusable variant with its muscle mappings.';
  dialog.querySelector('[data-family-field]').hidden=operation!=='create'||Boolean(referenceId);
  save.textContent=operation==='edit'?'Save changes':'Save variant';familyVisibility();
  referenceLabel.hidden=operation==='create'&&!referenceId;
  referenceLabel.textContent='Reference exercise: '+(families.find(r=>r.id===(referenceId||current?.familyId))?.name||current?.familyName||'');
  updateSave();
 }
 async function refreshCreationReference(){
  if(refreshingReference)return;
  refreshingReference=true;updateSave();
  try{
   const selected=targetReferenceId(),data=await api.catalog();if(closed)return;
   families=data.families;tags=data.tags||[];tagFields.setTags(tags);
   if(referenceId)referenceRevision=families.find(r=>r.id===referenceId)?.revision;
   fields.family.replaceChildren(new Option('New reference exercise',''));
   for(const r of families.filter(r=>(!r.archived&&r.equipment)||r.id===selected)){
    const option=new Option(r.name+(r.archived?' (Archived)':''),r.id);option.disabled=r.archived||!r.equipment;fields.family.add(option);
   }
   if(selected&&!families.some(r=>r.id===selected)){const option=new Option('Unavailable reference exercise',selected);option.disabled=true;fields.family.add(option);}
   fields.family.value=selected||'';presentation();
   error.textContent=referenceUnavailable()?'Restore the reference exercise first.':'';
  }catch(e){if(!closed)error.textContent=e.message;}
  finally{refreshingReference=false;if(!closed){recovery.replaceChildren(button(operation==='edit'?'Refresh catalog':'Refresh reference exercise',refreshCreationReference));updateSave();}}
 }
 async function preview(){
  if(operation!=='edit')return;
  save.disabled=true;usageReady=false;
  try {impact=await api.catalogImpact(current.id);if(closed)return;usageReady=true;dialog.querySelector('[data-impact]').textContent=impact.reduce((n,r)=>n+r.count,0)+' saved workout instance(s) will update.';}
  catch(e){if(!closed){error.textContent=e.message;recovery.replaceChildren(button('Retry usage preview',()=>{error.textContent='';recovery.replaceChildren();preview();}));}}
  finally{if(!closed)save.disabled=!usageReady;}
 }
 async function submit(event){
  event.preventDefault();if(saving||refreshingReference)return;
  if(referenceUnavailable()){error.textContent='Choose a configured active reference exercise. Restore it or set its equipment first.';recovery.replaceChildren(button('Refresh reference exercise',refreshCreationReference));return;}
  if(operation==='edit'&&!usageReady){error.textContent='Load the usage preview before saving shared changes.';return;}
  const definition={name:fields.exerciseName.value,...muscles.getValue(),description:notes.getValue(),...tagFields.getValue()};
  const validated=validateCatalogEntry(definition);if(validated.error){error.textContent=validated.error;return;}
  if(operation==='create'&&!referenceId&&!fields.family.value&&!fields.familyName.value.trim()){error.textContent='Enter a reference exercise name.';fields.familyName.focus();return;}
  if(operation==='create'&&!referenceId&&!fields.family.value&&!fields.referenceType.value){error.textContent='Choose Compound or Isolation.';fields.referenceType.focus();return;}
  const creatingReference=operation==='create'&&!referenceId&&!fields.family.value;
  if(creatingReference&&!equipment.getValue()){error.textContent='Choose equipment for the reference exercise.';dialog.querySelector('[type=radio]').focus();return;}
  const defaults=referenceMuscles.getValue();
  saving=true;save.disabled=true;error.textContent='';recovery.replaceChildren();dialog.querySelector('[data-cancel]').disabled=true;
  try{
   const saved=operation==='edit'?await api.updateCatalog({id:current.id,revision:current.revision,entry:validated.entry,impact}):await api.createCatalog({id,sourceVariantId:operation==='variant'?current?.id:undefined,reference:creatingReference?{equipment:equipment.getValue(),description:referenceNotes.getValue(),defaultPrimaryMuscles:defaults.primaryMuscles,defaultSecondaryMuscles:defaults.secondaryMuscles}:undefined,familyId:referenceId||(operation==='variant'?current.familyId:fields.family.value||newFamilyId),familyName:operation==='create'&&!referenceId&&!fields.family.value?fields.familyName.value:undefined,referenceExerciseType:operation==='create'&&!referenceId&&!fields.family.value?fields.referenceType.value:undefined,referenceRevision:referenceRevision??families.find(r=>r.id===(operation==='variant'?current.familyId:fields.family.value))?.revision,entry:validated.entry});
   invalidateCatalog(api);if(closed)return;await onSaved(saved);close();
  }catch(e){
   if(closed)return;error.textContent=e.message;
   if(e.status===409&&operation==='edit'){
    recovery.append(button('Reload saved version',async()=>{try{const data=await api.catalog();if(closed)return;families=data.families;tags=data.tags||[];tagFields.setTags(tags);current=data.entries.find(e=>e.id===current.id);if(!current)throw Error('Exercise not found.');populate();error.textContent='';recovery.replaceChildren();await preview();}catch(err){error.textContent=err.message;}}));
    recovery.append(button('Save as variant',()=>{operation='variant';id=crypto.randomUUID();presentation();dialog.querySelector('[data-impact]').textContent='';error.textContent='Give this variant a distinct name, then save.';recovery.replaceChildren();fields.exerciseName.focus();}));
    recovery.append(button('Refresh usage preview',()=>{recovery.replaceChildren();error.textContent='';preview();}));
   }else if(operation==='edit'&&e.status===400)recovery.append(button('Refresh catalog',refreshCreationReference));
   else if(operation!=='edit'&&targetReferenceId()&&(e.status===409||e.status===400))recovery.append(button('Refresh reference exercise',refreshCreationReference));
   else recovery.append(button('Retry',()=>form.requestSubmit()));
  }finally{saving=false;if(!closed){updateSave();dialog.querySelector('[data-cancel]').disabled=false;}}
 }
 form.onsubmit=submit;populate();motion.open();fields.exerciseName.focus();preview();
 return {destroy(){closed=true;motion.destroy();}};
}
