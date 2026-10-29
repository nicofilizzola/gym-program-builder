import {test,expect} from '@playwright/test';
test('editing a program occurrence updates its shared template and every repeated occurrence',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByLabel('Session template name').fill('Shared push');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('link',{name:'Programs',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();
 await page.getByRole('combobox',{name:'Session template',exact:true}).selectOption({label:'Shared push'});await page.getByRole('button',{name:'Add template',exact:true}).click();
 await page.getByRole('button',{name:'Duplicate Shared push',exact:true}).click();await expect(page.locator('.workout-item')).toHaveCount(2);
 await page.getByRole('button',{name:'Edit Shared push',exact:true}).first().click();await expect(page).toHaveURL(/programs\/[^/]+\/workouts\//);
 await expect(page.getByRole('link',{name:'Shared template',exact:true})).toBeVisible();
 await page.getByLabel('Session template name').fill('Updated push');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('button',{name:'Back to program',exact:true}).click();await expect(page.locator('.workout-item h3')).toHaveText(['Updated push','Updated push']);
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('link',{name:'Updated push',exact:true}).click();await expect(page.getByLabel('Session template name')).toHaveValue('Updated push');
});
