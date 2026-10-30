import {test,expect} from '@playwright/test';

async function savedEditor(page,kind){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'New program',exact:true})).toBeVisible();
 const id=await page.evaluate(async kind=>{
  const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();
  const workout={name:'Disclosure workout',goals:{Chest:6},extraMinutes:5,bufferPercent:10,exercises:['Bench press','Row','Curl'].map(name=>({name,sets:3,restSeconds:180,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}))};
  const template=kind==='program'?await api.create({id:crypto.randomUUID(),kind:'template',document:workout}):null;
  const id=crypto.randomUUID();await api.create({id,kind,document:kind==='template'?workout:{name:'Disclosure program',mode:'schedule',goals:{},workouts:[{id:crypto.randomUUID(),templateId:template.id,day:null}]}});return id;
 },kind);
 await page.goto(`/#/${kind==='template'?'templates':'programs'}/${id}`);
 if(kind==='program')await page.locator('.workout-title').filter({hasText:'Disclosure workout'}).click();
 await expect(page.locator('.exercise')).toHaveCount(3);await page.evaluate(()=>document.fonts.ready);
 return id;
}

for(const kind of ['template','program'])test(`saved ${kind} editor preserves data while disclosure and dragging cooperate`,async({page})=>{
 const id=await savedEditor(page,kind),cards=page.locator('.exercise');let mutations=0;
 page.on('request',request=>{if(request.method()==='PUT'&&request.url().includes('/api/documents/'))mutations++;});
 await cards.first().locator('.card-name').click();await cards.nth(1).locator('.card-name').click();
 await expect(page.locator('[data-action=toggle][aria-expanded=true]')).toHaveCount(2);
 await cards.first().locator('[data-action=toggle]').click();await cards.nth(1).locator('[data-action=toggle]').click();
 expect(mutations).toBe(0);
 const a=await cards.first().locator('.card-name').boundingBox(),b=await cards.last().boundingBox();
 await page.mouse.move(a.x+4,a.y+4);await page.mouse.down();await page.mouse.move(a.x+14,a.y+14);await page.mouse.move(b.x+60,b.y+b.height-3);await page.mouse.up();
 await expect(cards.locator('.card-name')).toHaveText(['Row','Curl','Bench press']);
 await expect(page.locator('[data-action=toggle][aria-expanded=false]')).toHaveCount(3);
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await cards.first().locator('.card-name').click();await page.getByLabel('Sets',{exact:true}).first().fill('4');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');expect(mutations).toBeGreaterThan(0);
 if(kind==='program'){await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();await page.locator('.workout-title').filter({hasText:'Disclosure workout'}).click();}
 else{await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('link',{name:'Disclosure workout',exact:true}).click();}
 await expect(page.locator('[data-action=toggle][aria-expanded=false]')).toHaveCount(3);
 await cards.first().locator('.card-name').click();await expect(page.getByLabel('Sets',{exact:true}).first()).toHaveValue('4');
 const response=await page.request.get(`/api/documents/${id}`);expect(response.ok()).toBe(true);
});

test('populated disclosure layouts preserve names targets and body figures',async({page,browser},testInfo)=>{
 await savedEditor(page,'template');
 await page.locator('.card-name').first().click();await page.getByLabel('Exercise name',{exact:true}).first().fill('Long exercise name with deliberate tempo and a controlled range of motion');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 const picker=page.getByRole('combobox',{name:'Exercise',exact:true});await picker.fill('Barbell bench press');await picker.press('ArrowDown');await picker.press('Enter');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.locator('.exercise').last().locator('[data-action=toggle]').click();
 await page.locator('.volume-row[data-muscle=Chest]').click();
 for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[390,844],[768,1024]]){
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.locator('.toggle-btn')).toHaveCount(0);
  if(width>=1100)expect(await page.locator('.body-map svg').first().evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(180);
  await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.move(1,1);
  await page.screenshot({path:testInfo.outputPath(`layout-${width}.png`),fullPage:true});
  if(width===390)await page.locator('.exercise').nth(1).screenshot({path:testInfo.outputPath('mobile-card.png')});
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
 await page.screenshot({path:testInfo.outputPath('text-200.png'),fullPage:true});
 const context=await browser.newContext({hasTouch:true,viewport:{width:1440,height:900}}),hybrid=await context.newPage();
 await savedEditor(hybrid,'template');expect((await hybrid.locator('[data-action=toggle]').first().boundingBox()).width).toBeGreaterThanOrEqual(44);
 const alignment=await hybrid.locator('.exercise').first().evaluate(card=>{const x=selector=>{const range=document.createRange();range.selectNodeContents(card.querySelector(selector));return range.getBoundingClientRect().x;};return {name:x('.card-name'),summary:x('.card-summary')};});
 expect(alignment.summary).toBeGreaterThanOrEqual(0);await context.close();
});

