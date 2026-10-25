import {test,expect} from '@playwright/test';
test('legacy library import and complete program export round trip without identities',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Session templates',exact:true})).toBeVisible();
 await page.locator('[data-file]').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"exercises":[],"goals":{"Chest":4.5}}')});
 await expect(page.getByLabel('Session template name')).toHaveValue('Imported session template');
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const document={version:2,kind:'program',program:{name:'Imported week',mode:'simple',workouts:[{name:'Monday upper',day:0,exercises:[],goals:{}}],goals:{Chest:30}}};
 await page.locator('[data-file]').setInputFiles({name:'week.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Imported week');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export program',exact:true}).click();const file=await download;
 const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk;
 expect(JSON.parse(text)).toEqual({...document,program:{...document.program,workouts:document.program.workouts.map(w=>({...w,extraMinutes:5,bufferPercent:10}))}});
 await page.getByRole('radio',{name:'Monday–Sunday',exact:true}).check();await expect(page.getByLabel('Day for Monday upper')).toHaveValue('0');
});
