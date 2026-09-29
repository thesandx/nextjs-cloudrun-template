import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against the real production server.
 *
 * Vitest proves components and helpers in isolation. This proves the built app
 * serves pages, answers its API and holds its site-wide promises (headers, a
 * 404 page, no horizontal scroll on a phone) — the things a unit test cannot
 * see. See docs/testing.md > End-to-end tests.
 *
 * `pnpm test:e2e` builds nothing: run `pnpm build` first. CI does both in its
 * own job, so `pnpm validate` stays fast.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // A sandbox with a preinstalled Chromium that does not match this
    // Playwright version can point at it instead of downloading another.
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE !== undefined && {
      launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    }),
  },

  // Two postures, as the design language requires: an app on a phone, a
  // website on a desktop. Every test runs in both.
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    // The standalone server is what the container runs. `.next/static` and
    // `public/` are not traced into it (trap 6), so link them in first.
    command:
      'ln -sfn ../../static .next/standalone/.next/static && ln -sfn ../../public .next/standalone/public && node .next/standalone/server.js',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      // The production env check needs these to boot. They name nothing real:
      // the smoke tests never reach Firestore or Cloud Storage.
      APP_SLUG: 'e2e',
      GCP_PROJECT_ID: 'e2e-project',
      FIRESTORE_DATABASE_ID: 'e2e-db',
      GCS_BUCKET: 'e2e-project-e2e-media',
    },
  },
});
