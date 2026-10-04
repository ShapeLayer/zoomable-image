import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  timeout: 20000,
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  webServer: {
    command: 'node test/server.mjs',
    url: 'http://127.0.0.1:4174/examples/',
    reuseExistingServer: false
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { executablePath: process.env.ZOOMABLE_FIREFOX_EXECUTABLE }
      }
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }
  ]
});
