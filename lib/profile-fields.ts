import { z } from 'zod';

/**
 * The profile fields a person edits themselves, and their rules.
 *
 * In `lib/` rather than `services/` because both sides need it: the server
 * validates the request with it, and the form shows the same choices and
 * limits. It is pure, so a Client Component may import it.
 */

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export type Gender = (typeof GENDERS)[number]['value'];

export const genderSchema = z.enum(GENDERS.map((gender) => gender.value) as [Gender, ...Gender[]]);

/** The oldest date of birth the form accepts. */
export const MIN_DATE_OF_BIRTH = '1900-01-01';

/** Today in UTC as `YYYY-MM-DD`. UTC so the server and the browser agree. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A calendar date, `YYYY-MM-DD`, stored as a string on purpose.
 *
 * A birthday is not an instant. Stored as a `Date` it gains a time and a zone,
 * and a user east of UTC sees the day before their birthday. The string is
 * also what `<input type="date">` reads and writes, so no conversion is needed.
 */
export const dateOfBirthSchema = z.iso
  .date('Enter a date as YYYY-MM-DD.')
  .refine((value) => value >= MIN_DATE_OF_BIRTH, 'Enter a date after 1900.')
  .refine((value) => value <= todayIso(), 'A date of birth cannot be in the future.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(120, 'Keep the name under 120 characters.');

/** The body of `PATCH /api/profile`. `null` clears an optional field. */
export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema,
    dateOfBirth: dateOfBirthSchema.nullable(),
    gender: genderSchema.nullable(),
  })
  .strict();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
