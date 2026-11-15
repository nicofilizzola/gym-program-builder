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
  window.caption=document.createElement('label');caption.id='reps-caption';document.querySelector('#fixture').before(caption);
  for(const kind of ['weight','reps'])widgets[kind]=mountWorkoutRuler(inputs[kind].closest('.log-stepper'),{input:inputs[kind],kind,caption:kind==='reps'?caption:null,onAdjust:n=>setRowBindings(row).applyValue(kind,n),onInteraction:()=>{}});
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
 const caption=page.locator('#reps-caption');
 await reps.fill('6');await expect(caption).toHaveText('Reps · 2 below 8–10');await expect(caption).toHaveClass(/is-outside/);
 await reps.fill('8');await expect(caption).toHaveText('Reps · 8–10');await expect(caption).not.toHaveClass(/is-outside/);
 await reps.fill('101');await expect(hint).toBeHidden();await expect(caption).toHaveText('Reps');
 await page.evaluate(()=>widgets.reps.update({value:null,placeholder:null,range:null,increment:1,enabled:true}));await expect(hint).toBeHidden();await expect(caption).toHaveText('Reps');
});
test('horizontal drag adjusts and a cancelled vertical press does not write',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true}),box=await slider.boundingBox();
 await page.mouse.move(box.x+180,box.y+15);await page.mouse.down();await page.mouse.move(box.x+116,box.y+15,{steps:5});await page.mouse.up();expect(await page.evaluate(()=>value.weightKg)).toBe(85);
 await page.evaluate(()=>{window.before=patches.length;const s=document.querySelector('[role="slider"]');s.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,isPrimary:true,button:0,clientX:100,clientY:20,bubbles:true}));s.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,isPrimary:true,clientX:102,clientY:70,bubbles:true}));s.dispatchEvent(new PointerEvent('pointercancel',{pointerId:9,bubbles:true}));});
 expect(await page.evaluate(()=>patches.length-before)).toBe(0);expect(page.url()).not.toContain('#');
 const count=await page.locator('.workout-ruler-tick').count();expect(count).toBeLessThan(60);
});
test('a drag that drifts vertically keeps adjusting',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true}),box=await slider.boundingBox();
 await page.mouse.move(box.x+180,box.y+15);await page.mouse.down();await page.mouse.move(box.x+170,box.y+55,{steps:4});await page.mouse.move(box.x+116,box.y+55,{steps:5});await page.mouse.up();
 // A drag writes live on each step; the last write is where it ends.
 expect(await page.evaluate(()=>patches.at(-1))).toEqual({weightKg:85});
});
test('a vertical swipe without horizontal travel writes nothing',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true}),box=await slider.boundingBox();
 await page.mouse.move(box.x+box.width*.75,box.y+15);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+3,box.y+55,{steps:4});await page.mouse.up();
 expect(await page.evaluate(()=>patches)).toEqual([]);
});
test('tapping left or right of centre steps once',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true}),box=await slider.boundingBox();
 await page.mouse.click(box.x+box.width/4,box.y+15);expect(await page.evaluate(()=>patches)).toEqual([{weightKg:77.5}]);
 await page.mouse.click(box.x+box.width*3/4,box.y+15);expect(await page.evaluate(()=>patches)).toEqual([{weightKg:77.5},{weightKg:80}]);
 const reps=await page.getByRole('slider',{name:'Adjust Set 1 reps, Bench press',exact:true}).boundingBox();
 await page.mouse.click(reps.x+reps.width*3/4,reps.y+15);expect(await page.evaluate(()=>value.reps)).toBe(9);
});
test('taps respect limits and off-grid values',async({page})=>{
 await mount(page);const weight=page.getByLabel('Set 1 weight, Bench press',{exact:true}),reps=page.getByLabel('Set 1 reps, Bench press',{exact:true});
 const strip=kind=>page.getByRole('slider',{name:`Adjust Set 1 ${kind}, Bench press`,exact:true});
 const tap=async(kind,side)=>{const box=await strip(kind).boundingBox();await page.mouse.click(box.x+box.width*(side<0?.25:.75),box.y+15);};
 const writes=async(kind,side)=>{const before=await page.evaluate(()=>patches.length);await tap(kind,side);return page.evaluate(n=>patches.slice(n),before);};
 await weight.fill('999.75');expect(await writes('weight',1)).toEqual([]);await expect(strip('weight').locator('.workout-ruler-nudge').last()).toHaveClass(/is-limit/);await expect(strip('weight').locator('.workout-ruler-nudge').first()).not.toHaveClass(/is-limit/);
 await weight.fill('0');expect(await writes('weight',-1)).toEqual([]);await expect(strip('weight').locator('.workout-ruler-nudge').first()).toHaveClass(/is-limit/);
 await reps.fill('100');expect(await writes('reps',1)).toEqual([]);await reps.fill('1');expect(await writes('reps',-1)).toEqual([]);
 await weight.fill('24.25');expect(await writes('weight',1)).toEqual([{weightKg:26.75}]);
 await expect(strip('weight').locator('.workout-ruler-nudge')).toHaveText(['‹','›']);await expect(strip('weight').locator('.workout-ruler-nudge').first()).toHaveAttribute('aria-hidden','true');
});
test('taps and keys from an empty field without a placeholder step from the shown minimum',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{for(const [kind,w] of Object.entries(widgets))w.update({value:null,placeholder:null,increment:kind==='weight'?2.5:1,range:null,enabled:true});});
 const tap=async(kind,side)=>{const box=await page.getByRole('slider',{name:`Adjust Set 1 ${kind}, Bench press`,exact:true}).boundingBox();await page.mouse.click(box.x+box.width*(side<0?.25:.75),box.y+15);};
 await tap('weight',-1);await tap('reps',-1);expect(await page.evaluate(()=>patches)).toEqual([]);
 await page.getByRole('slider',{name:'Adjust Set 1 reps, Bench press',exact:true}).press('ArrowLeft');expect(await page.evaluate(()=>patches)).toEqual([]);
 await tap('reps',1);expect(await page.evaluate(()=>patches)).toEqual([{reps:2}]);
});
test('a cancelled press writes nothing and a cancelled drag settles on a step',async({page})=>{
 await mount(page);
 const run=end=>page.evaluate(end=>{const s=document.querySelector('[role="slider"]'),at=x=>({pointerId:7,isPrimary:true,button:0,clientX:x,clientY:20,bubbles:true}),before=patches.length;
  s.dispatchEvent(new PointerEvent('pointerdown',at(100)));if(end==='press'){s.dispatchEvent(new PointerEvent('pointercancel',at(100)));return patches.length-before;}
  s.dispatchEvent(new PointerEvent('pointermove',at(30)));s.dispatchEvent(new PointerEvent(end,at(30)));const v=value.weightKg;value={...value,weightKg:null};refresh();return v;},end);
 expect(await run('press')).toBe(0);
 const cancelled=await run('pointercancel'),released=await run('pointerup');
 expect(cancelled%2.5).toBe(0);expect(cancelled).toBe(released);
});
test('the strip owns touches and keeps its slider semantics',async({page})=>{
 await mount(page);const slider=page.getByRole('slider',{name:'Adjust Set 1 weight, Bench press',exact:true});
 await expect(slider).toHaveCSS('touch-action','none');await expect(slider).toHaveAttribute('aria-valuetext','Suggested 80 kg');
});

