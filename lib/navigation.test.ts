import { describe, expect, it } from 'vitest';

import { isTabActive } from './navigation';

describe('isTabActive', () => {
  it('matches home only on the root', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/profile')).toBe(false);
  });

  it('matches a tab and the pages below it', () => {
    expect(isTabActive('/profile', '/profile')).toBe(true);
    expect(isTabActive('/profile', '/profile/photo')).toBe(true);
  });

  it('does not match a path that only shares a prefix', () => {
    expect(isTabActive('/profile', '/profiles')).toBe(false);
  });
});
