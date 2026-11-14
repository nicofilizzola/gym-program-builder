import {test,expect} from '@playwright/test';

test('test typography loads every intended face without external font access',async({page})=>{
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.goto('/');
 const loaded=await page.evaluate(async()=>{
  const faces=['400 16px Barlow','500 16px Barlow','600 16px Barlow','600 16px "Barlow Condensed"','700 16px "Barlow Condensed"'];
  return Promise.all(faces.map(async face=>(await document.fonts.load(face)).map(f=>f.status)));
 });
 expect(loaded).toEqual([['loaded'],['loaded'],['loaded'],['loaded'],['loaded']]);
});
