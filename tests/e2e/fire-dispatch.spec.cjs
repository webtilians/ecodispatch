const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

test('v1.4 snapshots, map, fleet, paired tables and exports in ES/EN',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?lang=es#fire-dispatch');
  await expect(page.locator('#fd-snapshot option')).toHaveCount(3);
  await expect(page.locator('#fd-nodes tbody tr')).toHaveCount(10);
  await expect(page.locator('#fd-results tbody tr')).toHaveCount(7);
  await expect(page.locator('#fd-map [data-node]')).toHaveCount(10);
  await expect(page.locator('#fd-map [data-station]')).toHaveCount(3);
  await expect(page.locator('#fd-source')).toContainText('2026-10-09T12:00:00Z');
  await expect(page.locator('[data-fd="limit"]')).toContainText('no tres días históricos independientes');
  await expect(page.locator('[data-fd="scope"]')).toContainText('sin preregistro');
  const original=await page.locator('#fd-results').textContent();
  const options=await page.locator('#fd-snapshot option').evaluateAll(opts=>opts.map(o=>o.value));
  await page.locator('#fd-snapshot').selectOption(options[1]);
  await expect(page.locator('#fd-source')).toContainText('2026-10-08T12:00:00Z');
  expect(await page.locator('#fd-results').textContent()).not.toBe(original);
  const download=page.waitForEvent('download');await page.locator('#fd-json').click();
  const jsonFile=await download;const exported=JSON.parse(fs.readFileSync(await jsonFile.path(),'utf8'));
  expect(exported.confirmatory).toBe(false);expect(exported.hazard.id).toBe(options[1]);expect(exported.result.summary).toHaveLength(7);expect(exported.protocol.fleet).toHaveLength(3);
  const csvDownload=page.waitForEvent('download');await page.locator('#fd-csv').click();
  const csv=fs.readFileSync(await (await csvDownload).path(),'utf8');expect(csv.split('\r\n')).toHaveLength(8);expect(csv).toContain(options[1]);expect(csv).toContain('paired_bootstrap_low');
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('[data-fd="fleet"]')).toHaveText('Experimental fleet');
  await expect(page.locator('[data-fd="limit"]')).toContainText('not three independent historical days');
  await expect(page.locator('#fd-nodes tbody tr').first()).toContainText('Very low');
  await page.locator('#fd-snapshot').selectOption(options[2]);
  await expect(page.locator('#fd-source')).toContainText('2026-10-11T12:00:00Z');
  await expect(page.locator('#sh-nodes tbody tr')).toHaveCount(10);
  await expect(page.locator('#hz-annual-high')).toHaveText('25.21%');
  await page.locator('#fire-dispatch').screenshot({path:'test-results/fire-dispatch-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#fire-dispatch').screenshot({path:'test-results/fire-dispatch-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('v1.4 failures and corrupted identities stay isolated',async({page})=>{
  await page.route('**/data/fire-snapshots-v1.4.json',async route=>{
    const response=await route.fetch(),data=await response.json();data.candidates[0].nodes[0].source_value=6;
    await route.fulfill({json:data});
  });
  await page.goto('/?lang=en#fire-dispatch');
  await expect(page.locator('#fd-status')).toContainText('could not be loaded');
  await expect(page.locator('#fd-json')).toBeDisabled();
  await expect(page.locator('#sh-nodes tbody tr')).toHaveCount(10);
  await expect(page.locator('#hz-annual-high')).toHaveText('25.21%');
  await page.locator('[data-lang="es"]').click();
  await expect(page.locator('#fd-status')).toContainText('No se pudo cargar');
});
