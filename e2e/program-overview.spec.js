import {test,expect} from '@playwright/test';

async function openProgram(page) {
  await page.goto('/');
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'New program',exact:true}).click();
  await page.getByLabel('Program name',{exact:true}).fill('Overview week');
}

const exercise=(name,sets,primaryMuscles,secondaryMuscles=[])=>({name,sets,repRange:{min:8,max:12},primaryMuscles,secondaryMuscles});
const programFixture=()=>({name:'Heatmap week',mode:'simple',goals:{},workouts:[
  {name:'Press',day:0,goals:{},exercises:[exercise('Bench',4,['Chest'])]},
  {name:'Assistance',day:null,goals:{},exercises:[exercise('Extension',6,['Triceps'],['Chest'])]},
  {name:'Pull',day:6,goals:{},exercises:[exercise('Row',3,['Lats'])]},
  {name:'Empty',day:null,goals:{},exercises:[]}
]});
async function importProgram(page,program=programFixture()) {
  await page.locator('[data-file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program}))});
  await expect(page.getByLabel('Program name',{exact:true})).toHaveValue(program.name);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
}
const row=(page,m)=>page.locator(`.volume-row[data-muscle="${m}"]`);
const region=(page,m)=>page.locator(`.region[data-muscle="${m}"]`).first();
async function pointAt(page,m) {
  // SVG groups have disconnected mirrored paths: their bounding-box centre can be empty.
  await region(page,m).locator('path').first().hover();
}

test('program toolbar groups file actions and switches layouts accessibly',async({page})=>{
  await openProgram(page);
  const group=page.getByRole('group',{name:'Program layout'});
  const sequence=group.getByRole('radio',{name:'Sequence',exact:true});
  const schedule=group.getByRole('radio',{name:'Monday–Sunday',exact:true});
  await expect(sequence).toBeChecked();
  await schedule.check();
  await expect(page.locator('.day-section')).toHaveCount(8);
  await sequence.check();
  await expect(page.locator('.day-section')).toHaveCount(1);
  await sequence.focus();await page.keyboard.press('ArrowRight');
  await expect(schedule).toBeChecked();await expect(schedule).toBeFocused();
  await expect(schedule.locator('..')).toHaveCSS('outline-style','solid');
  for(const name of ['Import program','Export program']) {
    const button=page.locator('.program-file-actions').getByRole('button',{name,exact:true});
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
  for(const width of [1280,375]) {
    await page.setViewportSize({width,height:900});
    for(const error of [false,true]) {
      if(error)await page.locator('[data-file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
      if(error)await expect(page.locator('[data-program-error]')).toContainText('not valid JSON');
      const toolbar=await page.locator('.program-toolbar').boundingBox();
      const grid=await page.locator('.program-grid').boundingBox();
      expect(grid.y-toolbar.y-toolbar.height).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test('weekly body heat is independent from goals',async({page})=>{
  await openProgram(page);await importProgram(page);
  await expect(page.locator('#body-map figure')).toHaveCount(2);
  expect(await page.locator('#body-map .region').evaluateAll(nodes=>new Set(nodes.map(n=>n.dataset.muscle)).size)).toBe(12);
  await expect(page.locator('.region[data-muscle="Side delts"]')).toHaveCount(2);
  await expect(region(page,'Chest')).toHaveAttribute('data-heat','2');
  await expect(page.locator('#heat-key li')).toHaveText(['0','0.5–6','6.5–12','12.5–18','18.5+']);
  await region(page,'Chest').locator('path').first().click();
  await page.getByRole('button',{name:'Set weekly goals',exact:true}).click();
  await page.getByLabel('Chest weekly goal',{exact:true}).fill('30');
  await expect(page.locator('#readout')).toContainText('Chest 7 / 30 sets');
  await expect(page.locator('#readout')).not.toHaveClass(/is-fading/);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(row(page,'Chest')).toHaveAttribute('data-status','under');
  await expect(region(page,'Chest')).toHaveAttribute('data-heat','2');
  await expect(row(page,'Chest').locator('.value')).toHaveText('7 / 30');
});

test('map and rows share muscle interaction and keyboard preview',async({page})=>{
  await openProgram(page);await importProgram(page);
  await region(page,'Chest').locator('path').first().click();
  await expect(row(page,'Chest')).toHaveAttribute('aria-pressed','true');
  await row(page,'Chest').click();
  await expect(region(page,'Chest')).not.toHaveClass(/is-selected/);
  await page.keyboard.press('Tab');
  await expect(row(page,'Lats')).toBeFocused();
  await expect(page.locator('#readout')).toContainText('Lats 3 sets');
  await page.keyboard.press('Enter');
  await expect(row(page,'Lats')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Space');
  await expect(row(page,'Lats')).toHaveAttribute('aria-pressed','false');
  await page.mouse.move(0,0);await page.getByLabel('Program name',{exact:true}).focus();
  await expect(page.locator('#readout')).toHaveText('Tap a muscle to highlight its workouts.');
});

test('empty map permits zero-volume selection without revealing irrelevant rows',async({page})=>{
  await openProgram(page);
  await expect(page.locator('.region[data-heat="0"]')).toHaveCount(13);
  await region(page,'Calves').locator('path').first().click();
  await expect(page.locator('#readout')).toContainText('Calves 0 sets (0 direct · 0 indirect) · 0 workouts');
  await expect(row(page,'Calves')).toBeHidden();
});

test('hover grace and interrupted fades show the newest subject and clean up on navigation',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openProgram(page);await importProgram(page);
  await region(page,'Chest').locator('path').first().click();
  await pointAt(page,'Lats');
  await expect(page.locator('#readout')).toContainText('Lats 3 sets');
  // Dispatch mouse movement synchronously to exercise the grace window without driver latency.
  await page.locator('.panel-head').dispatchEvent('pointerover',{pointerType:'mouse',bubbles:true});
  await expect(region(page,'Lats')).toHaveClass(/is-focus/);
  await region(page,'Triceps').dispatchEvent('pointerover',{pointerType:'mouse',bubbles:true});
  await expect(page.locator('#readout')).toContainText('Triceps 6 sets');
  await page.mouse.move(0,0);
  await expect(page.locator('#readout')).toContainText('Chest 7 sets');
  await row(page,'Lats').dispatchEvent('pointerover',{pointerType:'mouse',bubbles:true});
  await page.getByRole('button',{name:'Edit Press',exact:true}).click();
  await expect(page.getByRole('button',{name:'Back to program',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to program',exact:true}).click();
  await expect(page.locator('#readout')).toHaveText('Tap a muscle to highlight its workouts.');
  expect(errors).toEqual([]);
});

test('weekly map supports touch selection',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:375,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  await openProgram(page);await importProgram(page);
  await region(page,'Chest').locator('path').first().tap();
  await expect(row(page,'Chest')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await region(page,'Chest').locator('path').first().tap();
  await expect(row(page,'Chest')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await row(page,'Lats').tap();
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Pull']);
  await row(page,'Lats').tap();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await context.close();
});

test('muscle interaction highlights matching workouts without saving',async({page})=>{
  await openProgram(page);await importProgram(page);
  const writes=[];
  page.on('request',request=>{if(request.url().includes('/api/')&&['PUT','POST'].includes(request.method()))writes.push(request.url());});
  await row(page,'Chest').hover();
  await expect(page.locator('#readout')).toContainText('Chest 7 sets');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await pointAt(page,'Chest');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await region(page,'Chest').locator('path').first().click();
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await expect(page.locator('.workout-item.is-muscle-match [data-muscle-match]')).toHaveText(['Trains Chest','Trains Chest']);
  await expect(page.locator('.workout-item:visible')).toHaveCount(4);
  await expect(page.locator('#readout')).toContainText('2 workouts');
  await pointAt(page,'Lats');
  await expect(page.locator('#readout')).toContainText('Lats 3 sets');
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await row(page,'Lats').hover();
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await page.mouse.move(0,0);
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await page.getByLabel('Program name',{exact:true}).focus();
  await row(page,'Chest').focus();await page.keyboard.press('Tab');
  await expect(row(page,'Lats')).toBeFocused();
  await expect(page.locator('#readout')).toContainText('Lats 3 sets');
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance']);
  await page.keyboard.press('Enter');
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Pull']);
  await page.keyboard.press('Space');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await row(page,'Chest').click();await row(page,'Chest').click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('mixed primary and secondary involvement produces one workout badge',async({page})=>{
  await openProgram(page);
  const program=programFixture();
  program.workouts.push({name:'Mixed',day:null,goals:{},exercises:[exercise('Press',3,['Chest']),exercise('Assist',2,['Triceps'],['Chest'])]});
  await importProgram(page,program);await row(page,'Chest').click();
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Assistance','Mixed']);
  await expect(page.locator('.workout-item.is-muscle-match [data-muscle-match]')).toHaveText(['Trains Chest','Trains Chest','Trains Chest']);
});

test('mouse deselection clears preview and workout highlights after leaving the panel',async({page})=>{
  await openProgram(page);await importProgram(page);
  await row(page,'Chest').click();await row(page,'Chest').click();
  await expect(row(page,'Chest')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await page.mouse.move(0,0);
  await expect(page.locator('#readout')).toHaveText('Tap a muscle to highlight its workouts.');
  await expect(page.locator('.region.is-focus')).toHaveCount(0);
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
});

test('workout mutations retain highlights and replacements clear them',async({page})=>{
  await openProgram(page);await importProgram(page);
  await region(page,'Chest').locator('path').first().click();
  await page.getByRole('button',{name:'Duplicate Press',exact:true}).click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(3);
  await expect(page.locator('#readout')).toContainText('3 workouts');
  await page.getByRole('button',{name:'Move down Press',exact:true}).first().click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(3);
  await page.getByRole('radio',{name:'Monday–Sunday',exact:true}).check();
  await page.getByLabel('Day for Assistance',{exact:true}).selectOption('2');
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(3);
  await page.getByRole('radio',{name:'Sequence',exact:true}).check();
  await expect(page.locator('.workout-item h3')).toHaveText(['Press','Press','Assistance','Pull','Empty']);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Remove Press',exact:true}).first().click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(2);
  // Draft name and primary choices may be empty; secondary membership still contributes.
  await page.getByRole('button',{name:'Edit Assistance',exact:true}).click();
  await page.getByLabel('Session template name',{exact:true}).fill('');
  await page.getByRole('button',{name:'Expand exercise',exact:true}).click();
  await page.locator('.primary').getByRole('checkbox',{name:'Triceps',exact:true}).uncheck();
  await page.getByRole('button',{name:'Back to program',exact:true}).click();
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(0);
  await expect(row(page,'Chest').locator('.value')).toHaveText('7');
  await region(page,'Chest').locator('path').first().click();await page.mouse.move(0,0);
  await expect(page.locator('.workout-item.is-muscle-match h3')).toHaveText(['Press','Untitled workout']);
  page.once('dialog',dialog=>dialog.dismiss());
  const replacement={...programFixture(),name:'Replacement',workouts:[]};
  await page.locator('[data-file]').setInputFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,kind:'program',program:replacement}))});
  await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(2);
  page.once('dialog',dialog=>dialog.accept());await importProgram(page,replacement);
  await expect(page.locator('.workout-item')).toHaveCount(0);
  await expect(page.locator('.region.is-selected')).toHaveCount(0);
  await expect(page.locator('#readout')).toHaveText('Tap a muscle to highlight its workouts.');
});

for(const webFonts of [true,false])test(`program overview fits narrow, tablet, desktop and landscape layouts (${webFonts?'web':'fallback'} fonts)`,async({page})=>{
  if(!webFonts)await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await openProgram(page);
  await page.evaluate(()=>document.fonts.ready);
  const program=programFixture();program.name='Long program name '.repeat(6);
  program.workouts[0].name='LongWorkoutNameWithoutSpaces'.repeat(5);
  program.goals={Chest:12,Lats:12,Triceps:12,'Front delts':10,'Side delts':10,'Rear delts':10,Abs:10,Quads:12,Hamstrings:12,Calves:12};
  await importProgram(page,program);
  // A saved library template can have a long name even when it is not selected.
  await page.locator('[data-template]').evaluate(select=>select.add(new Option('Long template name '.repeat(12),'long-template')));
  for(const [width,height] of [[375,900],[800,900],[1280,900],[667,375],[320,750]]) {
    await page.setViewportSize({width,height});
    await page.locator('[data-file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
    await expect(page.locator('[data-program-error]')).toContainText('not valid JSON');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const toolbar=await page.locator('.program-toolbar').boundingBox(),grid=await page.locator('.program-grid').boundingBox();
    expect(grid.y-toolbar.y-toolbar.height).toBeGreaterThanOrEqual(16);
    await expect(page.locator('#body-map')).toBeVisible();await expect(page.locator('#heat-key')).toBeVisible();
    expect((await page.getByRole('button',{name:'Set weekly goals',exact:true}).boundingBox()).height).toBeLessThanOrEqual(48);
    if(width<=800) {
      const panel=await page.locator('[data-weekly-panel]').boundingBox(),workouts=await page.locator('[data-workouts]').boundingBox();
      expect(panel.y+panel.height).toBeLessThanOrEqual(workouts.y);
    }
    if(width===375||width===1280)await page.screenshot({path:`.superpowers/sdd/2026-10-24-program-overview/overview-${width}.png`,fullPage:true});
  }
  // Double-size text exercises readable wrapping without changing fixed pixel spacings.
  await page.setViewportSize({width:375,height:900});
  await page.evaluate(()=>{
    const sizes=[...document.querySelectorAll('body *')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);
    sizes.forEach(([el,size])=>{el.style.fontSize=`${size*2}px`;});
  });
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [375,320]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await page.locator('#volume-title').boundingBox()).width).toBeGreaterThanOrEqual(140);
    expect((await page.locator('.panel-head').boundingBox()).height).toBeLessThan(300);
  }
  await page.getByRole('radio',{name:'Sequence',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'Monday–Sunday',exact:true}).locator('..')).toHaveCSS('outline-style','solid');
});
