import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';

const sizes=[{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}];

for(const kind of ['template','program'])test('name-led collapsed and mixed cards wrap accessibly in '+kind,async({browser})=>{
 test.setTimeout(90000);
 const dir='.superpowers/compact-headings';await mkdir(dir,{recursive:true});
 const cases=[...sizes,{width:390,height:844},{width:768,height:1024},{width:1366,height:768,hasTouch:true},{width:1366,height:768,enlarged:true},{width:390,height:844,enlarged:true}];
 for(const size of cases){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},hasTouch:!!size.hasTouch,reducedMotion:'reduce'}),page=await context.newPage();
  try{
   await fixture(page);
   await page.evaluate(async({kind,enlarged})=>{
    window.fixtureView.destroy();
    const root=document.querySelector('#app');
    const names=['Bench press','Bench press','Long named barbell bench press with a deliberate pause and controlled eccentric','Unbroken'.repeat(20),'',...Array.from({length:7},(_,i)=>'Exercise variant '+i)];
    const workout={name:'Compact outline',goals:{},exercises:names.map(name=>({name,sets:3,repRange:{min:8,max:12},restSeconds:180,primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}))};
    if(kind==='template'){
     const {mountSessionEditor}=await import('/src/session-editor.js');window.fixtureView=mountSessionEditor(root,{workout});
    }else{
     const {mountProgramView}=await import('/src/program-view.js');window.fixtureView=mountProgramView(root,{templates:[],program:{name:'Outline program',mode:'simple',goals:{},workouts:[{...workout,id:'outline',day:null}]}});
    }
    if(enlarged)document.documentElement.style.fontSize='200%';
   },{kind,enlarged:size.enlarged});
   if(kind==='program')await page.locator('.workout-title').filter({hasText:'Compact outline'}).click();
   const cards=page.locator('.exercise');await expect(cards).toHaveCount(12);
   await expect(cards.nth(4).locator('[data-fix-tag]')).toBeVisible();
   await page.locator('.volume-row[data-muscle="Chest"]').click();
   await expect(cards.first().locator('[data-hit-tag]')).toHaveText('primary · Chest');
   await noOverflow(page);
   const minimum=size.width>=1100&&!size.hasTouch?32:44;
   for(const box of await cards.first().locator('.card-controls button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}))){expect(box.width).toBeGreaterThanOrEqual(minimum);expect(box.height).toBeGreaterThanOrEqual(minimum);}
   const nameBox=await cards.nth(3).locator('.card-name').boundingBox(),cardBox=await cards.nth(3).boundingBox();expect(nameBox.x+nameBox.width).toBeLessThanOrEqual(cardBox.x+cardBox.width);
   const suffix=kind+'-'+size.width+(size.hasTouch?'-touch':'')+(size.enlarged?'-text200':'');
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:dir+'/'+suffix+'-collapsed.png',fullPage:true});
   await cards.first().getByRole('button',{name:/^Expand exercise: /}).click();
   await expect(cards.first().getByLabel('Exercise name',{exact:true})).toBeVisible();
   const slider=await cards.first().getByRole('slider',{name:'Sets',exact:true}).boundingBox();expect(slider.height).toBeGreaterThanOrEqual(44);
   await noOverflow(page);
   if(size.width>=1100)for(const figure of await page.locator('#body-map svg').all())expect((await figure.boundingBox()).height).toBeGreaterThanOrEqual(180);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:dir+'/'+suffix+'-mixed.png',fullPage:true});
  }finally{await context.close();}
 }
});
async function fixture(page,kind='session') {
  await page.goto('/');
  await page.waitForFunction(()=>!document.querySelector('#shell').hidden||document.querySelector('input[name="password"]'));
  if(await page.getByLabel('Password',{exact:true}).isVisible()) {
    await page.getByLabel('Password',{exact:true}).fill('test-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
  }
  await expect(page.locator('#shell')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');
  await page.evaluate(async kind=>{
    const {MUSCLE_GROUPS}=await import('/src/muscles.js');
    const exercises=['Bench press','Pull-up','Row','Squat','Leg curl','Calf raise'].map((name,i)=>({name,sets:3,repRange:{min:8,max:12},primaryMuscles:[MUSCLE_GROUPS[i*2]],secondaryMuscles:[MUSCLE_GROUPS[i*2+1]]}));
    const goals=Object.fromEntries(MUSCLE_GROUPS.map(m=>[m,6]));
    const root=document.querySelector('#app');root.replaceChildren();window.changes=[];
    if(kind==='session') {
      const {mountSessionEditor}=await import('/src/session-editor.js');
      window.fixtureView=mountSessionEditor(root,{workout:{name:'Balanced training',goals,exercises},onChange:p=>window.changes.push(p)});
      root.querySelector('#expand-all').click();
    } else if(kind==='program') {
      const {mountProgramView}=await import('/src/program-view.js');
      window.fixtureView=mountProgramView(root,{templates:[],program:{name:'Balanced week',mode:'schedule',goals:Object.fromEntries(MUSCLE_GROUPS.map(m=>[m,30])),workouts:[0,0,1,2,3,4,5,6,null].map((day,i)=>({id:'w'+i,name:['Upper A','Assistance','Lower A','Pull','Push','Lower B','Upper B','Recovery','Extra'][i],day,goals:{},exercises:[exercises[i%6]]}))},onChange:p=>window.changes.push(p),onExport:()=>{}});
    } else {
      const {mountLibrary}=await import('/src/library-view.js');
      window.fixtureView=mountLibrary(root,{kind:'template',records:Array.from({length:12},(_,i)=>({id:'t'+i,name:'Training template '+(i+1)})),recordHref:r=>'#/templates/'+r.id,onCreate:()=>{},onOpen:()=>{},onDuplicate:()=>{},onDelete:()=>{},onImport:()=>{},onExport:()=>{}});
    }
    await document.fonts.ready;
  },kind);
}
async function noOverflow(page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}
async function metrics(page) {
  return page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
    const cards=[...document.querySelectorAll('.exercise')].map(rect);
    return {firstCard:cards[0]?.y,completeCards:cards.filter(r=>r.y>=0&&r.bottom<=innerHeight).length,panel:document.querySelector('.panel')?rect(document.querySelector('.panel')):null,bodies:[...document.querySelectorAll('#body-map svg')].map(rect),libraryRows:[...document.querySelectorAll('.library-item')].map(rect),scrollWidth:document.documentElement.scrollWidth};
  });
}

