// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { SessionUser } from '@/services/auth.service';
import { profileFromSession, userProfileSchema } from '@/services/user.service';

const NOW = new Date('2026-09-23T10:00:00.000Z');

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9',
    email: null,
    emailVerified: false,
    phoneNumber: null,
    displayName: null,
    photoUrl: null,
    signInProvider: null,
    ...overrides,
  };
}

describe('profileFromSession', () => {
  it('keeps what a Google sign-in supplies', () => {
    const profile = profileFromSession(
      session({
        email: 'person@example.com',
        emailVerified: true,
        displayName: 'Real Name',
        signInProvider: 'google.com',
      }),
      NOW,
    );

    expect(profile).toMatchObject({
      displayName: 'Real Name',
      email: 'person@example.com',
      phoneNumber: null,
      providers: ['google.com'],
      lastSignInAt: NOW,
    });
  });

  it('gives a phone-only sign-in a usable display name', () => {
    // Phone auth supplies no name at all, so a naive `displayName ?? ''` would
    // fail the schema's min(1) and reject the sign-in outright.
    const profile = profileFromSession(
      session({ phoneNumber: '+919876543210', signInProvider: 'phone' }),
      NOW,
    );

    expect(profile.displayName).toBe('New user');
    expect(profile.email).toBeNull();
    expect(profile.phoneNumber).toBe('+919876543210');
    expect(profile.providers).toEqual(['phone']);
  });

  it('treats a whitespace-only display name as absent', () => {
    const profile = profileFromSession(session({ displayName: '   ' }), NOW);
    expect(profile.displayName).toBe('New user');
  });

  it('never stores an avatar path from the provider', () => {
    // The provider's photo is a URL on Google's CDN. Storing a URL is the
    // mistake this template refuses everywhere else, so the field starts null
    // and is only ever set by a real upload.
    const profile = profileFromSession(
      session({ photoUrl: 'https://lh3.googleusercontent.com/a/abc123' }),
      NOW,
    );
    expect(profile.avatarPath).toBeNull();
  });

  it('produces a payload the schema accepts', () => {
    const profile = profileFromSession(
      session({ email: 'person@example.com', signInProvider: 'google.com' }),
      NOW,
    );
    expect(() => userProfileSchema.parse(profile)).not.toThrow();
  });
});

describe('userProfileSchema', () => {
  const valid = {
    displayName: 'Person',
    email: 'person@example.com',
    phoneNumber: '+919876543210',
    avatarPath: null,
    providers: ['google.com'] as const,
    lastSignInAt: NOW,
  };

  it('rejects a phone number that is not E.164', () => {
    expect(() => userProfileSchema.parse({ ...valid, phoneNumber: '9876543210' })).toThrow(/E.164/);
  });

  it('rejects an unknown provider', () => {
    expect(() => userProfileSchema.parse({ ...valid, providers: ['facebook.com'] })).toThrow();
  });

  it('rejects an empty provider list', () => {
    expect(() => userProfileSchema.parse({ ...valid, providers: [] })).toThrow();
  });

  it('accepts a profile with no contact details at all', () => {
    // Possible in principle, and the schema must not make it unrepresentable.
    expect(() =>
      userProfileSchema.parse({ ...valid, email: null, phoneNumber: null }),
    ).not.toThrow();
  });

  it('reads a profile written before dateOfBirth and gender existed', () => {
    const parsed = userProfileSchema.parse(valid);
    expect(parsed.dateOfBirth).toBeUndefined();
    expect(parsed.gender).toBeUndefined();
  });

  it('accepts the user-edited fields, and null for a cleared one', () => {
    expect(() =>
      userProfileSchema.parse({ ...valid, dateOfBirth: '1996-04-12', gender: 'female' }),
    ).not.toThrow();
    expect(() =>
      userProfileSchema.parse({ ...valid, dateOfBirth: null, gender: null }),
    ).not.toThrow();
    expect(() => userProfileSchema.parse({ ...valid, gender: 'robot' })).toThrow();
  });
});
