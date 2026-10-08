const {test,expect}=require('@playwright/test');
const audit=require('../../web/data/real-fire-summary-v1.7.json');
test('EGIF summary, ES/EN and no incident payload in dashboard',async({page})=>{
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('/?lang=es#real-fire-data');
  await expect(page.locator('#rf-durations tbody tr')).toHaveCount(3);
  await expect(page.locator('.rf-bin')).toHaveCount(43);
  await expect(page.locator('#real-fire-content')).toContainText('Sin ajuste de Poisson');
  expect(await page.locator('.rf-metrics strong').nth(1).textContent()).toBe(audit.valid_coordinates.toLocaleString('es'));
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('#rf-title')).toContainText('Real Málaga');
  await expect(page.locator('#real-fire-content')).toContainText('Not brigade occupancy');
  expect(requests.some(x=>x.includes('real-fire-incidents'))).toBe(false);
  expect(errors).toEqual([]);
});
test('EGIF fetch failure remains isolated and translated',async({page})=>{
  await page.route('**/data/real-fire-summary-v1.7.json*',r=>r.abort());
  await page.goto('/?lang=en#real-fire-data');
  await expect(page.locator('#real-fire-content')).toContainText('could not be loaded');
  await expect(page.locator('#tr-detail tbody tr')).toHaveCount(18);
  await page.locator('[data-lang="es"]').click();
  await expect(page.locator('#real-fire-content')).toContainText('No se pudo cargar');
});
test('EGIF narrow layout stays within viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?lang=en#real-fire-data');
  await expect(page.locator('#rf-durations tbody tr')).toHaveCount(3);
  const box=await page.locator('#real-fire-content').boundingBox();
  expect(box.x+box.width).toBeLessThanOrEqual(390);
  expect(await page.locator('#real-fire-content').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
