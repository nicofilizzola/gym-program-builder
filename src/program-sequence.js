/** Rest entries belong to the sequence, never to workout volume or weekdays. */
const keyOf=entry=>entry.type==='workout'?entry.workoutId:entry.id;
export function getSequence(program) {
 return structuredClone(program.sequence??program.workouts.map(w=>({type:'workout',workoutId:w.id})));
}
export function addRestDay(program,restId) {
 const sequence=getSequence(program);
 if(typeof restId!=='string'||!restId||sequence.some(e=>keyOf(e)===restId))throw Error('Missing or duplicate rest ID.');
 return {...program,sequence:[...sequence,{type:'rest',id:restId}]};
}
export function removeRestDay(program,restId) {
 const sequence=getSequence(program);
 if(!sequence.some(e=>e.type==='rest'&&e.id===restId))throw Error('Rest day not found.');
 return {...program,sequence:sequence.filter(e=>e.type!=='rest'||e.id!==restId)};
}
export function placeSequenceEntry(program,key,{beforeKey=null}={}) {
 const sequence=getSequence(program),entry=sequence.find(e=>keyOf(e)===key);
 if(!entry)throw Error('Sequence entry not found.');
 if(beforeKey===key)return structuredClone(program);
 const next=sequence.filter(e=>keyOf(e)!==key);
 const index=beforeKey===null?next.length:next.findIndex(e=>keyOf(e)===beforeKey);
 if(index<0)throw Error('Placement anchor not found.');
 next.splice(index,0,entry);
 const workouts=new Map(program.workouts.map(w=>[w.id,w]));
 return {...program,sequence:next,workouts:next.filter(e=>e.type==='workout').map(e=>workouts.get(e.workoutId))};
}
/** Refill workout slots; rests retain their slots when Week changes order. */
export function reconcileSequence(program) {
 if(!program.sequence)return program;
 let index=0;
 const sequence=program.sequence.flatMap(entry=>entry.type==='rest'?[{...entry}]:
  index<program.workouts.length?[{type:'workout',workoutId:program.workouts[index++].id}]:[]);
 while(index<program.workouts.length)sequence.push({type:'workout',workoutId:program.workouts[index++].id});
 return {...program,sequence};
}
