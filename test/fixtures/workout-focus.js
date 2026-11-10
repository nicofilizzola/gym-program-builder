const set=(id,kind='working')=>({id,kind,weightKg:null,reps:null,rir:null,done:false,note:''});
const exercise=(id,name,sets,range={min:10,max:12})=>({id,name,variantId:null,referenceId:null,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],note:'',target:{sets:sets.filter(s=>s.kind==='working').length,warmupSets:sets.filter(s=>s.kind==='warmup').length,repRange:range,restSeconds:90},sets});
export function focusFixture(){
 return {id:'focus-log',logVersion:2,status:'active',name:'Upper body',coverId:'gym',note:'',startedAt:'2026-11-08T10:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[
  exercise('straight','Bench press',[set('sw','warmup'),set('s1'),set('s2')],{min:8,max:10}),
  {...exercise('a','Single-arm incline dumbbell chest press',[set('aw','warmup'),set('a1'),set('a2')]),superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},
  exercise('b','Chest-supported row',[set('bw','warmup'),set('b1')]),
  {...exercise('empty','Cable raise',[]),target:null}
 ]};
}
