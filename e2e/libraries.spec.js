import {test,expect} from '@playwright/test';
test('personal libraries autosave drafts and survive reload with distinct duplicate names',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByLabel('Session template name').fill('Library upper');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(page.getByLabel('Session template name')).toHaveValue('Library upper');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('link',{name:'Library upper',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Duplicate Library upper',exact:true}).click();
 await expect(page.getByRole('link',{name:'Library upper',exact:true})).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Library upper 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Duplicate Library upper',exact:true}).click();
 await expect(page.getByRole('link',{name:'Library upper 2',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});

test('program library duplicates receive independent names and keep shared template identities',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const source=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Named copy session',goals:{},exercises:[]}});return api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Named copy program',mode:'schedule',goals:{},workouts:[{id:crypto.randomUUID(),templateId:template.id,day:0}]}});});
 await page.reload();await page.getByRole('button',{name:'Duplicate Named copy program',exact:true}).click();await expect(page.getByRole('link',{name:'Named copy program 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Duplicate Named copy program',exact:true}).click();await expect(page.getByRole('link',{name:'Named copy program 2',exact:true})).toBeVisible();
 const copies=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js');const api=createApiClient();return Promise.all((await api.list('program')).filter(r=>r.name.startsWith('Named copy program ')).map(r=>api.get(r.id)));});
 expect(copies).toHaveLength(2);for(const copy of copies){expect(copy.document.workouts[0].templateId).toBe(source.document.workouts[0].templateId);expect(copy.document.workouts[0].id).not.toBe(source.document.workouts[0].id);}
 await page.reload();await expect(page.getByRole('link',{name:'Named copy program',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Named copy program 2',exact:true})).toBeVisible();
});
