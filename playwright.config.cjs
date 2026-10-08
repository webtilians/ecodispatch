const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  },
  webServer: {
    command: (process.platform==='win32'?'python':'python3')+' -m http.server 4173 --directory web',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30000
  }
});
