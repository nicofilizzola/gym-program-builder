import {expect} from '@playwright/test';
export const headers={origin:'http://127.0.0.1:3199'};

export async function login(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
}

/** Deletes every workout log through the API and clears the local mirror. */
export async function resetWorkouts(page){
 const request=page.request;
 const active=(await (await request.get('/api/workouts/active')).json()).record;
 if(active)await request.delete(`/api/workouts/${active.id}?revision=${active.revision}`,{headers});
 for(;;){
  const {records}=await (await request.get('/api/workouts')).json();
  if(!records.length)break;
  for(const {id} of records){
   const {record}=await (await request.get(`/api/workouts/${id}`)).json();
   await request.delete(`/api/workouts/${id}?revision=${record.revision}`,{headers});
  }
 }
 await page.evaluate(()=>localStorage.clear());
}

/** Creates a template holding two seeded catalog variants. */
export async function createLinkedTemplate(page,name){
 const {entries}=await (await page.request.get('/api/catalog')).json();
 const picks=entries.filter(e=>!e.archived&&e.equipment).slice(0,2);
 const exercises=picks.map(e=>({
  name:e.name,sets:3,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:[...e.primaryMuscles],secondaryMuscles:[...e.secondaryMuscles],
  catalogId:e.id,familyId:e.familyId,catalogRevision:e.revision,equipment:e.equipment}));
 const id=crypto.randomUUID();
 const response=await page.request.post('/api/documents',{headers,data:{id,kind:'template',document:{name,exercises,goals:{},extraMinutes:5,bufferPercent:10}}});
 expect(response.ok()).toBeTruthy();
 return {id};
}

/** Saves a finished workout log directly through the API. */
export async function saveFinishedLog(page,{id=crypto.randomUUID(),name,startedAt,minutes=45,doneSets=3,source={kind:'blank'}}){
 const end=new Date(new Date(startedAt).getTime()+minutes*60000);
 const pad=n=>String(n).padStart(2,'0');
 const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000${(o=>(o<=0?'+':'-')+pad(Math.floor(Math.abs(o)/60))+':'+pad(Math.abs(o)%60))(d.getTimezoneOffset())}`;
 const sets=Array.from({length:doneSets},(_,i)=>({id:`s${i}`,weightKg:50,reps:8,rir:null,done:true}));
 const log={id,logVersion:1,status:'finished',name,startedAt:iso(new Date(startedAt)),finishedAt:iso(end),source,
  exercises:[{id:'e1',variantId:'v1',referenceId:'r1',name:'Bench press',equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],target:null,sets}]};
 const response=await page.request.put(`/api/workouts/${id}`,{headers,data:{revision:0,log}});
 expect(response.ok(),await response.text()).toBeTruthy();
 return {id};
}
