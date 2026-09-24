/**
 * Phone numbers for OTP sign-in. Pure: no I/O, so it is tested without Firebase.
 *
 * The sign-in screen asks for the national number only. The dial code is a
 * separate, prefilled choice, because most people type their number the way
 * they say it — `98765 43210` — and never think about `+91`.
 */

export interface DialCountry {
  /** ISO 3166-1 alpha-2. Also the option value. */
  iso: string;
  name: string;
  /** Digits only, no plus sign: `91`. */
  dialCode: string;
  /** Allowed national-number lengths, after a trunk `0` is removed. */
  lengths: readonly number[];
}

/**
 * The countries the picker offers. Keep it short and matched to the SMS region
 * policy in the Firebase console: offering a country the policy blocks only
 * produces a confusing failure after the user has typed their number.
 * See docs/auth.md > SMS fraud.
 */
export const DIAL_COUNTRIES: readonly DialCountry[] = [
  { iso: 'IN', name: 'India', dialCode: '91', lengths: [10] },
  { iso: 'US', name: 'United States', dialCode: '1', lengths: [10] },
  { iso: 'GB', name: 'United Kingdom', dialCode: '44', lengths: [10] },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '971', lengths: [9] },
  { iso: 'SG', name: 'Singapore', dialCode: '65', lengths: [8] },
  { iso: 'AU', name: 'Australia', dialCode: '61', lengths: [9] },
];

/** The prefilled country. Change it to where most of your users are. */
export const DEFAULT_DIAL_COUNTRY = 'IN';

export function findDialCountry(iso: string): DialCountry {
  const country =
    DIAL_COUNTRIES.find((candidate) => candidate.iso === iso) ??
    DIAL_COUNTRIES.find((candidate) => candidate.iso === DEFAULT_DIAL_COUNTRY);
  if (country === undefined) throw new Error('DEFAULT_DIAL_COUNTRY is not in DIAL_COUNTRIES');
  return country;
}

export type PhoneResult = { ok: true; e164: string } | { ok: false; message: string };

/**
 * Turns what the user typed into E.164, the only format Firebase accepts.
 *
 * Forgiving about how it was typed — spaces, dashes, brackets, a trunk `0`,
 * or the dial code typed again — and strict about the result: the digit count
 * must match the country.
 */
export function toE164(countryIso: string, typed: string): PhoneResult {
  const country = findDialCountry(countryIso);
  let digits = typed.replace(/\D/g, '');

  // Someone pasted "+91 98765 43210" into the national field.
  if (typed.trim().startsWith('+') && digits.startsWith(country.dialCode)) {
    digits = digits.slice(country.dialCode.length);
  }
  // A trunk prefix: "098765 43210" in India, "07700 900123" in the UK.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');

  if (digits === '') return { ok: false, message: 'Enter your phone number.' };
  if (!country.lengths.includes(digits.length)) {
    const expected = country.lengths.join(' or ');
    return {
      ok: false,
      message: `Numbers in ${country.name} have ${expected} digits. You entered ${digits.length}.`,
    };
  }
  return { ok: true, e164: `+${country.dialCode}${digits}` };
}

/**
 * A readable version of an E.164 number for "OTP sent to …": the dial code,
 * then the rest in groups. Display only — never parse this back.
 */
export function formatPhoneForDisplay(e164: string): string {
  const country = [...DIAL_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((candidate) => e164.startsWith(`+${candidate.dialCode}`));
  if (country === undefined) return e164;

  const national = e164.slice(country.dialCode.length + 1);
  const split = Math.ceil(national.length / 2);
  return `+${country.dialCode} ${national.slice(0, split)} ${national.slice(split)}`;
}
