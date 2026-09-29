import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest is used instead of Jest because it resolves the same `tsconfig.json`
 * path aliases natively, needs no separate Babel transform, and starts fast
 * enough to run on every PR without a cache.
 *
 * Server Components that are `async` cannot be rendered by React Testing
 * Library today — test their data-fetching helpers in `lib/` or `services/`
 * directly and reserve component tests for Client Components and sync
 * Server Components. See docs/testing.md.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Reuses the `@/*` alias from tsconfig.json, so tests and application code
    // resolve imports identically. Native since Vite 7 — no plugin needed.
    tsconfigPaths: true,
    alias: {
      // `import 'server-only'` throws outside a Next.js build. See the stub.
      'server-only': fileURLToPath(new URL('./tests/server-only.stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // tests/e2e/ is Playwright's, run by `pnpm test:e2e` against a real server.
    exclude: ['node_modules/**', '.next/**', 'coverage/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      // A summary, not a per-file table: this runs inside `pnpm validate`, and
      // a 200-line table buries the one line that failed. Open
      // coverage/lcov-report/index.html for the detail.
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['{app,components,hooks,lib,services}/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', '**/layout.tsx'],
      // A floor, not a target. It stops a change that adds code without tests
      // from passing unnoticed. Raise it when coverage rises; never lower it to
      // make a change pass. Services look low because their emulator suites
      // run in a separate job and are not counted here.
      thresholds: {
        statements: 45,
        branches: 51,
        functions: 50,
        lines: 45,
      },
    },
  },
});
