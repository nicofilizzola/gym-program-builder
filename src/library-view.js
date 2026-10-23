export function mountLibrary(root,{kind,records,onCreate,onOpen,onDuplicate,onDelete,onImport,onExport}) {
  root.innerHTML='<section class="library"><p class="eyebrow">Gym Program Builder</p><h1></h1><div class="toolbar"><button class="add-btn" data-new></button><button class="secondary-btn" data-import>Import</button><input data-file type="file" accept=".json,application/json" hidden></div><div data-items></div><p data-empty class="empty"></p></section>';
  const plural=kind==='program'?'Programs':'Session templates';root.querySelector('h1').textContent=plural;
  root.querySelector('[data-new]').textContent=kind==='program'?'New program':'New session template';
  root.querySelector('[data-new]').onclick=onCreate;
  const file=root.querySelector('[data-file]');root.querySelector('[data-import]').onclick=()=>file.click();file.onchange=()=>{if(file.files[0])onImport(file.files[0]);file.value='';};
  function update(items) {
    const container=root.querySelector('[data-items]');container.replaceChildren();
    root.querySelector('[data-empty]').textContent=items.length?'':`No ${plural.toLowerCase()} yet. Create one to get started.`;
    for(const record of items) {
      const name=record.name.trim()||(kind==='program'?'Untitled program':'Untitled template');
      const article=document.createElement('article');article.className='library-item';
      const title=document.createElement('h2');title.textContent=name;article.append(title);
      const actions=document.createElement('div');actions.className='item-actions';article.append(actions);
      for(const [label,callback] of [['Open',onOpen],['Duplicate',onDuplicate],['Export',onExport],['Delete',onDelete]]) {
        const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent=label;button.setAttribute('aria-label',`${label} ${name}`);button.onclick=()=>callback(record);actions.append(button);
      }
      container.append(article);
    }
  }
  update(records);return {update,destroy(){root.replaceChildren();}};
}
