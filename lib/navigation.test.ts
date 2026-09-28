import { describe, expect, it } from 'vitest';

import { activeTabHref, isTabActive } from './navigation';

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

describe('activeTabHref', () => {
  it('names the destination a page sits under', () => {
    expect(activeTabHref('/')).toBe('/');
    expect(activeTabHref('/profile/photo')).toBe('/profile');
  });

  it('names nothing for a page outside every destination', () => {
    expect(activeTabHref('/sign-in')).toBeUndefined();
  });
});
