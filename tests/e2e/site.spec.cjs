const { test, expect } = require('@playwright/test');

test('v0.9.1 boots, translates, runs exploratory and isolated holdout workers', async ({ page }) => {
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

  await expect(page.locator('#ho-results')).toBeVisible({timeout:30000});
  await expect(page.locator('#ho-status')).toContainText('FROZEN OFFICIAL RESULT');
  await expect(page.locator('#ho-table-body tr').first().locator('td').nth(2)).toContainText('e-');
  await expect(page.locator('#ho-seed')).toHaveText('ecodispatch-holdout-09');
  await expect(page.locator('#ho-n')).toHaveText('1000');
  await expect(page.locator('#ho-k')).toHaveText('10');
  await expect(page.locator('#holdout input, #holdout select')).toHaveCount(0);

  // Never consume the real holdout seed in CI. Exercise the real worker with a CI-only seed.
  const holdoutResult=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const worker=new Worker('./holdout-worker.js?v=0.9.1');
    worker.onmessage=({data})=>{
      if(data.type==='complete'){worker.terminate();resolve(data.result);}
      if(data.type==='error'){worker.terminate();reject(new Error(data.message));}
    };
    fetch('./data/current.json?v=0.9.1').then(r=>r.json()).then(config=>{
      worker.postMessage({config,testMode:true,seed:'ci-holdout-browser',n:10});
    }).catch(reject);
  }));
  expect(holdoutResult.version).toBe('0.9.1');
  expect(holdoutResult.protocol.seed).toBe('ci-holdout-browser');
  await page.evaluate(result=>{window.ecoHoldout.result=result;window.ecoHoldout.render();},holdoutResult);
  await expect(page.locator('#ho-results')).toBeVisible();
  await expect(page.locator('#ho-table-body tr')).toHaveCount(4);

  expect(critical).toEqual([]);
});
