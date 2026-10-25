export function parseRoute(hash) {
  if(/^#?\/catalog$/.test(hash))return {view:'catalog'};
  const match=/^#?\/(programs|templates)(?:\/([\w-]+))?$/.exec(hash||'#/programs');
  if(!match)return {view:'not-found'};
  return {view:match[2]?(match[1]==='programs'?'program':'template'):match[1],...(match[2]?{id:match[2]}:{})};
}
