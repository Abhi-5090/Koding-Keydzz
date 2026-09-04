import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end browser tests.
 *
 * WHY THESE EXIST
 * ---------------
 * The unit suites cover pure logic and the integration suite covers the HTTP
 * and database layer, but neither had ever RENDERED the apps. That left one
 * honest gap: UI flows, mobile layout and error states were unverified, and
 * the route-splitting and keyboard-navigation work in particular needed a real
 * browser to confirm.
 *
 * These specs drive the actual built apps in Chromium and WebKit against a
 * real API and a real database, the way a teacher or a pupil does.
 *
 * RUNNING THEM
 *   1. Start MongoDB.
 *   2. From e2e/:  npm test
 *      The web servers below are started automatically.
 *
 * The API and both front-ends are launched on dedicated ports so a run never
 * collides with a development server.
 */

const API_PORT = 5701;
const STUDENT_PORT = 5702;
const ADMIN_PORT = 5703;

export const PORTS = { API_PORT, STUDENT_PORT, ADMIN_PORT };
export const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
export const STUDENT_URL = `http://127.0.0.1:${STUDENT_PORT}`;
export const ADMIN_URL = `http://127.0.0.1:${ADMIN_PORT}`;

/** Isolated database — these tests seed and mutate freely. */
const MONGO_URI = 'mongodb://127.0.0.1:27017/koding_keydzz_e2e';

const apiEnv = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  MONGO_URI,
  JWT_ACCESS_SECRET: 'e2e_access_secret_0123456789abcdefghij',
  JWT_REFRESH_SECRET: 'e2e_refresh_secret_0123456789abcdefghij',
  CLIENT_ORIGINS: `${STUDENT_URL},${ADMIN_URL}`,
  SEED_SUPERADMIN_PASSWORD: 'E2eSuper@2026',
  SEED_ADMIN_PASSWORD: 'E2eAdmin@2026',
};

export default defineConfig({
  testDir: './tests',
  // Full-page flows are slower than unit tests; be patient but bounded.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Serial: the specs share one seeded database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: ADMIN_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // A school tablet is the device this product is most used on, and it was
      // the specific thing left unverified. WebKit at iPad dimensions is the
      // closest available stand-in.
      name: 'tablet-safari',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],

  webServer: [
    {
      // Seed first, then serve. `sh -c` so both run in one server slot.
      command:
        'cd "../Koding Keydzz Backend" && node src/seed/seed.js --reset --force && node src/server.js',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: apiEnv,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    /*
     * BUILD, then preview.
     *
     * Vite inlines VITE_* variables at BUILD time — setting them on `vite
     * preview` has no effect, which is the classic "production points at
     * localhost" mistake. So the API URL is passed to the build step, and the
     * tests then exercise the real production bundle (including the route
     * splitting), not a dev server.
     *
     * `--host 127.0.0.1` is required: `vite preview` otherwise binds only to
     * `localhost` (IPv6), so polling 127.0.0.1 never succeeds and the server
     * slot times out.
     */
    {
      command: `cd "../Koding Keydzz Frontend" && VITE_API_URL=${API_URL} npm run build && npx vite preview --port ${STUDENT_PORT} --strictPort --host 127.0.0.1`,
      url: STUDENT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `cd "../Koding Keydzz Admin" && VITE_API_URL=${API_URL} npm run build && npx vite preview --port ${ADMIN_PORT} --strictPort --host 127.0.0.1`,
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
