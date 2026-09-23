import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Global test setup, loaded by `vitest.config.ts` before every test file.
 *
 * The default environment is jsdom, but a file can opt into the Node
 * environment with `// @vitest-environment node` — `services/*.emulator.test.ts`
 * does, because the Google Cloud SDKs use gRPC and Node APIs that jsdom does
 * not provide. This file runs for those too, so everything DOM-specific below
 * is guarded. Without the guard, a Node-environment test file fails during
 * setup with `window is not defined` before a single test runs.
 */

const hasDom = typeof window !== 'undefined';

// Unmount anything rendered so state cannot leak between test files.
afterEach(() => {
  if (hasDom) cleanup();
});

// jsdom does not implement matchMedia; components reading it would throw.
if (hasDom) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