async function holdFrames(page){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>{
  const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,queue=new Map();let id=0;
  window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
  window.flushFrame=()=>{const work=[...queue.values()];queue.clear();for(const fn of work)fn(performance.now());};
  window.restoreFrames=()=>{window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;queue.clear();};
 });
}
const flushFrame=page=>page.evaluate(()=>flushFrame());
const restoreFrames=page=>page.evaluate(()=>{window.restoreWork?.();window.restoreFrames?.();});
async function observeRulerWork(page){
 await page.evaluate(()=>{
  const root=document.querySelector('[role="slider"]'),track=root.firstElementChild;
  let counts={styleMutations:0,rebuilds:0,widthReads:0};
  const observer=new MutationObserver(records=>counts.styleMutations+=records.length);observer.observe(track,{attributes:true,attributeFilter:['style']});
  const replace=track.replaceChildren,width=Object.getOwnPropertyDescriptor(Element.prototype,'clientWidth').get;
  track.replaceChildren=function(...nodes){counts.rebuilds++;return replace.apply(this,nodes);};
  Object.defineProperty(root,'clientWidth',{configurable:true,get(){counts.widthReads++;return width.call(this);}});
  window.readRulerWork=()=>{counts.styleMutations+=observer.takeRecords().length;const result={...counts};counts={styleMutations:0,rebuilds:0,widthReads:0};return result;};
  window.restoreWork=()=>{observer.disconnect();delete root.clientWidth;track.replaceChildren=replace;};
 });
}
const readRulerWork=page=>page.evaluate(()=>readRulerWork());
const pointer=(page,type,x,y=20)=>page.evaluate(({type,x,y})=>document.querySelector('[role="slider"]').dispatchEvent(new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,clientX:x,clientY:y,bubbles:true})),{type,x,y});

