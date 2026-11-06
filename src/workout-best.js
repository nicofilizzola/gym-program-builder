/** Positive when a ranks above b. Inputs are validated historical candidates. */
const compare=(a,b)=>a.weightKg-b.weightKg||a.reps-b.reps||Date.parse(a.finishedAt)-Date.parse(b.finishedAt)||(a.logId>b.logId?1:a.logId<b.logId?-1:0);

/** One winner per exact rep count keeps every possible range winner, bounded to 100. */
export function bestPerRep(candidates){
 const winners=new Map();
 for(const candidate of candidates){
  const old=winners.get(candidate.reps);
  if(!old||compare(candidate,old)>0)winners.set(candidate.reps,candidate);
 }
 return [...winners.values()].sort((a,b)=>a.reps-b.reps);
}

export function selectBestPerformance(candidates,repRange=null){
 let best=null;
 for(const candidate of candidates){
  if(repRange&&(candidate.reps<repRange.min||candidate.reps>repRange.max))continue;
  if(!best||compare(candidate,best)>0)best=candidate;
 }
 return best;
}
