const {test,expect}=require('@playwright/test');

test('v1.7.1 historical replay renders frozen result in ES/EN from compact summary only',async({page})=>{
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('/?lang=es#historical-demand-replay');

  await expect(page.locator('#hr-k option')).toHaveCount(3);
  await expect(page.locator('#hr-policy option')).toHaveCount(6);
  await expect(page.locator('#hr-summary tbody tr')).toHaveCount(6);
  await expect(page.locator('#hr-detail tbody tr')).toHaveCount(9);
  await expect(page.locator('#hr-demand')).toHaveText('1464');
  await expect(page.locator('#hr-days')).toHaveText('1194');
  await expect(page.locator('#hr-multi')).toHaveText('210');

  await expect(page.locator('#hr-neg')).toHaveText('0/9');
  await expect(page.locator('#hr-inc')).toHaveText('0/9');
  await expect(page.locator('#hr-pos')).toHaveText('9/9');
  await expect(page.locator('#hr-robust')).toHaveText('0/3');

  await page.locator('#hr-k').selectOption('120');
  await page.locator('#hr-policy').selectOption('0.2');
  await expect(page.locator('#hr-neg')).toHaveText('0/9');
  await expect(page.locator('#hr-inc')).toHaveText('3/9');
  await expect(page.locator('#hr-pos')).toHaveText('6/9');

  await page.locator('#hr-policy').selectOption('1');
  await expect(page.locator('#hr-neg')).toHaveText('0/9');
  await expect(page.locator('#hr-inc')).toHaveText('9/9');
  await expect(page.locator('#hr-pos')).toHaveText('0/9');

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('[data-hr="finding"]')).toHaveText('Main result');
  await expect(page.locator('[data-hr="densityCopy"]')).toContainText('984 of 1,194');

  expect(requests.some(x=>x.includes('historical-demand-v1.7.1-summary.json'))).toBe(true);
  expect(requests.some(x=>/historical-demand-v1\.7\.1\.json/.test(x))).toBe(false);
  expect(errors).toEqual([]);
});

test('v1.7.1 summary fetch failure remains isolated',async({page})=>{
  await page.route('**/data/historical-demand-v1.7.1-summary.json*',route=>route.abort());
  await page.goto('/?lang=en#historical-demand-replay');
  await expect(page.locator('#hr-status')).toContainText('could not be loaded');
  await expect(page.locator('#tr-detail tbody tr')).toHaveCount(18);
  await expect(page.locator('#rf-durations tbody tr')).toHaveCount(3);
});
