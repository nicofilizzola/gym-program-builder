import {actionIcon,mountActionTooltips} from './action-controls.js';

export function mountLibrary(root,{kind,records,recordHref,onCreate,onOpen,onDuplicate,onDelete,onImport,onExport,onStartWorkout,activeProgramId=null,onToggleActive}) {
  let activeId=activeProgramId,shown=records;
  root.innerHTML='<section class="library"><header class="library-heading"><h1></h1><div class="toolbar library-toolbar"><button type="button" class="add-btn" data-new></button><button type="button" class="secondary-btn" data-import></button><input data-file type="file" accept=".json,application/json" hidden></div></header><div data-items></div><p data-empty class="empty"></p></section>';
  const plural=kind==='program'?'Programs':'Session templates';root.querySelector('h1').textContent=plural;
  const create=root.querySelector('[data-new]');create.innerHTML=actionIcon('plus');create.append(kind==='program'?'New program':'New session template');create.onclick=onCreate;
  const importButton=root.querySelector('[data-import]');importButton.innerHTML=actionIcon('import');importButton.append('Import');
  const file=root.querySelector('[data-file]');importButton.onclick=()=>file.click();file.onchange=()=>{if(file.files[0])onImport(file.files[0]);file.value='';};
  const tooltips=mountActionTooltips(root);
  /** `options.activeProgramId` (programs) badges that card and lists it first; the rest keep their order. */
  function update(items,options={}) {
    if(Object.hasOwn(options,'activeProgramId'))activeId=options.activeProgramId;
    shown=items;tooltips.hide();
    const active=items.find(item=>item.id===activeId);
    if(active)items=[active,...items.filter(item=>item!==active)];
    const container=root.querySelector('[data-items]');container.replaceChildren();
    root.querySelector('[data-empty]').textContent=items.length?'':`No ${plural.toLowerCase()} yet. Create one to get started.`;
    for(const record of items) {
      const name=record.name.trim()||(kind==='program'?'Untitled program':'Untitled template');
      const article=document.createElement('article');article.className='library-item';
      const title=document.createElement('h2'),link=document.createElement('a');link.textContent=name;link.href=recordHref(record);
      link.onclick=event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onOpen(record);};
      title.append(link);article.append(title);
      const isActive=record===active;
      if(isActive){const badge=document.createElement('span');badge.className='library-badge';badge.textContent='Active';title.append(badge);}
      const actions=document.createElement('div');actions.className='item-actions';article.append(actions);
      if(kind==='program'&&onToggleActive){
        const star=document.createElement('button');star.type='button';star.className='action-button active-program-toggle';star.innerHTML=actionIcon(isActive?'star-filled':'star');
        star.dataset.actionTooltip=isActive?'Active program':'Set as active program';star.setAttribute('aria-label',`Active program ${name}`);star.setAttribute('aria-pressed',String(isActive));
        star.onclick=()=>onToggleActive(record);actions.append(star);
      }
      if(kind==='template'&&onStartWorkout){
        const start=document.createElement('button');start.type='button';start.className='action-button';start.innerHTML=actionIcon('start');
        start.dataset.actionTooltip='Start workout';start.setAttribute('aria-label',`Start workout ${name}`);start.onclick=()=>onStartWorkout(record);actions.append(start);
      }
      for(const [label,callback] of [['Duplicate',onDuplicate],['Export',onExport],['Delete',onDelete]]) {
        const button=document.createElement('button');button.type='button';button.className=`action-button${label==='Delete'?' action-button--delete':''}`;
        button.innerHTML=actionIcon(label.toLowerCase());button.dataset.actionTooltip=label;button.setAttribute('aria-label',`${label} ${name}`);button.onclick=()=>callback(record);actions.append(button);
      }
      container.append(article);
    }
  }
  update(records);return {update,destroy(){tooltips.destroy();root.replaceChildren();}};
}
