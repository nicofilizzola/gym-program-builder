import {EQUIPMENT} from './catalog.js';
const paths={
 Barbell:'<path d="M2 9v6m3-9v12m14-12v12m3-9v6M5 12h14"/>',
 Dumbbell:'<path d="m5 3-2 2 16 16 2-2M2 8l6-6M16 22l6-6M5 11l6-6M13 19l6-6"/>',
 Cable:'<circle cx="12" cy="5" r="3"/><path d="M12 8v10m-5 3 5-3 5 3M5 3H2v18h3"/>',
 Machine:'<path d="M4 21V3h13v18M4 8h13m-9 4h5v4H8m-5 5h17M17 7l4 5"/>',
 Bodyweight:'<circle cx="12" cy="4" r="2"/><path d="m4 9 8 2 8-2m-8 2v5m0 0-5 6m5-6 5 6"/>',
 Kettlebell:'<path d="M8 9V6a4 4 0 0 1 8 0v3"/><path d="M6 12a6 6 0 0 1 12 0l2 6a3 3 0 0 1-3 4H7a3 3 0 0 1-3-4Z"/>',
 'Resistance band':'<path d="M7 3c-6 0-6 18 0 18h10c6 0 6-18 0-18Zm0 4c-2 0-2 10 0 10h10c2 0 2-10 0-10Z"/>',
 Other:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
};
export function mountEquipmentPills(root,{name='equipment',value='',onChange=()=>{}}={}){
 const fieldset=document.createElement('fieldset');fieldset.className='equipment-pills';const legend=document.createElement('legend');legend.textContent='Equipment';fieldset.append(legend);
 for(const equipment of EQUIPMENT){
  const label=document.createElement('label');label.className='chip';const input=document.createElement('input');input.type='radio';input.name=name;input.value=equipment;input.checked=value===equipment;
  const span=document.createElement('span');span.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[equipment]+'</svg>';
  span.append(document.createTextNode(equipment));label.append(input,span);fieldset.append(label);input.onchange=()=>{if(input.checked)onChange(equipment);};
 }
 root.append(fieldset);return {
  getValue:()=>fieldset.querySelector('input:checked')?.value||'',
  setValue(value){for(const input of fieldset.querySelectorAll('input'))input.checked=input.value===value;},
  setDisabled(value){fieldset.disabled=value;},destroy(){fieldset.remove();},
 };
}
