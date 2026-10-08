const {test,expect}=require('@playwright/test');

test('v1.6 robustness surface renders fixed K/service grid in ES/EN',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?lang=es#temporal-robustness');
  await expect(page.locator('#tr-k option')).toHaveCount(3);
  await expect(page.locator('#tr-policy option')).toHaveCount(6);
  await expect(page.locator('#tr-summary tbody tr')).toHaveCount(6);
  await expect(page.locator('#tr-detail tbody tr')).toHaveCount(18);
  await expect(page.locator('#tr-neg')).toHaveText('12/18');
  await expect(page.locator('#tr-inc')).toHaveText('6/18');
  await expect(page.locator('#tr-pos')).toHaveText('0/18');
  await expect(page.locator('#tr-robust')).toHaveText('2/6');

  await page.locator('#tr-policy').selectOption('1');
  await expect(page.locator('#tr-neg')).toHaveText('0/18');
  await expect(page.locator('#tr-pos')).toHaveText('18/18');

  await page.locator('#tr-k').selectOption('120');
  await page.locator('#tr-policy').selectOption('0.2');
  await expect(page.locator('#tr-neg')).toHaveText('11/18');
  await expect(page.locator('#tr-inc')).toHaveText('7/18');

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('[data-tr="finding"]')).toHaveText('Main result');
  await expect(page.locator('[data-tr="scope"]')).toContainText('fixed before outcomes');
  await expect(page.locator('#tf-results tbody tr')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('v1.6 fetch failure remains isolated',async({page})=>{
  await page.route('**/data/temporal-robustness-v1.6.json*',route=>route.abort());
  await page.goto('/?lang=en#temporal-robustness');
  await expect(page.locator('#tr-status')).toContainText('could not be loaded');
  await expect(page.locator('#tf-results tbody tr')).toHaveCount(7);
  await expect(page.locator('#fd-results tbody tr')).toHaveCount(7);
});
