const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

test('v1.5 temporal fire loads six fixed conditions, occupancy and exports',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?lang=es#temporal-fire');
  await expect(page.locator('#tf-snapshot option')).toHaveCount(3);
  await expect(page.locator('#tf-load option')).toHaveCount(2);
  await expect(page.locator('#tf-policy option')).toHaveCount(7);
  await expect(page.locator('#tf-results tbody tr')).toHaveCount(7);
  await expect(page.locator('#tf-status')).toContainText('v1.5');
  await expect(page.locator('#tf-events')).not.toHaveText('—');
  await expect(page.locator('#tf-coverage')).not.toHaveText('—');
  await expect(page.locator('#tf-occupancy .tf-occ-row')).toHaveCount(4);

  const lowEvents=await page.locator('#tf-events').textContent();
  await page.locator('#tf-load').selectOption('high');
  await expect(page.locator('#tf-events')).not.toHaveText(lowEvents);
  const highCoverage=await page.locator('#tf-coverage').textContent();
  expect(parseFloat(highCoverage)).toBeLessThan(90);

  await page.locator('#tf-policy').selectOption('0.2');
  await expect(page.locator('#tf-policy-label')).toHaveText('λ=0.2');

  const download=page.waitForEvent('download');await page.locator('#tf-json').click();
  const json=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
  expect(json.version).toBe('1.5');expect(json.confirmatory).toBe(false);expect(json.selection.regime).toBe('high');expect(json.result.summary).toHaveLength(7);

  const csvDownload=page.waitForEvent('download');await page.locator('#tf-csv').click();
  const csv=fs.readFileSync(await (await csvDownload).path(),'utf8');
  expect(csv).toContain('bootstrap_low');expect(csv).toContain('high');

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('[data-tf="queue"]')).toHaveText('Queue and concurrency');
  await expect(page.locator('[data-tf="scope"]')).toContainText('Exploratory');
  await expect(page.locator('#fd-results tbody tr')).toHaveCount(7);
  await expect(page.locator('#sh-nodes tbody tr')).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('v1.5 data failure is isolated from historical dashboard',async({page})=>{
  await page.route('**/data/temporal-fire-v1.5.json*',route=>route.abort());
  await page.goto('/?lang=en#temporal-fire');
  await expect(page.locator('#tf-status')).toContainText('could not be loaded');
  await expect(page.locator('#tf-json')).toBeDisabled();
  await expect(page.locator('#fd-results tbody tr')).toHaveCount(7);
  await expect(page.locator('#hz-annual-high')).toHaveText('25.21%');
});
