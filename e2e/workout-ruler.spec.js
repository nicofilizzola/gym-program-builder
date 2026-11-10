import {test,expect} from '@playwright/test';

async function mount(page){
 await page.goto('/');await page.evaluate(async()=>{
  const {createSetRow,updateSetRow,setRowBindings}=await import('/src/workout-set-row.js');
  const {mountWorkoutRuler}=await import('/src/workout-ruler.js');
  document.body.innerHTML='<main style="width:350px;margin:12px" id="fixture"></main><select aria-label="Weight increment"><option>2.5</option><option>5</option><option>0.25</option></select><style>.log-set-row{display:block}.log-stepper{width:300px;margin:8px 0}input{font-size:18px}</style>';
  window.value={id:'s',kind:'working',done:false,weightKg:null,reps:null,rir:null,note:''};window.patches=[];window.widgets={};window.increment=2.5;
  const props=()=>({exerciseName:'Bench press',set:value,kindIndex:1,placeholder:{weightKg:80,reps:8,rir:null}});
  window.refresh=()=>{updateSetRow(row,props());for(const [kind,w] of Object.entries(widgets))w.update({value:kind==='weight'?value.weightKg:value.reps,placeholder:kind==='weight'?80:8,increment:kind==='weight'?increment:1,range:kind==='reps'?{min:8,max:10}:null,enabled:true});};
  window.row=createSetRow({...props(),onPatch:patch=>{patches.push(patch);value={...value,...patch};refresh();},onToggle:()=>{},onMenu:()=>{}});document.querySelector('#fixture').append(row);window.inputs=setRowBindings(row).inputs;
  for(const kind of ['weight','reps'])widgets[kind]=mountWorkoutRuler(inputs[kind].closest('.log-stepper'),{input:inputs[kind],kind,onAdjust:n=>setRowBindings(row).applyValue(kind,n),onInteraction:()=>{}});
  document.querySelector('select').onchange=e=>{increment=+e.target.value;refresh();};refresh();
 });
}
test('typed exact weight survives increment changes and acknowledgements',async({page})=>{
 await mount(page);const weight=page.getByLabel('Set 1 weight, Bench press',{exact:true});
 await weight.fill('24.25');await page.getByLabel('Weight increment').selectOption('5');await expect(weight).toHaveValue('24.25');
 await weight.fill('999.75');await page.evaluate(()=>refresh());await expect(weight).toHaveValue('999.75');
 await weight.fill('82,25');expect(await page.evaluate(()=>value.weightKg)).toBe(82.25);
});
test('ruler keyboard adjustment commits once and clamps to valid bounds',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true});
 await slider.focus();await slider.press('ArrowRight');expect(await page.evaluate(()=>patches)).toEqual([{weightKg:82.5}]);
 await slider.press('End');expect(await page.evaluate(()=>value.weightKg)).toBe(999.75);
 await slider.press('ArrowRight');expect(await page.evaluate(()=>value.weightKg)).toBe(999.75);
 await slider.press('Home');expect(await page.evaluate(()=>value.weightKg)).toBe(0);
 const reps=page.getByRole('slider',{name:'Adjust Set 1 reps, Bench press',exact:true});await reps.press('End');expect(await page.evaluate(()=>value.reps)).toBe(100);await reps.press('Home');expect(await page.evaluate(()=>value.reps)).toBe(1);
});
test('blank placeholders are suggestions and invalid drafts are never stored',async({page})=>{
 await mount(page);expect(await page.evaluate(()=>patches)).toEqual([]);
 const field=page.getByLabel('Set 1 weight, Bench press',{exact:true});await expect(field).toHaveValue('');
 await field.fill('82.3');await page.evaluate(()=>refresh());await expect(field).toHaveValue('82.3');expect(await page.evaluate(()=>value.weightKg)).toBe(null);await expect(field).toHaveAttribute('aria-invalid','true');
 await field.fill('0.25');expect(await page.evaluate(()=>value.weightKg)).toBe(0.25);await field.fill('');expect(await page.evaluate(()=>value.weightKg)).toBe(null);
});
test('range updates from the current typed value and omits invalid or absent targets',async({page})=>{
 await mount(page);const reps=page.getByLabel('Set 1 reps, Bench press',{exact:true}),hint=page.locator('.workout-rep-guidance');
 await reps.fill('6');await expect(hint).toHaveText('2 below target · Aim for 8–10 reps');
 await reps.fill('12');await expect(hint).toHaveText('2 above target · Aim for 8–10 reps');
 for(const n of ['8','10']){await reps.fill(n);await expect(hint).toHaveText('Within target · 8–10 reps');}
 await reps.fill('101');await expect(hint).toBeHidden();
 await page.evaluate(()=>widgets.reps.update({value:null,placeholder:null,range:null,increment:1,enabled:true}));await expect(hint).toBeHidden();
});
test('horizontal drag adjusts while vertical intent and cancellation do not write',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true}),box=await slider.boundingBox();
 await page.mouse.move(box.x+180,box.y+15);await page.mouse.down();await page.mouse.move(box.x+116,box.y+15,{steps:5});await page.mouse.up();expect(await page.evaluate(()=>value.weightKg)).toBe(85);
 await page.evaluate(()=>{window.before=patches.length;const s=document.querySelector('[role="slider"]');s.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,isPrimary:true,button:0,clientX:100,clientY:20,bubbles:true}));s.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,isPrimary:true,clientX:102,clientY:70,bubbles:true}));s.dispatchEvent(new PointerEvent('pointercancel',{pointerId:9,bubbles:true}));});
 expect(await page.evaluate(()=>patches.length-before)).toBe(0);expect(page.url()).not.toContain('#');
 const count=await page.locator('.workout-ruler-tick').count();expect(count).toBeLessThan(60);
});
