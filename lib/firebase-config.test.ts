// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { getFirebaseWebConfig, isAuthConfigured } from '@/lib/firebase-config';

/**
 * These run against whatever the test environment supplies, which is nothing.
 * That IS the case worth pinning: the template's default state is "auth not
 * configured", and it must be a clean null rather than an object of empty
 * strings that the SDK would accept and then fail on at runtime.
 */
describe('getFirebaseWebConfig', () => {
  it('returns null when the web config is absent', () => {
    expect(isAuthConfigured()).toBe(false);
    expect(getFirebaseWebConfig()).toBeNull();
  });

  it('never returns a partially populated object', () => {
    const config = getFirebaseWebConfig();
    if (config !== null) {
      expect(Object.values(config).every((value) => value !== '')).toBe(true);
    }
  });
});
