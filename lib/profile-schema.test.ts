import { describe, expect, it } from 'vitest';

import { todayIso } from './profile-fields';
import { profileUpdateSchema } from './profile-schema';

const VALID = { displayName: 'momo', dateOfBirth: '1996-04-12', gender: 'female' };

describe('profileUpdateSchema', () => {
  it('accepts a complete update', () => {
    expect(profileUpdateSchema.parse(VALID)).toEqual(VALID);
  });

  it('trims the name and refuses an empty one', () => {
    expect(profileUpdateSchema.parse({ ...VALID, displayName: '  momo ' }).displayName).toBe(
      'momo',
    );
    expect(profileUpdateSchema.safeParse({ ...VALID, displayName: '   ' }).success).toBe(false);
  });

  it('lets the optional fields be cleared with null', () => {
    expect(profileUpdateSchema.parse({ ...VALID, dateOfBirth: null, gender: null })).toMatchObject({
      dateOfBirth: null,
      gender: null,
    });
  });

  it('refuses a date in the future, before 1900, or not a date at all', () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    for (const dateOfBirth of [tomorrow, '1899-12-31', '12/04/1996', '1996-02-30']) {
      expect(profileUpdateSchema.safeParse({ ...VALID, dateOfBirth }).success).toBe(false);
    }
  });

  it('refuses a gender outside the list', () => {
    expect(profileUpdateSchema.safeParse({ ...VALID, gender: 'robot' }).success).toBe(false);
  });

  it('refuses fields the user does not own, such as phoneNumber', () => {
    expect(profileUpdateSchema.safeParse({ ...VALID, phoneNumber: '+10000000000' }).success).toBe(
      false,
    );
  });
});

describe('todayIso', () => {
  it('is the UTC calendar date', () => {
    expect(todayIso(new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-24');
  });
});