test('captures density measurements',async({page})=>{
  test.setTimeout(90000);
  const stage=process.env.COMPACT_CAPTURE||'after',dir=`.superpowers/compact-desktop/${stage}`;
  await mkdir(dir,{recursive:true});const results=[];
  for(const size of sizes)for(const kind of ['session','program','library']) {
    await page.setViewportSize(size);await fixture(page,kind);
    await page.screenshot({path:`${dir}/${kind}-${size.width}.png`,fullPage:true});
    if(size.width===1440) {
      const css=await readFile('style.css','utf8');
      const snapshot=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`);
      await writeFile(`${dir}/${kind}.html`,snapshot);
    }
    results.push({kind,...size,...await metrics(page)});
  }
  await writeFile(`${dir}/metrics.json`,JSON.stringify(results,null,2));
});

test('desktop editor exposes compact expanded fields',async({page})=>{
  for(const [i,size]of sizes.entries()) {
    await page.setViewportSize(size);await fixture(page);
    const m=await metrics(page);expect(m.firstCard).toBeLessThanOrEqual(200);expect(m.completeCards).toBeGreaterThanOrEqual(i===2?3:2);
    const card=page.locator('.exercise').first();
    const fields=await card.locator('[data-field="name"],[data-field="sets"],[data-field="min"]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
    expect(Math.max(...fields)-Math.min(...fields)).toBeLessThan(18);
    for(const role of ['primary','secondary'])await expect(card.locator(`input[data-role="${role}"]`)).toHaveCount(13);
    await noOverflow(page);
  }
});

test('desktop volume keeps both bodies prominent',async({page})=>{
  for(const kind of ['session','program'])for(const size of sizes) {
    await page.setViewportSize(size);await fixture(page,kind);
    await expect(page.locator('.volume-row:visible')).toHaveCount(13);
    const m=await metrics(page);expect(m.bodies).toHaveLength(2);
    for(const body of m.bodies)expect(body.height).toBeGreaterThanOrEqual(size.width>=1600?200:180);
    expect(m.panel.bottom).toBeLessThanOrEqual(size.height);
    await noOverflow(page);
  }
});

test('desktop library rows are compact',async({page})=>{
  for(const size of sizes){await page.setViewportSize(size);await fixture(page,'library');const m=await metrics(page);for(const row of m.libraryRows)expect(row.height).toBeLessThanOrEqual(64);await noOverflow(page);}
});

test('week uses a single-column day agenda',async({page})=>{
  for(const size of sizes) {
    await page.setViewportSize(size);await fixture(page,'program');
    const panelBounds=await page.locator('.panel').boundingBox();
    expect(panelBounds.x+panelBounds.width).toBe(size.width-24);
    await expect(page.locator('.program-page > .program-grid')).toHaveCount(1);
    const sections=page.locator('.week-agenda > .day-section');await expect(sections).toHaveCount(8);
    const boxes=await sections.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),h=el.querySelector('h2').getBoundingClientRect(),l=el.querySelector('.workout-list').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,labelRight:h.right,labelY:h.y,listX:l.x,listY:l.y};}));
    expect(new Set(boxes.map(b=>Math.round(b.x))).size).toBe(1);
    for(let i=1;i<8;i++)expect(boxes[i].y).toBeGreaterThan(boxes[i-1].y);
    for(const b of boxes){expect(b.listX).toBeGreaterThanOrEqual(b.labelRight);expect(Math.abs(b.listY-b.labelY)).toBeLessThan(12);}
    await expect(sections.first().locator('.workout-item')).toHaveCount(2);await noOverflow(page);
  }
});

test('week agenda cards keep name, metadata and actions on one row',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await fixture(page,'program');
  const m=await page.locator('.workout-item').first().evaluate(el=>{const c=r=>r.y+r.height/2,q=s=>el.querySelector(s).getBoundingClientRect();return {h3:c(q('h3')),meta:c(q('.workout-metadata p')),actions:c(q('.item-actions')),height:el.getBoundingClientRect().height};});
  expect(Math.abs(m.h3-m.meta)).toBeLessThan(8);expect(Math.abs(m.h3-m.actions)).toBeLessThan(8);expect(Math.abs(m.meta-m.actions)).toBeLessThan(8);
  expect(m.height).toBeLessThanOrEqual(64);
});

test('week agenda preserves actions and cross-day drag order',async({page})=>{
  await page.setViewportSize({width:1440,height:1200});await fixture(page,'program');
  const first=page.locator('[data-workout="w0"]');
  await expect(first.getByRole('button',{name:'Move up Upper A',exact:true})).toHaveCount(0);
  const duplicate=first.getByRole('button',{name:'Duplicate Upper A',exact:true});
  await expect(duplicate.locator('svg')).toHaveCount(1);
  await duplicate.click();await expect(page.locator('.workout-item')).toHaveCount(10);
  await expect(page.locator('.workout-title').filter({hasText:'Upper A'}).nth(1)).toBeFocused();
  const source=await first.locator('.workout-metadata p:first-child').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
  const target=await page.locator('[data-sort-group="1"]').boundingBox();
  await page.mouse.move(target.x+60,target.y+30,{steps:8});await expect(page.locator('.sort-drag-copy')).toBeVisible();await page.mouse.up();
  await expect(page.locator('[data-sort-group="1"] [data-workout="w0"]')).toHaveCount(1);
  expect(await page.evaluate(()=>window.changes.at(-1).workouts.find(w=>w.id==='w0').day)).toBe(1);
  const saved=await page.evaluate(()=>window.changes.at(-1).workouts);
  await page.getByRole('radio',{name:'Sequence',exact:true}).check();
  await page.getByRole('radio',{name:'Week',exact:true}).check();
  expect(await page.evaluate(()=>window.changes.at(-1).workouts)).toEqual(saved);
});

test('wide day cards show two icon actions without a day selector',async({page})=>{
  await page.setViewportSize(sizes[2]);await fixture(page,'program');
  const card=page.locator('[data-workout="w0"]');
  await expect(card.locator('.day-field')).toHaveCount(0);
  await expect(card.locator('.item-actions button svg')).toHaveCount(2);
});

test('short and enlarged panels release sticky without shrinking the bodies',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const kind of ['session','program']) {
    await page.setViewportSize({width:1366,height:500});await fixture(page,kind);
    await expect(page.locator('.panel')).toHaveClass(/panel--flow/);
    await page.locator('#readout').scrollIntoViewIfNeeded();await expect(page.locator('#readout')).toBeInViewport();
    await page.setViewportSize({width:1366,height:900});await expect(page.locator('.panel')).not.toHaveClass(/panel--flow/);
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    await expect(page.locator('.panel')).toHaveClass(/panel--flow/);await noOverflow(page);
    await page.evaluate(()=>{window.fixtureView.destroy();document.documentElement.style.fontSize='';});
    await page.setViewportSize({width:1440,height:900});
  }
  expect(errors).toEqual([]);
});

test('compact fields keep keyboard editing, collapse and error focus',async({page})=>{
  await page.setViewportSize(sizes[0]);await fixture(page);
  const first=page.locator('.exercise').first(),name=first.locator('[data-field="name"]');
  await name.fill('Press');await expect(name).toBeFocused();
  const min=first.getByRole('slider',{name:'Reps min',exact:true});await min.focus();await page.keyboard.press('End');
  await expect(first.getByRole('slider',{name:'Reps max',exact:true})).toHaveValue('30');
  await first.getByRole('button',{name:/^Collapse exercise: /}).click();
  await expect(first.locator('[data-collapse="body"]')).toHaveAttribute('inert','');
  await first.getByRole('button',{name:/^Expand exercise: /}).click();await name.fill('');
  await page.getByRole('button',{name:'Export',exact:true}).click();await expect(name).toBeFocused();
});

test('enlarged volume names and values remain inside their columns',async({page})=>{
  await page.setViewportSize(sizes[0]);await fixture(page,'program');
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  for(const cell of await page.locator('.volume-row .name,.volume-row .value').all()) {
    expect(await cell.evaluate(el=>el.scrollWidth),await cell.textContent()).toBeLessThanOrEqual(await cell.evaluate(el=>el.clientWidth));
  }
  await noOverflow(page);
});

test('desktop coarse pointers retain touch targets',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,viewport:sizes[0],reducedMotion:'reduce'}),page=await context.newPage();
  await fixture(page);
  for(const locator of [page.locator('.exercise .heading-toggle').first(),page.locator('.exercise .chip span').first(),page.locator('#export-session')]) {
    const r=await locator.boundingBox();expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);
  }
  await context.close();
});

test('hybrid mouse and touchscreen desktops retain touch targets',async({browser})=>{
  const hybrid=await browser.browserType().launch({args:['--blink-settings=availablePointerTypes=6,primaryPointerType=4']});
  try {
    const page=await hybrid.newPage({viewport:sizes[0],reducedMotion:'reduce'});await fixture(page);
    expect(await page.evaluate(()=>matchMedia('(pointer:fine)').matches&&matchMedia('(any-pointer:coarse)').matches)).toBe(true);
    for(const selector of ['.exercise .heading-toggle','.exercise .chip span','#export-session','.volume-row']) {
      const box=await page.locator(selector).first().boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize(sizes[2]);await fixture(page,'program');
    const card=page.locator('[data-workout="w0"]');
    for(const button of await card.locator('.item-actions button').all())expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(card.locator('.day-field')).toHaveCount(0);await noOverflow(page);
  } finally {await hybrid.close();}
});

test('desktop readout reserves two complete lines including its padding',async({page})=>{
  await page.setViewportSize(sizes[0]);await fixture(page);
  const readout=page.locator('.readout'),before=await readout.boundingBox();
  await page.locator('#readout').evaluate(el=>{el.textContent='First line\nSecond line';el.style.whiteSpace='pre-line';});
  expect((await readout.boundingBox()).height).toBe(before.height);
});

test('consolidated headers reflow recovery actions and long names',async({page})=>{
  await page.setViewportSize(sizes[0]);await fixture(page,'program');
  await page.getByLabel('Program name',{exact:true}).fill('Long program name '.repeat(20));
  await page.evaluate(()=>{
    document.querySelector('[data-testid="save-status"]').textContent='Conflict';
    for(const id of ['retry-save','reload-saved','copy-saved'])document.getElementById(id).hidden=false;
    document.querySelector('[data-program-error]').textContent='This file is not valid JSON.';
  });
  for(const enlarged of [false,true]) {
    if(enlarged)await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    await noOverflow(page);
    for(const id of ['retry-save','reload-saved','copy-saved']) {
      const button=page.locator('#'+id);await expect(button).toBeVisible();
      await button.focus();await expect(button).toBeFocused();
      const box=await button.boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(sizes[0].width);
    }
  }
});
