import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,headers} from './workout-helper.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const nav=page=>page.getByRole('navigation',{name:'Main'});
test.beforeEach(async({page})=>{await login(page);await resetWorkouts(page);await page.request.put('/api/settings/active-program',{headers,data:{programId:null}});});
test.afterEach(async({page})=>{await resetWorkouts(page).catch(()=>{});});
async function program(page){
 const {id:templateId}=await createLinkedTemplate(page,'Upper body A');
 const {record:template}=await (await page.request.get('/api/documents/'+templateId)).json();
 await page.request.put('/api/documents/'+templateId,{headers,data:{revision:template.revision,document:{...template.document,coverId:'barbell'}}});
 const id=crypto.randomUUID();
 const response=await page.request.post('/api/documents',{headers,data:{id,kind:'program',document:{name:'Home cycle',mode:'simple',goals:{},workouts:[{id:'a',templateId,day:null}]}}});
 expect(response.ok()).toBeTruthy();
 await page.request.put('/api/settings/active-program',{headers,data:{programId:id}});
 return {id,templateId};
}
test('mobile defaults to Home, history stays separate and explicit routes survive resize',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Your training'})).toBeVisible();
 const names=await nav(page).getByRole('link').evaluateAll(links=>links.map(link=>link.innerText.trim()));
 expect(names).toEqual(['Home','Library','History','User']);
 await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
 const box=await nav(page).getByRole('link',{name:'Home',exact:true}).boundingBox();expect(box.x+box.width/2).toBeCloseTo(390/8,0);
 await expect(page.locator('.workout-home').getByText(/history/i)).toHaveCount(0);
 await nav(page).getByRole('link',{name:'History',exact:true}).click();await expect(page).toHaveURL(/#\/workouts$/);
 await page.setViewportSize({width:1366,height:768});await expect(page).toHaveURL(/#\/workouts$/);
 await expect(nav(page).getByRole('link',{name:'Workouts',exact:true})).toBeVisible();await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toBeHidden();
 await page.goto('/');await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 expect(await nav(page).getByRole('link').evaluateAll(links=>links.filter(link=>link.getBoundingClientRect().width).map(link=>link.innerText.trim()))).toEqual(['Programs','Session templates','Exercise catalog','Workouts']);
});
test('recommended session starts directly once and Resume keeps its snapshot cover offline',async({page})=>{
 const {templateId}=await program(page);await page.goto('/#/home');await page.reload();
 await expect(page.getByRole('heading',{name:'Upper body A'})).toBeVisible();
 await expect(page.getByText('Up next',{exact:true})).toBeVisible();
 await page.screenshot({path:'.superpowers/sdd/2026-11-06-mobile-training-home/integrated-home-390.png'});
 await page.getByRole('button',{name:'Start workout',exact:true}).dblclick();
 await expect(page.getByRole('textbox',{name:'Workout name'})).toBeVisible();
 const {record:active}=await (await page.request.get('/api/workouts/active')).json();
 await expect.poll(async()=>Boolean((await (await page.request.get('/api/workouts/active')).json()).record)).toBe(true);
 const {record:template}=await (await page.request.get('/api/documents/'+templateId)).json();
 await page.request.put('/api/documents/'+templateId,{headers,data:{revision:template.revision,document:{...template.document,coverId:'machines'}}});
 await nav(page).getByRole('link',{name:'Home',exact:true}).click();
 await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
 await expect(page.locator('.home-cover-image')).toHaveAttribute('src',/barbell\.webp/);
 await expect(page.locator('.workout-bar')).toBeHidden();
 await page.context().setOffline(true);await page.getByRole('button',{name:'Resume workout',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Workout name'})).toBeVisible();
 await nav(page).getByRole('link',{name:'Home',exact:true}).click();await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
 await page.context().setOffline(false);await nav(page).getByRole('link',{name:'Library',exact:true}).click();await expect(page.locator('.workout-bar')).toBeVisible();
});
test('fallback opens picker and setup forces Program, then adopts successful activation',async({page})=>{
 await program(page);await page.request.put('/api/settings/active-program',{headers,data:{programId:null}});
 await page.goto('/#/home');await page.reload();await page.getByRole('button',{name:'Set active program',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Program',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:/Make .* active/}).click();
 await expect(page.locator('.workout-home .home-start')).toBeEnabled();
 await expect(page.locator('.workout-home [data-setup]')).toBeHidden();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Upper body A'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeFocused();
});
test('populated Home stays reachable across phone, breakpoint, desktop and enlarged text layouts',async({page})=>{
 await program(page);await page.goto('/#/home');await page.reload();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeVisible();
 for(const [width,height] of [[320,740],[360,800],[390,844],[760,1024],[761,1024],[768,1024],[1366,768],[1440,900],[1920,1080],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const start=page.getByRole('button',{name:'Start workout',exact:true});await expect(start).toBeVisible();
  const button=await start.boundingBox();expect(button.height).toBeGreaterThanOrEqual(54);
  if(width===390){
   const tabs=await nav(page).boundingBox(),alternative=await page.getByRole('button',{name:'Choose another workout'}).boundingBox();
   expect(alternative.y+alternative.height).toBeLessThanOrEqual(tabs.y);
  }
  if(width===760)await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toBeVisible();
  if(width===761)await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toBeHidden();
  await page.screenshot({path:'.superpowers/sdd/2026-11-06-mobile-training-home/layout-'+width+'x'+height+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{
  for(const element of document.querySelectorAll('.workout-home h1,.workout-home h2,.workout-home p,.workout-home button')){
   const style=getComputedStyle(element);element.style.fontSize=parseFloat(style.fontSize)*2+'px';
  }
  document.querySelector('.home-cover h2').textContent='A very long workout session name that must remain readable';
  document.querySelector('.home-program').textContent='A long active program name with several training priorities and a detailed weekly schedule';
 });
 await page.getByRole('button',{name:'Choose another workout'}).scrollIntoViewIfNeeded();
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 const alternative=await page.getByRole('button',{name:'Choose another workout'}).boundingBox(),tabs=await nav(page).boundingBox();
 expect(alternative.y+alternative.height).toBeLessThanOrEqual(tabs.y);
 const programBox=await page.locator('.home-program').boundingBox(),timingBox=await page.locator('.home-timing').boundingBox();
 expect(programBox.y+programBox.height).toBeLessThan(timingBox.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.superpowers/sdd/2026-11-06-mobile-training-home/layout-390-enlarged.png',fullPage:true});
});