test('narrow tablet headings keep room beside muscle tags and hover preserves highlights',async({page})=>{
 await savedEditor(page,'template');await page.setViewportSize({width:768,height:1024});
 await page.locator('.volume-row[data-muscle=Chest]').click();const card=page.locator('.exercise').first();
 await card.locator('.card-name').hover();await expect(card).toHaveCSS('border-left-color','rgb(249, 115, 22)');
 const heading=await card.locator('.card-identity').boundingBox(),box=await card.boundingBox();expect(heading.width).toBeGreaterThan(box.width*0.65);
});

for(const kind of ['template','program'])test(`${kind} full heading toggles without a disclosure icon`,async({page})=>{
 await savedEditor(page,kind);const card=page.locator('.exercise').first(),heading=card.locator('[data-action=toggle]');
 await expect(card.locator('.toggle-btn')).toHaveCount(0);
 await expect(heading).toHaveAttribute('aria-expanded','false');
 await card.locator('.card-head').click({position:{x:8,y:8}});
 await expect(heading).toHaveAttribute('aria-expanded','true');
 await card.locator('.card-body').click({position:{x:5,y:5}});await expect(heading).toHaveAttribute('aria-expanded','true');
 await heading.focus();await page.keyboard.press('Space');await expect(heading).toHaveAttribute('aria-expanded','false');
 await page.keyboard.press('Enter');await expect(heading).toHaveAttribute('aria-expanded','true');
 const reorder=card.getByRole('button',{name:'Reorder exercise',exact:true});await expect(reorder).toHaveText('');await reorder.click();
 await expect(heading).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');
});

test('exercise heading actions stay underneath the pinned mobile volume panel',async({page})=>{
 await page.setViewportSize({width:390,height:844});await savedEditor(page,'template');
 const covered=await page.evaluate(()=>{
  const head=document.querySelector('.card-head'),panel=document.querySelector('.panel');let h=head.getBoundingClientRect(),p=panel.getBoundingClientRect();window.scrollBy(0,h.top-p.top-60);h=head.getBoundingClientRect();p=panel.getBoundingClientRect();
  const action=head.querySelector('.reorder-action').getBoundingClientRect();const x=action.left+action.width/2,y=action.top+action.height/2;
  return {overlaps:h.bottom>p.top&&h.top<p.bottom,cardAbove:Boolean(document.elementFromPoint(x,y)?.closest('.exercise'))};
 });expect(covered.overlaps).toBe(true);expect(covered.cardAbove).toBe(false);
});

test('collapse surface is expanded-only and header content has a consistent inset',async({page})=>{
 await savedEditor(page,'template');const card=page.locator('.exercise').first(),toggle=card.locator('[data-action=toggle]');
 await toggle.hover();
 expect(await toggle.evaluate(el=>getComputedStyle(el,'::after').backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await toggle.click();await toggle.hover();
 await expect.poll(()=>toggle.evaluate(el=>getComputedStyle(el,'::after').backgroundColor)).toBe('rgba(249, 115, 22, 0.14)');
 const geometry=await card.evaluate(el=>{const head=el.querySelector('.card-head').getBoundingClientRect(),index=el.querySelector('.card-index').getBoundingClientRect(),name=el.querySelector('.card-name').getBoundingClientRect();return {inset:index.left-head.left,delta:Math.abs((index.top+index.height/2)-(name.top+name.height/2))};});
 expect(geometry.inset).toBeGreaterThanOrEqual(12);expect(geometry.delta).toBeLessThan(1);
 await toggle.click();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(toggle).toBeFocused();
 expect(await toggle.evaluate(el=>getComputedStyle(el,'::after').outlineStyle)).toBe('solid');
});
