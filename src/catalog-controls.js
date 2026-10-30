import {MUSCLE_GROUPS} from './muscles.js';

export function mountMuscleChoices(root,{primary=[],secondary=[],primaryLabel='Primary muscles',secondaryLabel='Secondary muscles',onChange=()=>{}}={}){
 const container=document.createElement('div');container.className='catalog-muscles';
 for(const [role,label]of [['primary',primaryLabel],['secondary',secondaryLabel]]){
  const group=document.createElement('fieldset');group.className=role;const legend=document.createElement('legend');legend.textContent=label;const chips=document.createElement('div');chips.className='chips';group.append(legend,chips);container.append(group);
  for(const muscle of MUSCLE_GROUPS){const chip=document.createElement('label');chip.className='chip';const input=document.createElement('input');input.type='checkbox';input.value=muscle;input.dataset.role=role;const span=document.createElement('span');span.textContent=muscle;chip.append(input,span);chips.append(chip);
   input.onchange=()=>{if(input.checked)for(const other of container.querySelectorAll('input'))if(other!==input&&other.value===muscle)other.checked=false;onChange();};
  }
 }
 root.append(container);
 const setValue=({primaryMuscles=[],secondaryMuscles=[]})=>{for(const input of container.querySelectorAll('input'))input.checked=(input.dataset.role==='primary'?primaryMuscles:secondaryMuscles).includes(input.value);};
 setValue({primaryMuscles:primary,secondaryMuscles:secondary});
 return {setValue,getValue:()=>({primaryMuscles:[...container.querySelectorAll('input[data-role=primary]:checked')].map(i=>i.value),secondaryMuscles:[...container.querySelectorAll('input[data-role=secondary]:checked')].map(i=>i.value)})};
}

export function mountDisclosure(root,{label,opened=false}){
 const wrapper=document.createElement('div');wrapper.className='catalog-disclosure';const id='catalog-disclosure-'+crypto.randomUUID(),button=document.createElement('button');button.type='button';button.className='secondary-btn disclosure-toggle';button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';button.append(document.createTextNode(label));
 const region=document.createElement('div');region.className='catalog-disclosure-region';region.id=id;const clip=document.createElement('div');clip.className='catalog-disclosure-clip';const content=document.createElement('div');content.className='catalog-disclosure-content';clip.append(content);region.append(clip);button.setAttribute('aria-controls',id);wrapper.append(button,region);root.append(wrapper);
 function setExpanded(next,{animate=false}={}){if(!next&&region.contains(document.activeElement))button.focus({preventScroll:true});if(animate)wrapper.dataset.motion='';opened=next;button.setAttribute('aria-expanded',String(next));region.inert=!next;region.setAttribute('aria-hidden',String(!next));wrapper.classList.toggle('is-open',next);}
 button.onclick=()=>setExpanded(!opened,{animate:true});setExpanded(opened);
 return {content,setExpanded};
}
export function mountDescriptionField(root,{label,value='',name}){
 const field=document.createElement('label');field.className='field';field.append(document.createTextNode(label+' (optional)'));const input=document.createElement('textarea');input.name=name;input.maxLength=2000;input.rows=3;input.value=value;field.append(input);root.append(field);
 return {getValue:()=>input.value,setValue(value){input.value=value||'';},input};
}

export function mountVariantTags(root,{tags=[],brandId=null,focusTagIds=[]}={}){
 const container=document.createElement('div');container.className='variant-tag-fields';
 const brandGroup=document.createElement('fieldset'),brandLegend=document.createElement('legend');brandLegend.textContent='Brand';
 const brandSearchLabel=document.createElement('label');brandSearchLabel.className='field';brandSearchLabel.append(document.createTextNode('Filter Brand tags'));const brandSearch=document.createElement('input');brandSearch.type='search';brandSearch.autocomplete='off';brandSearchLabel.append(brandSearch);
 const brand=document.createElement('div');brand.className='chips';brandGroup.append(brandLegend,brandSearchLabel,brand);container.append(brandGroup);const brandNodes=new Map();
 const focus=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Focus';const search=document.createElement('input');search.type='search';search.name='focusSearch';search.autocomplete='off';search.setAttribute('aria-label','Search Focus tags');const searchLabel=document.createElement('label');searchLabel.className='field';searchLabel.append(document.createTextNode('Filter Focus tags'),search);const choices=document.createElement('div');choices.className='chips';focus.append(legend,searchLabel,choices);container.append(focus);root.append(container);
 let selectedBrand=brandId,selectedFocus=new Set(focusTagIds);
 function render(){
  const filterable=tags.filter(t=>t.kind==='focus'&&(!t.archived||selectedFocus.has(t.id))).length>8;searchLabel.hidden=!filterable;if(!filterable)search.value='';
  const available=tags.filter(t=>t.kind==='brand'&&(!t.archived||t.id===selectedBrand));brandSearchLabel.hidden=available.length<=8;if(brandSearchLabel.hidden)brandSearch.value='';
  const brands=[{id:'',name:'No Brand'},...available],retained=new Set(brands.map(t=>t.id));
  for(const [id,node]of brandNodes)if(!retained.has(id)){node.remove();brandNodes.delete(id);}
  brands.forEach((tag,index)=>{
   let node=brandNodes.get(tag.id);
   if(!node){node=document.createElement('label');node.className='chip';const input=document.createElement('input');input.type='radio';input.name='brandId';input.value=tag.id;const span=document.createElement('span');node.append(input,span);brandNodes.set(tag.id,node);input.onchange=()=>{selectedBrand=input.value||null;render();};}
   const input=node.querySelector('input');input.checked=tag.id===(selectedBrand||'');node.querySelector('span').textContent=tag.name+(tag.archived?' (Archived)':'');node.hidden=Boolean(tag.id&&brandSearch.value&&!tag.name.toLocaleLowerCase().includes(brandSearch.value.toLocaleLowerCase()));
   if(brand.children[index]!==node)brand.insertBefore(node,brand.children[index]||null);
  });
  choices.replaceChildren();
  for(const tag of tags.filter(t=>t.kind==='focus'&&(!t.archived||selectedFocus.has(t.id)))){
   const label=document.createElement('label');label.className='chip';label.hidden=Boolean(search.value&&!tag.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));const input=document.createElement('input');input.type='checkbox';input.checked=selectedFocus.has(tag.id);input.value=tag.id;input.name='focusTagIds';const span=document.createElement('span');span.textContent=tag.name+(tag.archived?' (Archived)':'');label.append(input,span);choices.append(label);input.onchange=()=>{if(input.checked)selectedFocus.add(tag.id);else selectedFocus.delete(tag.id);if(tag.archived)render();};
  }
 }
 brandSearch.oninput=render;search.oninput=render;render();
 return {getValue:()=>({brandId:selectedBrand,focusTagIds:[...selectedFocus]}),setValue(value){selectedBrand=value.brandId??value.brand?.id??null;selectedFocus=new Set(value.focusTagIds??value.focusTags?.map(t=>t.id).filter(Boolean)??[]);render();},setTags(value){tags=value;render();}};
}
