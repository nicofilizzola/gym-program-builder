import {test,expect} from '@playwright/test';
test('personal libraries autosave drafts and survive reload with duplicate names',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByLabel('Session template name').fill('Library upper');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await page.reload();
 await expect(page.getByLabel('Session template name')).toHaveValue('Library upper');
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open Library upper',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Duplicate Library upper',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open Library upper',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
