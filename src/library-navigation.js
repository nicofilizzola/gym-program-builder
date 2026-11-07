export function mountLibraryNavigation(host,{hash,onNavigate}){
 const section=document.createElement('div');section.className='library-navigation';
 section.innerHTML='<h2>Library</h2><nav aria-label="Library sections"></nav>';
 const events=new AbortController();
 for(const [label,href] of [['Programs','#/programs'],['Templates','#/templates'],['Exercises','#/catalog']]){
  const a=document.createElement('a');a.href=href;a.textContent=label;if(hash===href)a.setAttribute('aria-current','page');
  a.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onNavigate(href);},{signal:events.signal});
  section.querySelector('nav').append(a);
 }
 host.prepend(section);return {destroy(){events.abort();section.remove();}};
}
