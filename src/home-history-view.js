import {groupByLocalDate,historyRow} from './workout-history-view.js';

export const canAutoLoad=({nearEnd,phase,hasMore,loadingMore,moreError})=>Boolean(nearEnd&&phase==='ready'&&hasMore&&!loadingMore&&!moreError);

export function mountHomeHistory(root,{onOpen,workoutHref,onRetry,onLoadMore}){
 const page=document.createElement('section');page.className='home-history';page.setAttribute('aria-labelledby','home-history-title');
 page.innerHTML='<h2 id="home-history-title" tabindex="-1">History</h2><div data-pending></div><div class="home-history-status"><p role="status"></p><button type="button" class="secondary-btn" aria-label="Retry loading history" hidden>Retry</button></div><div data-groups></div><p class="home-history-empty" hidden>No workouts yet. Your finished workouts appear here.</p><div class="home-history-end"></div>';
 root.append(page);
 const $=selector=>page.querySelector(selector),heading=$('h2'),pending=$('[data-pending]'),groups=$('[data-groups]'),status=$('[role=status]'),retry=$('button'),empty=$('.home-history-empty'),end=$('.home-history-end'),events=new AbortController();
 const endStatus=document.createElement('p'),more=document.createElement('button');endStatus.setAttribute('role','status');more.type='button';more.className='secondary-btn';
 more.addEventListener('click',()=>{if(!state.loadingMore)onLoadMore();},{signal:events.signal});
 let state={phase:'loading'},requested=false;
 const row=(item,unsynced=false)=>historyRow(item,{unsynced,titleTag:'h4',onOpen,workoutHref,signal:events.signal});
 function autoLoad(){const rect=end.getBoundingClientRect();if(!requested&&canAutoLoad({nearEnd:rect.top<=innerHeight*2&&rect.bottom>=0,phase:state.phase,hasMore:state.data?.hasMore,loadingMore:state.loadingMore,moreError:state.moreError})){requested=true;onLoadMore();}}
 const observer=new IntersectionObserver(autoLoad,{rootMargin:'0px 0px 100% 0px'});
 observer.observe(end);retry.addEventListener('click',onRetry,{signal:events.signal});
 function setState(next){
  const previousCount=state.data?.records.length??0;state=next;requested=false;
  const focused=document.activeElement,href=page.contains(focused)?focused.closest('a')?.getAttribute('href'):null;
  pending.replaceChildren();groups.replaceChildren();
  if(state.pending){const list=document.createElement('ul');list.className='workout-history-list';list.append(row(state.pending,true));pending.append(list);}
  for(const group of groupByLocalDate(state.data?.records??[])){
   const section=document.createElement('section'),day=document.createElement('h3'),list=document.createElement('ul');
   day.className='workout-history-day';day.textContent=group.label;list.className='workout-history-list';
   list.append(...group.items.map(item=>row(item)));section.append(day,list);groups.append(section);
  }
  status.textContent=state.error?(state.data?"Couldn't refresh. Showing previously loaded data.":'Workouts could not be loaded. Connect to see your history.'):state.phase==='loading'?'Loading…':'';
  status.hidden=!status.textContent;retry.hidden=!state.error;
  empty.hidden=state.phase!=='ready'||Boolean(state.error||state.pending||state.data?.records.length);
  endStatus.textContent=state.loadingMore?'Loading…':state.moreError?"Couldn't load older workouts.":'';
  if(endStatus.textContent){if(!endStatus.isConnected)end.prepend(endStatus);}else endStatus.remove();
  more.textContent=state.moreError?'Retry':'Load more';more.setAttribute('aria-disabled',String(Boolean(state.loadingMore)));
  if(state.moreError||state.data?.hasMore){if(!more.isConnected)end.append(more);}else{
   more.remove();
   if(focused===more){const links=groups.querySelectorAll('.workout-history-row a');(links[Math.min(previousCount,links.length-1)]||heading).focus({preventScroll:true});}
  }
  if(href)(page.querySelector('a[href="'+CSS.escape(href)+'"]')||heading).focus({preventScroll:true});
  autoLoad();
 }
 return {setState,heading,getNavigationState:()=>({visibleCount:state.data?.records.length??0}),destroy(){events.abort();observer.disconnect();page.remove();}};
}
