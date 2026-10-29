export function mountBreadcrumbs(root,{items,onNavigate}={}){
 const nav=document.createElement('nav');nav.className='breadcrumbs';nav.setAttribute('aria-label','Breadcrumb');root.prepend(nav);let fingerprint='',destroyed=false;
 function update(next){
  if(destroyed)return;const key=JSON.stringify(next);if(key===fingerprint)return;fingerprint=key;const list=document.createElement('ol');
  next.forEach((item,index)=>{
   const li=document.createElement('li');
   if(index){const separator=document.createElementNS('http://www.w3.org/2000/svg','svg');separator.setAttribute('viewBox','0 0 12 12');separator.setAttribute('aria-hidden','true');separator.innerHTML='<path d="m4 2 4 4-4 4"/>';li.append(separator);}
   const current=index===next.length-1,node=document.createElement(current||!item.href?'span':'a');node.textContent=item.label;
   if(current)node.setAttribute('aria-current','page');else if(item.href){node.href=item.href;node.onclick=e=>{if(onNavigate&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onNavigate(item.href);}};}
   li.append(node);list.append(li);
  });nav.replaceChildren(list);
 }
 update(items||[]);return {update,destroy(){destroyed=true;nav.remove();}};
}
