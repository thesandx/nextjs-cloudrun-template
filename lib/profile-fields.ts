/**
 * The profile fields a person edits themselves: the choices and the limits.
 *
 * This module has no dependencies, so the profile form can import it and ship
 * only these few constants. The zod rules that enforce them are in
 * `lib/profile-schema.ts`. The form loads that module only when the person
 * starts to edit, because zod adds about 90 KB (gzip) to the page.
 */

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export type Gender = (typeof GENDERS)[number]['value'];

/** The oldest date of birth the form accepts. */
export const MIN_DATE_OF_BIRTH = '1900-01-01';

/** Today in UTC as `YYYY-MM-DD`. UTC so the server and the browser agree. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
