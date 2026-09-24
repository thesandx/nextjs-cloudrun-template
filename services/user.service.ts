import 'server-only';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { dateOfBirthSchema, genderSchema, type ProfileUpdate } from '@/lib/profile-fields';
import { type AuthProvider, type SessionUser } from '@/services/auth.service';
import {
  createRepository,
  DocumentAlreadyExistsError,
  type StoredDocument,
} from '@/services/repository';

/**
 * User profiles — `users/{uid}`.
 *
 * This collection is NOT the source of truth for identity. Firebase Auth is.
 * A profile is the application's own record of a person: the fields the app
 * shows, denormalised so a page render does not call Identity Platform.
 *
 * ## Why the document id is the Firebase uid
 *
 * Every authenticated request already knows the uid, so keying by it turns
 * "who is this?" into one key lookup — no query, no index, no second read.
 * The alternative (an auto id plus a `uid` field) makes every profile read a
 * query and lets two concurrent first sign-ins create two profiles for one
 * person.
 *
 * That needs `createWithId`, which the twelve rules otherwise forbid. The rule
 * exists to stop MONOTONIC ids, which pin every write to one end of the key
 * range that Firestore cannot then split. A Firebase uid is 28 characters of
 * random base62, so it spreads exactly like an auto id. The rule's reason
 * permits this; only its wording did not. See `lib/document-ids.ts` and
 * CLAUDE.md > Firestore data modeling.
 *
 * ## PII
 *
 * `email` and `phoneNumber` identify a person. They are stored because the app
 * needs them, and they are never written to a log. Only the uid goes to Cloud
 * Logging. An erasure request is `hardDelete` here plus
 * `deleteUser` in Firebase Auth — see docs/auth.md.
 */

export const USER_COLLECTION = 'users';

/** Providers a profile records. Mirrors `AuthProvider`. */
const providerSchema: z.ZodType<AuthProvider> = z.enum(['google.com', 'phone']);

