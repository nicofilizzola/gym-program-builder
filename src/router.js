export function resolveEntryHash(hash,{mobile=false}={}){
 return ['', '#', '/', '#/'].includes(String(hash||''))?(mobile?'#/home':'#/programs'):hash;
}
export function parseRoute(hash) {
  const [path,query='']=String(hash||'').split('?');hash=path;
  if(/^#?\/catalog\/tags$/.test(hash)){const params=new URLSearchParams(query),kind=params.get('kind')||'brand';return ['brand','focus'].includes(kind)?{view:'catalog-tags',kind,query:params.get('q')||''}:{view:'not-found'};}
  const catalog=/^#?\/catalog\/references\/([\w-]+)(?:\/variants\/([\w-]+))?$/.exec(hash);
  if(catalog)return catalog[2]?{view:'catalog-variant',referenceId:catalog[1],variantId:catalog[2]}:{view:'catalog-reference',referenceId:catalog[1]};
  const workout=/^#?\/programs\/([\w-]+)\/workouts\/([\w-]+)$/.exec(hash);
  if(workout)return {view:'program-workout',id:workout[1],occurrenceId:workout[2]};
  if(/^#?\/catalog$/.test(hash))return {view:'catalog'};
  if(/^#?\/profile$/.test(hash))return {view:'profile'};
  if(/^#?\/user$/.test(hash))return {view:'user'};
  if(/^#?\/home$/.test(hash))return {view:'home'};
  if(/^#?\/workouts$/.test(hash))return {view:'workouts'};
  const log=/^#?\/workouts\/([\w-]+)$/.exec(hash);
  if(log)return {view:'workout',id:log[1]};
  const match=/^#?\/(programs|templates)(?:\/([\w-]+))?$/.exec(hash||'#/programs');
  if(!match)return {view:'not-found'};
  return {view:match[2]?(match[1]==='programs'?'program':'template'):match[1],...(match[2]?{id:match[2]}:{})};
}
