export function mountBreadcrumbs(root,{items=[],mobileParent=null,onNavigate}={}){
 const nav=document.createElement('nav'),list=document.createElement('ol'),mobile=matchMedia('(max-width:760px)');
 nav.className='breadcrumbs';nav.setAttribute('aria-label','Breadcrumb');nav.append(list);root.prepend(nav);
 let records=new Map(),destroyed=false;
 function icon(path,className){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 12 12');svg.setAttribute('aria-hidden','true');svg.setAttribute('class',className);svg.innerHTML='<path d="'+path+'"/>';return svg;}
 function restoreFocus(focused){
  if(!focused||focused.getClientRects().length)return;
  const parent=list.querySelector('.breadcrumb-parent a'),target=parent?.getClientRects().length?parent:root.querySelector('h1');
  if(target){if(target!==parent)target.tabIndex=-1;target.focus({preventScroll:true});}
 }
 function present(){
  const focused=nav.contains(document.activeElement)?document.activeElement:null;
  nav.classList.toggle('is-compact',mobile.matches);
  nav.hidden=!items.length&&(!mobile.matches||!mobileParent);
  for(const record of records.values()){
   const compact=mobile.matches&&record.parent;
   record.label.textContent=compact?mobileParent.label:record.item.label;
   if(compact)record.node.setAttribute('aria-label','Back to '+mobileParent.label);else record.node.removeAttribute('aria-label');
  }
  restoreFocus(focused);
 }
 function update(next,{mobileParent:parent=mobileParent}={}){
  if(destroyed)return;items=next;mobileParent=parent;
  const focused=nav.contains(document.activeElement)?document.activeElement:null,previous=records;records=new Map();
  const entries=items.map((item,index)=>({item,current:index===items.length-1}));
  if(mobileParent&&!entries.some(({item,current})=>!current&&item.href===mobileParent.href))entries.push({item:mobileParent,mobileOnly:true});
  entries.forEach(({item,current,mobileOnly=false},index)=>{
   const link=!current&&item.href,key=link?'link:'+item.href:'current:'+index;
   let record=previous.get(key);
   if(!record){
    const li=document.createElement('li'),separator=icon('m4 2 4 4-4 4','breadcrumb-separator'),node=document.createElement(link?'a':'span'),label=document.createElement('span');
    if(link){node.href=item.href;node.append(icon('m8 2-4 4 4 4','breadcrumb-back-arrow'));node.onclick=e=>{if(onNavigate&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onNavigate(node.getAttribute('href'));}};}
    node.append(label);li.append(separator,node);record={li,node,label,separator};
   }
   previous.delete(key);records.set(key,record);record.item=item;record.parent=!!link&&item.href===mobileParent?.href;
   record.li.classList.toggle('breadcrumb-parent',record.parent);record.li.classList.toggle('breadcrumb-mobile-only',mobileOnly);record.separator.style.display=index&&!mobileOnly?'':'none';
   if(current)record.node.setAttribute('aria-current','page');else record.node.removeAttribute('aria-current');
   if(list.children[index]!==record.li)list.insertBefore(record.li,list.children[index]||null);
  });
  for(const record of previous.values())record.li.remove();
  present();restoreFocus(focused);
 }
 mobile.addEventListener('change',present);update(items);
 return {update,destroy(){destroyed=true;mobile.removeEventListener('change',present);nav.remove();}};
}
