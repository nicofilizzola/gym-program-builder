import {supersetBlocks} from './superset.js';

export const setKey=ref=>JSON.stringify([ref.exerciseId,ref.setId]);
const working=ex=>ex.sets.filter(s=>s.kind!=='warmup');

/** A read-only projection: the log retains exercise grouping, the feed follows execution. */
export function projectWorkout(log){
 const items=[],doneKeys=new Set();let pair=0;
 function add(ex,index,set,pairId=null,member=null,round=null,hasPartner=true){
  const kind=set.kind||'working',same=ex.sets.filter(s=>(s.kind||'working')===kind),kindIndex=same.indexOf(set)+1;
  const ref={exerciseId:ex.id,setId:set.id},key=setKey(ref);
  const label=kind==='warmup'?`Warm-up ${kindIndex}`:member?`${member} · Round ${round}${hasPartner?'':' · No partner set this round'}`:`Working set ${kindIndex} of ${same.length}`;
  const previous=items.at(-1),eyebrow=previous?.ref.exerciseId===ex.id?'Next set':member?`Superset ${member}`:'Next exercise';
  items.push({key,ref,exerciseIndex:index,kind,kindIndex,pairId,member,round,preview:{eyebrow,label}});
  if(set.done)doneKeys.add(key);
 }
 for(const block of supersetBlocks(log.exercises)){
  const index=block.start,a=log.exercises[index];
  if(block.length===1){a.sets.forEach(s=>add(a,index,s));continue;}
  const b=log.exercises[index+1],letter=String.fromCharCode(65+pair++),aw=working(a),bw=working(b);
  a.sets.filter(s=>s.kind==='warmup').forEach(s=>add(a,index,s,a.id,`${letter}1`));
  b.sets.filter(s=>s.kind==='warmup').forEach(s=>add(b,index+1,s,a.id,`${letter}2`));
  for(let r=0;r<Math.max(aw.length,bw.length);r++){
   if(aw[r])add(a,index,aw[r],a.id,`${letter}1`,r+1,Boolean(bw[r]));
   if(bw[r])add(b,index+1,bw[r],a.id,`${letter}2`,r+1,Boolean(aw[r]));
  }
 }
 return {items,workingKeys:items.filter(i=>i.kind==='working').map(i=>i.key),doneKeys,current:items.find(i=>!doneKeys.has(i.key))?.ref??null};
}

export function focusFallback(previousItems,items,viewed){
 const keys=new Map(items.map(i=>[i.key,i.ref])),key=viewed&&setKey(viewed);
 if(key&&keys.has(key))return keys.get(key);
 const at=previousItems.findIndex(i=>i.key===key);
 if(at>=0){
  for(const item of previousItems.slice(at+1))if(keys.has(item.key))return keys.get(item.key);
  for(const item of previousItems.slice(0,at).reverse())if(keys.has(item.key))return keys.get(item.key);
 }
 return items[0]?.ref??null;
}

export function repRangeHint({kind,reps,range,invalid=false}){
 if(kind==='warmup'||!range||invalid)return null;
 const target=`${range.min}–${range.max} reps`;
 if(reps===null||reps===undefined)return {state:'target',delta:null,text:`Target ${target}`};
 if(!Number.isInteger(reps)||reps<1||reps>100)return null;
 if(reps<range.min)return {state:'below',delta:range.min-reps,text:`${range.min-reps} below target · Aim for ${target}`};
 if(reps>range.max)return {state:'above',delta:reps-range.max,text:`${reps-range.max} above target · Aim for ${target}`};
 return {state:'within',delta:0,text:`Within target · ${target}`};
}

export function repsCaption({kind,reps,range,invalid=false}){
 const hint=repRangeHint({kind,reps,range,invalid});if(!hint)return {text:'Reps',outside:false};
 const target=range.min===range.max?`${range.min}`:`${range.min}–${range.max}`,outside=hint.state==='below'||hint.state==='above';
 return {text:`Reps · ${outside?`${hint.delta} ${hint.state} `:''}${target}`,outside};
}

export function completionMilestone(before,after,ref){
 const p=projectWorkout(after),item=p.items.find(i=>i.key===setKey(ref)),ex=after.exercises.find(e=>e.id===ref.exerciseId);
 if(!item||!p.doneKeys.has(item.key))return {kind:'set',text:'Set reopened. Your values are retained.'};
 if(item.kind==='warmup')return {kind:'warmup',text:'Warm-up complete. Ready to build.'};
 const complete=e=>working(e).length>0&&working(e).every(s=>s.done);
 if(item.pairId){
  const at=after.exercises.findIndex(e=>e.id===item.pairId),members=after.exercises.slice(at,at+2);
  if(members.every(complete))return {kind:'pair',text:'Superset complete. Strong work.'};
  const round=p.items.filter(i=>i.pairId===item.pairId&&i.round===item.round);
  if(round.length===2&&round.every(i=>p.doneKeys.has(i.key)))return {kind:'round',text:`Round ${item.round} complete. Strong work.`};
 }else if(complete(ex))return {kind:'exercise',text:`${ex.name} complete.`};
 return {kind:'set',text:'Set complete. Keep building.'};
}

/** Exercise groups: runs of one exercise. A key survives regrouping by sharing an item with an unused previous group. */
export function focusGroups(items,previous=[]){
 const runs=[];
 for(const item of items){
  const last=runs.at(-1);
  if(last&&last.exerciseId===item.ref.exerciseId)last.keys.push(item.key);
  else runs.push({exerciseId:item.ref.exerciseId,exerciseIndex:item.exerciseIndex,keys:[item.key]});
 }
 const used=new Set();
 return runs.map(run=>{
  const at=previous.findIndex((g,i)=>!used.has(i)&&g.keys.some(k=>run.keys.includes(k)));
  if(at>=0)used.add(at);
  return {...run,key:at>=0?previous[at].key:run.keys[0]};
 });
}