export const userProfileSchema = z.object({
  /**
   * What the app shows. Seeded from the provider, then owned by the user: a
   * phone-only sign-in has no name at all, so it falls back to a placeholder
   * the person can change.
   */
  displayName: z.string().trim().min(1).max(120),

  /** Null for a phone-only account. */
  email: z.email().max(320).nullable(),

  /** E.164, e.g. `+919876543210`. Null for a Google-only account. */
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'must be an E.164 phone number')
    .nullable(),

  /**
   * Object path of an uploaded avatar, never a URL — a signed URL expires, and
   * a stored one becomes a dead link. Null means fall back to the provider's
   * photo or to initials.
   */
  avatarPath: z.string().max(512).nullable(),

  /** Every provider this person has ever signed in with. Append-only. */
  providers: z.array(providerSchema).min(1).max(8),

  /**
   * Set on every sign-in.
   *
   * Monotonically increasing AND written often, which is the exact shape that
   * makes an index a write bottleneck above roughly 500 writes/second to the
   * collection. Nothing queries it, so `firestore.indexes.json` carries a
   * single-field exemption for it. Start ordering by it and you must remove
   * that exemption and add a composite index.
   */
  lastSignInAt: z.date(),

  /**
   * `YYYY-MM-DD`, set by the user on /profile. A string, not a `Date` — see
   * `lib/profile-fields.ts`. Optional because profiles created before this
   * field have no value, and nobody but the user can supply one. That makes it
   * permanently optional: there is nothing to backfill.
   */
  dateOfBirth: dateOfBirthSchema.nullable().optional(),

  /** Set by the user on /profile. Optional for the same reason as `dateOfBirth`. */
  gender: genderSchema.nullable().optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserProfileDocument = StoredDocument<UserProfile>;

export const users = createRepository({
  collection: USER_COLLECTION,
  schema: userProfileSchema,
});

/** A person with no name from their provider still needs something to show. */
const FALLBACK_DISPLAY_NAME = 'New user';

/**
 * Derives the profile fields a sign-in can supply.
 *
 * Exported for testing: it is pure, and it is where the "what does a
 * phone-only user look like?" decisions live.
 */
export function profileFromSession(user: SessionUser, now: Date): UserProfile {
  const provider: AuthProvider = user.signInProvider ?? 'google.com';

  return {
    displayName: user.displayName?.trim() || FALLBACK_DISPLAY_NAME,
    email: user.email,
    phoneNumber: user.phoneNumber,
    avatarPath: null,
    providers: [provider],
    lastSignInAt: now,
  };
}

/**
 * Returns the caller's profile, creating it on first sign-in.
 *
 * Runs in a transaction because two requests from the same new user can arrive
 * together — a page load and its data fetch, say — and both would otherwise
 * see "no profile" and both create one. `createWithId` inside a transaction
 * fails the whole transaction on a conflict rather than overwriting.
 *
 * On an existing profile it refreshes only what the provider owns: the
 * sign-in time, a newly linked provider, and contact details that Firebase now
 * reports. It deliberately does NOT overwrite `displayName` or `avatarPath`,
 * which the user may have edited — a Google display name would otherwise
 * silently undo their change on every sign-in.
 */
export async function ensureUserProfile(user: SessionUser): Promise<UserProfileDocument> {
  const now = new Date();

  try {
    await users.runTransaction(async (repo) => {
      const existing = await repo.get(user.uid);

      if (existing === null) {
        repo.createWithId(user.uid, profileFromSession(user, now));
        return;
      }

      const provider = user.signInProvider;
      const providers =
        provider !== null && !existing.providers.includes(provider)
          ? [...existing.providers, provider]
          : existing.providers;

      repo.update(user.uid, {
        lastSignInAt: now,
        providers,
        // Fill a gap the provider can now answer; never blank a stored value.
        email: user.email ?? existing.email,
        phoneNumber: user.phoneNumber ?? existing.phoneNumber,
      });
    });
  } catch (error) {
    // Another request won the race and created the profile between our read
    // and our write. The outcome we wanted is the outcome we have.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    logger.info('Profile creation raced; using the existing profile', { uid: user.uid });
  }

  return users.getOrThrow(user.uid);
}

/** The profile, or `null` when this user has never signed in. One key lookup. */
export async function getUserProfile(uid: string): Promise<UserProfileDocument | null> {
  return users.get(uid);
}

/**
 * The caller's profile, creating it only if it is genuinely absent.
 *
 * The common path is one key lookup with no write and no transaction —
 * `ensureUserProfile` runs at sign-in, so by the time a user is creating
 * anything their profile already exists. The fallback covers an account that
 * predates this collection.
 */
export async function requireUserProfile(user: SessionUser): Promise<UserProfileDocument> {
  return (await getUserProfile(user.uid)) ?? ensureUserProfile(user);
}

/**
 * Applies the caller's own edits from /profile.
 *
 * Takes the uid from the session, never from the body — the route passes
 * `user.uid`. `ProfileUpdate` holds only the fields a person owns; contact
 * details and providers come from Firebase and are not editable here.
 *
 * Ensures the profile first, so an account that predates the collection can
 * still save, and `update` never fails on a missing document.
 */
export async function updateUserProfile(
  user: SessionUser,
  changes: ProfileUpdate,
): Promise<UserProfileDocument> {
  await requireUserProfile(user);
  await users.update(user.uid, changes);
  logger.info('Profile updated', { uid: user.uid, fields: Object.keys(changes) });
  return users.getOrThrow(user.uid);
}

/**
 * Permanently removes a profile. For erasure requests only.
 *
 * This does NOT delete the Firebase Auth user, and deleting only one of the
 * two leaves the account able to sign in and immediately recreate an empty
 * profile. Both halves are required; see docs/auth.md.
 */
export async function deleteUserProfile(uid: string): Promise<void> {
  logger.warn('Deleting a user profile', { uid });
  await users.hardDelete(uid);
}
