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
      expect(grid.y-toolbar.y-toolbar.height).toBeGreaterThanOrEqual(24);
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
  await page.getByRole('button',{name:'Set weekly goals',exact:true}).click();
  await page.getByLabel('Chest weekly goal',{exact:true}).fill('30');
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
  await row(page,'Lats').focus();
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
  await region(page,'Chest').locator('path').first().tap();
  await expect(row(page,'Chest')).toHaveAttribute('aria-pressed','false');
  await context.close();
});
