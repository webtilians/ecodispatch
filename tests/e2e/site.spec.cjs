const { test, expect } = require('@playwright/test');

test('v0.8 boots, translates, runs worker and short validation', async ({ page }) => {
  const critical=[];
  page.on('pageerror', error=>critical.push('pageerror: '+error.message));
  page.on('console', msg=>{
    if(msg.type()==='error')critical.push('console: '+msg.text());
  });

  await page.goto('/?lang=en#ablation');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('[data-i18n="ab.title"]')).toContainText('v0.8');
  await expect(page.locator('#ab-run')).toBeEnabled();

  await page.locator('[data-lang="es"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','es');
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');

  // UI exposes 500/1000; inject 10 only for CI speed. Worker accepts >=10.
  await page.locator('#ab-samples').evaluate(select=>{
    const option=document.createElement('option');option.value='10';option.textContent='10';select.append(option);select.value='10';
  });
  await page.locator('#ab-run').click();
  await expect(page.locator('#ab-results')).toBeVisible({timeout:120000});
  await expect(page.locator('#ab-table tbody tr')).toHaveCount(9);
  await expect(page.locator('#ab-front')).not.toBeEmpty();
  await expect(page.locator('#ab-json')).toBeEnabled();

  await page.locator('#mc-samples').evaluate(select=>{
    const option=document.createElement('option');option.value='10';option.textContent='10';select.append(option);select.value='10';
  });
  await page.locator('#mc-run').click();
  await expect(page.locator('#mc-export-json')).toBeEnabled({timeout:120000});

  expect(critical).toEqual([]);
});
