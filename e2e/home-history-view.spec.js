import {test,expect} from '@playwright/test';

const records=n=>Array.from({length:n},(_,i)=>({id:String(i),name:'Workout '+i,startedAt:new Date(2026,10,12-i).toISOString(),doneSets:3,source:{kind:'blank'}}));
const ready=(n=3,extra={})=>({phase:'ready',data:{records:records(n),hasMore:false},pending:null,error:null,loadingMore:false,moreError:null,...extra});
async function mount(page,state){
 await page.goto('/');
 await page.evaluate(async state=>{
  const {mountHomeHistory}=await import('/src/home-history-view.js');
  document.body.innerHTML='<div id="fixture"></div>';window.calls={retry:0,more:0};
  window.view=mountHomeHistory(document.querySelector('#fixture'),{onOpen(){},workoutHref:id=>'#/workouts/'+id,onRetry:()=>window.calls.retry++,onLoadMore:()=>window.calls.more++});
  window.view.setState(state);
 },state);
}
const update=(page,state)=>page.evaluate(state=>window.view.setState(state),state);
test.use({viewport:{width:390,height:844}});

test('states read in the section',async({page})=>{
 await mount(page,ready(0,{phase:'loading',data:null}));
 await expect(page.getByRole('status')).toHaveText('Loading…');await expect(page.getByRole('button')).toHaveCount(0);
 await update(page,ready(0,{phase:'error',data:null,error:{message:'offline'}}));
 await expect(page.getByRole('status')).toHaveText('Workouts could not be loaded. Connect to see your history.');
 await page.getByRole('button',{name:'Retry loading history',exact:true}).click();expect(await page.evaluate(()=>window.calls.retry)).toBe(1);
 await expect(page.locator('.home-history-empty')).toBeHidden();
 await update(page,ready(3,{error:{message:'offline'}}));
 await expect(page.locator('.workout-history-row')).toHaveCount(3);await expect(page.getByRole('status')).toHaveText("Couldn't refresh. Showing previously loaded data.");
 await update(page,ready(0));await expect(page.getByText('No workouts yet. Your finished workouts appear here.')).toBeVisible();
 await update(page,ready(0,{phase:'error',data:null,error:{message:'offline'},pending:records(1)[0]}));
 await expect(page.locator('.workout-history-row').first()).toContainText('Not synced yet');
 expect(await page.evaluate(()=>Boolean(document.querySelector('.workout-history-row').compareDocumentPosition(document.querySelector('.home-history-status'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});
test('headings nest under History',async({page})=>{
 await mount(page,ready());await expect(page.getByRole('heading',{level:2,name:'History',exact:true})).toBeVisible();
 await expect(page.locator('h3.workout-history-day')).toHaveCount(3);await expect(page.locator('.workout-history-row h4 a')).toHaveCount(3);
 expect(await page.evaluate(()=>window.view.getNavigationState())).toEqual({visibleCount:3});
});
test('the end of the list',async({page})=>{
 await mount(page,ready(3,{loadingMore:true}));await expect(page.locator('.home-history-end [role=status]')).toHaveText('Loading…');
 await update(page,ready(3,{moreError:{message:'offline'}}));await expect(page.locator('.home-history-end')).toContainText("Couldn't load older workouts.");
 await page.getByRole('button',{name:'Retry',exact:true}).click();expect(await page.evaluate(()=>window.calls.more)).toBe(1);
 await update(page,ready(30,{data:{records:records(30),hasMore:true}}));
 await page.getByRole('button',{name:'Load more',exact:true}).click();expect(await page.evaluate(()=>window.calls.more)).toBeGreaterThanOrEqual(2);
 await update(page,ready());await expect(page.locator('.home-history-end')).toBeEmpty();
});
test('scrolling near the end loads once at a time',async({page})=>{
 await mount(page,ready(30,{data:{records:records(30),hasMore:true}}));await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await expect.poll(()=>page.evaluate(()=>window.calls.more)).toBe(1);
 await update(page,ready(30,{data:{records:records(30),hasMore:true},loadingMore:true}));await page.evaluate(()=>window.scrollBy(0,-10));
 expect(await page.evaluate(()=>window.calls.more)).toBe(1);
 await update(page,ready(30,{data:{records:records(30),hasMore:true},moreError:{message:'offline'}}));
 await page.waitForTimeout(100);expect(await page.evaluate(()=>window.calls.more)).toBe(1);
 await page.getByRole('button',{name:'Retry',exact:true}).click();expect(await page.evaluate(()=>window.calls.more)).toBe(2);
});
test('a short first page keeps loading on a tall screen',async({page})=>{
 await page.setViewportSize({width:390,height:1400});await mount(page,ready(3,{data:{records:records(3),hasMore:true}}));
 await expect.poll(()=>page.evaluate(()=>window.calls.more)).toBe(1);
 await update(page,ready(6,{data:{records:records(6),hasMore:true}}));await expect.poll(()=>page.evaluate(()=>window.calls.more)).toBe(2);
 await update(page,ready(6));await page.waitForTimeout(100);expect(await page.evaluate(()=>window.calls.more)).toBe(2);
});
test('the next page loads within one viewport height below the viewport',async({page})=>{
 await mount(page,ready(11,{data:{records:records(11),hasMore:true}}));
 const end=await page.locator('.home-history-end').boundingBox();expect(end.y).toBeGreaterThan(844+390);expect(end.y).toBeLessThan(844*2);
 await expect.poll(()=>page.evaluate(()=>window.calls.more)).toBe(1);
});
test('focus stays on a row link across updates',async({page})=>{
 await mount(page,ready());const link=page.locator('.workout-history-row a').nth(1);await link.focus();await update(page,ready(4));await expect(link).toBeFocused();
});

test('pagination Retry keeps its focus through loading and another failure',async({page})=>{
 const data={records:records(3),hasMore:true};await mount(page,ready(3,{data,moreError:{message:'offline'}}));
 const retry=page.locator('.home-history-end button');await retry.focus();await retry.evaluate(node=>window.retryNode=node);await page.keyboard.press('Enter');
 await update(page,ready(3,{data,loadingMore:true,moreError:{message:'offline'}}));await expect(retry).toBeFocused();await expect(retry).toHaveAttribute('aria-disabled','true');await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.calls.more)).toBe(1);
 await update(page,ready(3,{data,moreError:{message:'offline'}}));await expect(retry).toBeFocused();expect(await retry.evaluate(node=>node===window.retryNode)).toBe(true);
});

test('Load more stays focused until the final page transfers focus to its first new row',async({page})=>{
 await mount(page,ready(3,{data:{records:records(3),hasMore:true}}));const more=page.locator('.home-history-end button');await more.focus();await more.evaluate(node=>window.moreNode=node);
 await update(page,ready(3,{data:{records:records(3),hasMore:true}}));await expect(more).toBeFocused();expect(await more.evaluate(node=>node===window.moreNode)).toBe(true);
 await page.keyboard.press('Enter');await update(page,ready(3,{data:{records:records(3),hasMore:true},loadingMore:true}));await expect(more).toBeFocused();
 await update(page,ready(6));await expect(page.locator('.workout-history-row a').nth(3)).toBeFocused();await expect(page.locator('.home-history-end')).toBeEmpty();
 await page.locator('.workout-history-row a').first().focus();await update(page,ready(7));await expect(page.locator('.workout-history-row a').first()).toBeFocused();
});

test('fast pages stop loading when the appended end leaves the near-end zone',async({page})=>{
 await page.goto('/');await page.evaluate(async records=>{
  const {mountHomeHistory}=await import('/src/home-history-view.js'),{createHistoryPageData}=await import('/src/history-page-data.js'),{createRootResourceCache}=await import('/src/root-resource-cache.js');
  document.body.innerHTML='<div id="fixture"></div>';window.pageCalls=0;
  const view=mountHomeHistory(document.querySelector('#fixture'),{onOpen(){},workoutHref:id=>'#/workouts/'+id,onRetry:()=>loader.refresh(),onLoadMore:()=>loader.loadMore()});
  const loader=createHistoryPageData({cache:createRootResourceCache(),api:{listWorkouts:async args=>{window.pageCalls++;const start=args?records.findIndex(row=>row.id===args.beforeId)+1:0;return {records:records.slice(start,start+30),hasMore:start+30<records.length};}},onState:state=>view.setState(state)});
  window.loader=loader;loader.start();loader.settled();
 },records(150));
 await expect(page.locator('.workout-history-row')).toHaveCount(30);await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
 await expect(page.locator('.workout-history-row')).toHaveCount(60);await page.waitForTimeout(100);expect(await page.evaluate(()=>window.pageCalls)).toBe(2);
 expect((await page.locator('.home-history-end').boundingBox()).y).toBeGreaterThan(844*2);
});