test('paint coalesces without delaying canonical writes',async({page})=>{
 await mount(page);await page.getByLabel('Set 1 weight, Bench press',{exact:true}).fill('80');await holdFrames(page);await observeRulerWork(page);
 try{
  await page.evaluate(()=>{const s=document.querySelector('[role="slider"]'),send=(type,x)=>s.dispatchEvent(new PointerEvent(type,{pointerId:7,isPrimary:true,button:0,clientX:x,clientY:20,bubbles:true}));send('pointerdown',100);for(const x of [75,76,77,78,79])send('pointermove',x);});
  expect(await page.evaluate(()=>value.weightKg)).toBe(82.5);expect(await page.evaluate(()=>patches.at(-1))).toEqual({weightKg:82.5});
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow','82.5');
  const before=await readRulerWork(page);expect(before.styleMutations).toBe(0);expect(before.rebuilds).toBe(0);
  await flushFrame(page);const after=await readRulerWork(page);expect(after.styleMutations).toBeLessThanOrEqual(3);expect(after.rebuilds).toBeLessThanOrEqual(1);
  await page.evaluate(()=>window.firstTick=document.querySelector('.workout-ruler-tick'));
  for(const x of [78,77,76])await pointer(page,'pointermove',x);
  await flushFrame(page);expect(await page.evaluate(()=>firstTick===document.querySelector('.workout-ruler-tick'))).toBe(true);
  const reused=await readRulerWork(page);expect(reused.rebuilds).toBe(0);expect(reused.widthReads).toBe(0);
  await page.evaluate(()=>{refresh();refresh();});await flushFrame(page);expect(await readRulerWork(page)).toEqual({styleMutations:0,rebuilds:0,widthReads:0});
 }finally{await restoreFrames(page);}
});

test('tick window reuse invalidates on geometry and targets',async({page})=>{
 await mount(page);await holdFrames(page);await observeRulerWork(page);
 try{
  await page.evaluate(()=>{window.oldTick=document.querySelector('.workout-ruler-tick');increment=5;refresh();});await flushFrame(page);
  expect(await page.evaluate(()=>oldTick===document.querySelector('.workout-ruler-tick'))).toBe(false);
  const labels=await page.getByRole('slider').first().locator('.workout-ruler-tick').allTextContents();expect(labels.every(n=>+n%5===0)).toBe(true);
  await page.evaluate(()=>{window.oldTick=document.querySelector('.workout-ruler-tick');inputs.weight.closest('.log-stepper').style.width='280px';});
  // ResizeObserver runs independently of the held animation-frame queue.
  await expect.poll(()=>page.getByRole('slider').first().evaluate(el=>el.clientWidth)).toBeLessThan(281);
  await page.waitForTimeout(40);await flushFrame(page);expect(await page.evaluate(()=>oldTick===document.querySelector('.workout-ruler-tick'))).toBe(false);
  await page.evaluate(()=>{window.oldBand=document.querySelector('.workout-ruler-target');widgets.reps.update({range:{min:10,max:12}});});await flushFrame(page);
  expect(await page.locator('.workout-ruler-target').evaluate(el=>[el===oldBand,el.style.width,el.style.left])).toEqual([false,'96px',await page.getByRole('slider').nth(1).evaluate(el=>el.clientWidth/2+9*32-16+'px')]);
  // An equivalent range object keeps the same band.
  await page.evaluate(()=>{window.oldBand=document.querySelector('.workout-ruler-target');widgets.reps.update({range:{min:10,max:12}});});await flushFrame(page);
  expect(await page.locator('.workout-ruler-target').evaluate(el=>el===oldBand)).toBe(true);
 }finally{await restoreFrames(page);}
});
for(const action of ['disable','destroy'])test(`pending paint cancels on ${action}`,async({page})=>{
 await mount(page);await holdFrames(page);await observeRulerWork(page);
 try{
  await pointer(page,'pointerdown',100);await pointer(page,'pointermove',75);
  const before=await page.evaluate(()=>patches.length);
  await page.evaluate(action=>action==='disable'?widgets.weight.update({enabled:false}):widgets.weight.destroy(),action);await readRulerWork(page);
  await flushFrame(page);expect(await readRulerWork(page)).toEqual({styleMutations:0,rebuilds:0,widthReads:0});expect(await page.evaluate(()=>patches.length)).toBe(before);
  if(action==='disable'){
   await page.evaluate(()=>{inputs.weight.closest('.log-stepper').style.width='280px';widgets.weight.update({value:90,enabled:true});});await flushFrame(page);
   await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow','90');expect(await page.getByRole('slider').first().locator('.workout-ruler-tick').count()).toBeGreaterThan(0);
  }
 }finally{await restoreFrames(page);}
});

