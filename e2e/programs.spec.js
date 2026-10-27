import {test,expect} from '@playwright/test';
test('program copies are independent and weekly goals and schedules survive mode changes',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByLabel('Session template name').fill('Source upper');await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByRole('combobox',{name:'Exercise',exact:true}).fill('Barbell bench press');await page.getByRole('combobox',{name:'Exercise',exact:true}).press('ArrowDown');await page.getByRole('combobox',{name:'Exercise',exact:true}).press('Enter');
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('link',{name:'Programs',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();await page.getByLabel('Program name',{exact:true}).fill('Week A');
 for(let i=0;i<2;i++){await page.getByLabel('Session template to copy').selectOption({label:'Source upper'});await page.getByRole('button',{name:'Add template',exact:true}).click();await expect(page.locator('.workout-item')).toHaveCount(i+1);}
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('6');
 await page.getByRole('button',{name:'Edit Source upper',exact:true}).first().click();
 await page.getByLabel('Session template name').fill('Independent upper');await page.getByRole('button',{name:'Expand exercise',exact:true}).click();await page.getByLabel('Sets',{exact:true}).fill('4');
 await page.getByRole('button',{name:'Back to program',exact:true}).click();
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('7');
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 const independent=page.getByRole('button',{name:'Reorder Independent upper',exact:true});await independent.focus();for(let i=0;i<7;i++)await page.keyboard.press('Alt+ArrowUp');await page.getByRole('button',{name:'Reorder Source upper',exact:true}).focus();await page.keyboard.press('Alt+ArrowUp');
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.locator('[data-sort-group="0"] h3')).toHaveText('Independent upper');await expect(page.locator('[data-sort-group="6"] h3')).toHaveText('Source upper');
 await page.getByRole('button',{name:'Set weekly goals',exact:true}).click();await page.getByLabel('Chest weekly goal',{exact:true}).fill('30');await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('7 / 30');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Week A');await expect(page.locator('[data-sort-group="6"] h3')).toHaveText('Source upper');
 await page.getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('link',{name:'Source upper',exact:true}).click();await expect(page.locator('.volume-row[data-muscle="Chest"] .value')).toHaveText('3');
});
