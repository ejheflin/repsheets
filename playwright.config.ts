import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // The Vite dev server serves unbundled modules; too many parallel pages
  // starve it and cause spurious timeouts
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Preview of the production build: stable under parallel load (the dev
    // server cold-serves ~660 unbundled modules and times tests out) and
    // exercises the bundle users actually get
    command: 'npm run build && npm run preview -- --port 5199 --strictPort',
    url: 'http://localhost:5199/app.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
