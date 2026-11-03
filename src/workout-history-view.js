import {formatElapsed} from './workout-sets.js';

const pad=n=>String(n).padStart(2,'0');
const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

/** Groups summaries (already newest first) by the local calendar day of startedAt. */
export function groupByLocalDate(summaries) {
  const groups=[];
  for(const item of summaries){
    const started=new Date(item.startedAt),date=localDate(started);
    let group=groups.at(-1);
    if(!group||group.date!==date){
      group={date,label:started.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'}),items:[]};groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

const sourceText=source=>source?.kind==='program'?`${source.programName} · ${source.templateName}`:source?.kind==='template'?source.templateName:'Blank';

/** History of finished workouts, newest first, with an optional unsynced local workout on top. */
export function mountWorkoutHistory(root,{records,hasMore,pending=null,onLoadMore,onStartBlank,onOpen,workoutHref}) {
  const page=document.createElement('section');page.className='workout-history';
  page.innerHTML='<header class="library-heading"><h1>Workouts</h1><div class="toolbar library-toolbar"><button type="button" class="add-btn" data-start>Start blank workout</button></div></header><div data-pending></div><div data-groups></div><p class="empty" data-empty hidden>No workouts yet. Start one from a program, a session template or here.</p><p class="error" role="alert" data-error></p><div class="workout-history-more"><button type="button" class="secondary-btn" data-more hidden>Load more</button></div>';
  const groupsHost=page.querySelector('[data-groups]'),pendingHost=page.querySelector('[data-pending]'),empty=page.querySelector('[data-empty]'),
    more=page.querySelector('[data-more]'),error=page.querySelector('[data-error]'),events=new AbortController(),{signal}=events;
  let loaded=[...records],more_=hasMore,destroyed=false,loading=false;

  function row(item,{unsynced=false}={}) {
    const li=document.createElement('li');li.className='workout-history-row';
    const started=new Date(item.startedAt),finished=item.finishedAt?new Date(item.finishedAt):null;
    const link=document.createElement('a');link.href=workoutHref(item.id);link.textContent=item.name;
    link.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();onOpen(item.id);
    },{signal});
    const title=document.createElement('h3');title.append(link);
    const meta=document.createElement('p');meta.className='workout-history-meta';
    const parts=[sourceText(item.source),started.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}),
      ...(finished?[formatElapsed(finished-started)]:[]),`${item.doneSets} ${item.doneSets===1?'set':'sets'}`];
    parts.forEach(text=>{const span=document.createElement('span');span.textContent=text;meta.append(span);});
    li.append(title);
    if(unsynced){const tag=document.createElement('span');tag.className='workout-history-unsynced';tag.textContent='Not synced yet';li.append(tag);}
    li.append(meta);
    return li;
  }

  function render() {
    groupsHost.replaceChildren();pendingHost.replaceChildren();
    if(pending){const list=document.createElement('ul');list.className='workout-history-list';list.append(row(pending,{unsynced:true}));pendingHost.append(list);}
    for(const group of groupByLocalDate(loaded)){
      const section=document.createElement('section'),heading=document.createElement('h2'),list=document.createElement('ul');
      heading.className='workout-history-day';heading.textContent=group.label;list.className='workout-history-list';
      list.append(...group.items.map(item=>row(item)));section.append(heading,list);groupsHost.append(section);
    }
    empty.hidden=Boolean(loaded.length||pending);more.hidden=!more_;
  }

  page.querySelector('[data-start]').addEventListener('click',()=>onStartBlank?.(),{signal});
  more.addEventListener('click',async()=>{
    if(loading)return;loading=true;more.disabled=true;error.textContent='';
    try{
      const result=await onLoadMore(loaded.at(-1));
      if(destroyed)return;
      loaded=[...loaded,...result.records];more_=result.hasMore;
      const had=document.activeElement===more;render();
      if(had&&!more.hidden)more.focus();else if(had)page.querySelector('[data-start]').focus();
    }catch(e){if(!destroyed)error.textContent=e.message||'Could not load more workouts.';}
    finally{loading=false;more.disabled=false;}
  },{signal});

  render();root.append(page);
  return {destroy(){destroyed=true;events.abort();page.remove();}};
}