async function mountReadout(page){
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(page);
 await page.evaluate(()=>{window.readoutAnimations=el=>el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>Object.hasOwn(f,'opacity')&&Object.hasOwn(f,'transform')));});
 await page.getByLabel('Set 1 weight, Bench press',{exact:true}).fill('24.25');await page.getByLabel('Set 1 weight, Bench press',{exact:true}).blur();await holdFrames(page);
}
const key=(page,key,kind='weight')=>page.evaluate(({key,kind})=>inputs[kind].closest('.log-stepper').querySelector('.workout-ruler').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})),{key,kind});
const settled=async(page,text)=>{
 expect(await page.evaluate(()=>[inputs.weight.value,inputs.weight===document.querySelector('[data-field="weight"]'),readoutAnimations(inputs.weight).length,getComputedStyle(inputs.weight).opacity,getComputedStyle(inputs.weight).transform])).toEqual([text,true,0,'1','none']);
};
for(const [keyName,expected,y] of [['ArrowRight',26.75,3],['ArrowLeft',21.75,-3]])test(`readout: ${keyName} animates exact accepted decimal as one number`,async({page})=>{
 await mountReadout(page);
 try{
  const before=await page.locator('#reps-caption').boundingBox();await key(page,keyName);
  expect(await page.evaluate(()=>[inputs.weight.value,value.weightKg])).toEqual([String(expected),expected]);
  await flushFrame(page);
  const sample=await page.evaluate(()=>{
   const el=inputs.weight,[a]=readoutAnimations(el);if(!a)return null;a.pause();a.currentTime=0;const f=a.effect.getKeyframes(),t=a.effect.getTiming();
   return {count:readoutAnimations(el).length,fromOpacity:+f[0].opacity,toOpacity:+f.at(-1).opacity,fromY:new DOMMatrixReadOnly(f[0].transform).m42,toY:new DOMMatrixReadOnly(f.at(-1).transform).m42,duration:t.duration,easing:t.easing,same:el===window.inputs.weight};
  });
  expect(sample).toEqual({count:1,fromOpacity:.75,toOpacity:1,fromY:y,toY:0,duration:120,easing:'ease-out',same:true});
  expect(await page.locator('#reps-caption').boundingBox()).toEqual(before);
  expect(await page.locator('#reps-caption').evaluate(el=>el.getAnimations().length)).toBe(0);
 }finally{await restoreFrames(page);}
});
test('readout: reversal retargets current appearance and bursts never queue effects',async({page})=>{
 await mountReadout(page);
 try{
  await key(page,'ArrowRight');await flushFrame(page);
  const before=await page.evaluate(()=>{const [a]=readoutAnimations(inputs.weight);if(!a)return null;window.previousEffect=a;a.pause();a.currentTime=60;const c=getComputedStyle(inputs.weight);return {opacity:+c.opacity,y:new DOMMatrixReadOnly(c.transform).m42};});
  expect(before).not.toBe(null);await key(page,'ArrowLeft');await flushFrame(page);
  const after=await page.evaluate(()=>{const [a]=readoutAnimations(inputs.weight);a.pause();a.currentTime=0;const f=a.effect.getKeyframes()[0];return {opacity:+f.opacity,y:new DOMMatrixReadOnly(f.transform).m42,old:previousEffect.playState};});
  expect(after.opacity).toBeCloseTo(before.opacity,2);expect(after.y).toBeCloseTo(before.y,1);expect(after.old).toBe('idle');
  const counts=await page.evaluate(()=>{const counts=[];for(let i=0;i<30;i++){document.querySelector('[role="slider"]').dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight',bubbles:true}));flushFrame();counts.push(readoutAnimations(inputs.weight).length);}return counts;});
  expect(counts.every(n=>n===1)).toBe(true);await page.waitForTimeout(160);await settled(page,'24.25');
 }finally{await restoreFrames(page);}
});
for(const phase of ['queued','running'])for(const action of ['input','composition','focus','selection','resize','reduced','disable','destroy','replacement'])test(`readout: ${phase} cancels on ${action}`,async({page})=>{
 await mountReadout(page);
 try{
  await key(page,'ArrowRight');if(phase==='running'){await flushFrame(page);expect(await page.evaluate(()=>readoutAnimations(inputs.weight).length)).toBe(1);}
  if(action==='reduced'){await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(30);}
  else await page.evaluate(action=>{
   const el=inputs.weight;
   if(action==='input'){el.value='24.25';el.dispatchEvent(new Event('input',{bubbles:true}));}
   if(action==='composition')el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
   if(action==='focus')el.focus();
   if(action==='selection'){el.focus();el.setSelectionRange(1,3);el.dispatchEvent(new Event('select'));}
   if(action==='resize')el.closest('.log-stepper').style.width='280px';
   if(action==='disable')widgets.weight.update({enabled:false});
   if(action==='destroy')widgets.weight.destroy();
   if(action==='replacement'){value={...value,weightKg:24.25};refresh();}
  },action);
  if(action==='resize')await page.waitForTimeout(40);
  await flushFrame(page);await settled(page,['input','replacement'].includes(action)?'24.25':'26.75');
 }finally{await restoreFrames(page);}
});
test('readout: routine updates and direct entry never start feedback or overwrite composing drafts',async({page})=>{
 await mountReadout(page);
 try{
  await settled(page,'24.25');await page.evaluate(()=>{refresh();widgets.weight.update({range:{min:8,max:12}});});await flushFrame(page);await settled(page,'24.25');
  await key(page,'ArrowRight');await flushFrame(page);expect(await page.evaluate(()=>readoutAnimations(inputs.weight).length)).toBe(1);
  for(const raw of ['82,','82.3']){
   await page.evaluate(raw=>{const el=inputs.weight;el.focus();el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value=raw;el.dispatchEvent(new Event('input',{bubbles:true}));el.setSelectionRange(1,3);refresh();},raw);
   await flushFrame(page);await settled(page,raw);
   expect(await page.evaluate(()=>[inputs.weight.selectionStart,inputs.weight.selectionEnd,inputs.weight.getAttribute('aria-invalid'),document.activeElement===inputs.weight])).toEqual([1,3,'true',true]);
  }
  await page.evaluate(()=>{inputs.weight.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));inputs.weight.value='82,25';inputs.weight.dispatchEvent(new Event('input',{bubbles:true}));});await flushFrame(page);
  expect(await page.evaluate(()=>value.weightKg)).toBe(82.25);await settled(page,'82,25');
  await page.evaluate(()=>{inputs.weight.blur();value={...value,weightKg:null};refresh();});await flushFrame(page);await settled(page,'');
 }finally{await restoreFrames(page);}
});
for(const [increment,wheelValue] of [[0.25,24.75],[1,26],[2.5,30],[5,35]])test(`readout: native routes preserve ${increment} kg steps and stationary labels`,async({page})=>{
 await mountReadout(page);
 try{
  await page.evaluate(n=>{increment=n;refresh();},increment);await flushFrame(page);
  const caption=await page.locator('#reps-caption').boundingBox();
  await pointer(page,'pointerdown',100);await pointer(page,'pointerup',200);await flushFrame(page);
  expect(await page.evaluate(()=>value.weightKg)).toBe(24.25+increment);expect(await page.evaluate(()=>readoutAnimations(inputs.weight).length)).toBe(1);
  await page.evaluate(()=>{readoutAnimations(inputs.weight).forEach(a=>a.finish());});
  await page.evaluate(()=>document.querySelector('[role="slider"]').dispatchEvent(new WheelEvent('wheel',{deltaX:32,deltaY:0,bubbles:true,cancelable:true})));await flushFrame(page);
  expect(await page.evaluate(()=>value.weightKg)).toBe(wheelValue);
  await pointer(page,'pointerdown',100);await pointer(page,'pointermove',68,70);await flushFrame(page);
  expect(await page.getByRole('slider').first().locator('.workout-ruler-track').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await pointer(page,'pointerup',68,70);await flushFrame(page);
  expect(await page.getByRole('slider').first().locator('.workout-ruler-track').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0.15s');
  expect(await page.locator('#reps-caption').boundingBox()).toEqual(caption);
  for(const [kind,limitKey,repeatKey] of [['weight','Home','ArrowLeft'],['weight','End','ArrowRight'],['reps','Home','ArrowLeft'],['reps','End','ArrowRight']]){
   await key(page,limitKey,kind);await flushFrame(page);expect(await page.evaluate(kind=>readoutAnimations(inputs[kind]).length,kind)).toBe(1);
   await page.evaluate(kind=>readoutAnimations(inputs[kind]).forEach(a=>a.finish()),kind);await key(page,repeatKey,kind);await flushFrame(page);
   expect(await page.evaluate(kind=>readoutAnimations(inputs[kind]).length,kind)).toBe(0);
  }
 }finally{await restoreFrames(page);}
});
