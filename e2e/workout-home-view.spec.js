import {test,expect} from '@playwright/test';
async function mount(page,kind='recommendation',extra={}){
 await page.goto('/');
 await page.evaluate(async({kind,extra})=>{
  const {mountWorkoutHome}=await import('/src/workout-home-view.js');
  document.body.innerHTML='<div id="fixture"></div>';
  const workout={id:'a',name:'Upper body A',coverId:'dumbbells',exercises:[{sets:3},{sets:3}],extraMinutes:5,bufferPercent:10};
  window.state={kind,today:new Date(2026,10,6),activeLog:null,pending:null,program:{id:'p',name:'Upper / Lower'},
   recommendation:{next:{scheduledDate:'2026-11-06'},workout},error:'',refreshing:false,starting:false,canStart:true,setupAction:null,...extra};
  const view=mountWorkoutHome(document.querySelector('#fixture'),{state:window.state,onStart(){},onResume(){},onChoose(){},onSetup(){},onRetry(){}});
  window.home={update(state){window.state=state;view.update(state);},destroy:view.destroy};
 },{kind,extra});
}
test('Home shows one start, date and two exercises without history',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page);
 await expect(page.getByRole('heading',{name:'Upper body A'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeVisible();
 await expect(page.getByText(/2 exercises/)).toBeVisible();
 await expect(page.locator('time[datetime="2026-11-06"]')).toBeVisible();
 await expect(page.getByText(/history/i)).toHaveCount(0);
 await expect(page.locator('.home-history-host')).toBeEmpty();
 await page.screenshot({path:'.superpowers/sdd/2026-11-06-mobile-training-home/home-view-390.png'});
 const alternative=page.getByRole('button',{name:'Choose another workout'});await alternative.focus();
 await page.evaluate(()=>window.home.update({...window.state,refreshing:true,canStart:false}));
 await expect(alternative).toBeFocused();await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeDisabled();
});
test('resume counts working sets only, zero rows remain honest and image failure is harmless',async({page})=>{
 await mount(page,'resume',{activeLog:{id:'log',name:'Running',coverId:'barbell',source:{kind:'blank'},exercises:[{sets:[{kind:'warmup',done:true},{kind:'working',done:true},{kind:'working',done:false}]}]}});
 await expect(page.getByText('1 of 2 working sets completed')).toBeVisible();
 await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
 await page.evaluate(()=>{window.home.update({...window.state,activeLog:{...window.state.activeLog,exercises:[]}});document.querySelector('.home-cover-image').dispatchEvent(new Event('error'));});
 await expect(page.getByText('No working sets yet')).toBeVisible();
 await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
});
test('empty, unknown, future and sequence states have usable actions and safe text',async({page})=>{
 await mount(page,'empty',{recommendation:null,program:null,setupAction:'set-active',canStart:false});
 await expect(page.getByRole('button',{name:'Choose a workout',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Set active program'})).toBeVisible();
 await page.getByRole('button',{name:'Set active program'}).focus();
 await expect(page.getByRole('button',{name:'Choose another workout'})).toBeHidden();
 await page.evaluate(()=>window.home.update({...window.state,kind:'error',recommendation:null,error:'offline'}));
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await page.evaluate(()=>window.home.update({...window.state,setupAction:null,canStart:true,recommendation:{...window.state.recommendation,workout:{name:'<img src=x>',coverId:'gym',exercises:[],extraMinutes:5,bufferPercent:10},next:{scheduledDate:'2026-11-09'}},kind:'recommendation'}));
 await expect(page.getByRole('heading',{name:'<img src=x>'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeFocused();
 await expect(page.getByText('Up next · Mon, 9 Nov',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.home.update({...window.state,recommendation:{...window.state.recommendation,next:{scheduledDate:null}},kind:'recommendation'}));
 await expect(page.getByText('Up next',{exact:true})).toBeVisible();
});
