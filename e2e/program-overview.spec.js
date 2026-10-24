import {test,expect} from '@playwright/test';

async function openProgram(page) {
  await page.goto('/');
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'New program',exact:true}).click();
  await page.getByLabel('Program name',{exact:true}).fill('Overview week');
}

test('program toolbar groups file actions and switches layouts accessibly',async({page})=>{
  await openProgram(page);
  const group=page.getByRole('group',{name:'Program layout'});
  const sequence=group.getByRole('radio',{name:'Sequence',exact:true});
  const schedule=group.getByRole('radio',{name:'Monday–Sunday',exact:true});
  await expect(sequence).toBeChecked();
  await schedule.check();
  await expect(page.locator('.day-section')).toHaveCount(8);
  await sequence.check();
  await expect(page.locator('.day-section')).toHaveCount(1);
  await sequence.focus();await page.keyboard.press('ArrowRight');
  await expect(schedule).toBeChecked();await expect(schedule).toBeFocused();
  await expect(schedule.locator('..')).toHaveCSS('outline-style','solid');
  for(const name of ['Import program','Export program']) {
    const button=page.locator('.program-file-actions').getByRole('button',{name,exact:true});
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
  for(const width of [1280,375]) {
    await page.setViewportSize({width,height:900});
    for(const error of [false,true]) {
      if(error)await page.locator('[data-file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
      if(error)await expect(page.locator('[data-program-error]')).toContainText('not valid JSON');
      const toolbar=await page.locator('.program-toolbar').boundingBox();
      const grid=await page.locator('.program-grid').boundingBox();
      expect(grid.y-toolbar.y-toolbar.height).toBeGreaterThanOrEqual(24);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});
