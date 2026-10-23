import {test,expect} from '@playwright/test';
async function login(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
}
test('logout is an accessible icon with a dismissible tooltip',async({page})=>{
 await login(page);
 const logout=page.getByRole('button',{name:'Log out',exact:true});
 await expect(logout).toHaveText('');await expect(logout.locator('svg')).toHaveAttribute('aria-hidden','true');
 await logout.focus();await expect(page.getByRole('tooltip')).toHaveText('Log out');
 await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(logout).toBeFocused();
 await page.mouse.move(0,0);await logout.hover();await expect(page.getByRole('tooltip')).toHaveText('Log out');
 await logout.click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByRole('tooltip')).toHaveCount(0);
});
test('navigation shows active tabs and respects motion preference',async({page})=>{
 await login(page);const programs=page.getByRole('link',{name:'Programs',exact:true});
 await expect(programs).toHaveAttribute('aria-current','page');
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toContain('0.15s');
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await expect(page.getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
});
