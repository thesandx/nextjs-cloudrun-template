// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/services/auth.service';

const USER: SessionUser = {
  uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9',
  email: null,
  emailVerified: false,
  phoneNumber: '+919876543210',
  displayName: null,
  photoUrl: null,
  signInProvider: 'phone',
};

const requireUser = vi.fn<() => Promise<SessionUser>>();
const updateUserProfile = vi.fn();

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/user.service', () => ({
  updateUserProfile: (...args: unknown[]) => updateUserProfile(...args),
}));

const { PATCH } = await import('./route');

function patch(body: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID = { displayName: 'momo', dateOfBirth: '1996-04-12', gender: 'female' };

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    updateUserProfile.mockResolvedValue({ ...VALID });
  });

  it('updates the session user, never a uid from the request', async () => {
    const response = await PATCH(patch(VALID));
    expect(response.status).toBe(200);
    expect(updateUserProfile).toHaveBeenCalledWith(USER, VALID);
  });

  it('answers 401 without a session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    const response = await PATCH(patch(VALID));
    expect(response.status).toBe(401);
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('answers 400 for an invalid body, or a field the user does not own', async () => {
    for (const body of [
      { ...VALID, gender: 'robot' },
      { ...VALID, phoneNumber: '+10000000000' },
      { ...VALID, uid: 'someone-else' },
    ]) {
      const response = await PATCH(patch(body));
      expect(response.status).toBe(400);
    }
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
