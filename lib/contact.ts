/**
 * Contact links and the footer's copyright line. Pure: no I/O, so it is tested
 * without a browser. See design-language.md > The site checklist.
 */

/**
 * A `tel:` link for a phone number as people write it: `+91 98765 43210`.
 * Keeps the leading plus and the digits, and drops spaces, dashes and brackets,
 * so a phone dials the number on one tap.
 */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) throw new Error(`Not a phone number: "${phone}"`);
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** A `mailto:` link. The address is trimmed and must contain one `@`. */
export function mailtoHref(email: string): string {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) throw new Error(`Not an email address: "${email}"`);
  return `mailto:${trimmed}`;
}

/**
 * True for a link that leaves the app: another origin, `mailto:` or `tel:`.
 * Those render as a plain `<a>`; an in-app path renders as `next/link`.
 */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//');
}

/**
 * `© 2026 Owner`, or `© 2024–2026 Owner` when the site started earlier.
 * The year comes from the clock, never from a literal, so it cannot go stale
 * in the source. A statically rendered page fixes it at build time; every
 * deploy rebuilds it.
 */
export function copyrightLine(owner: string, since?: number, now: Date = new Date()): string {
  const year = now.getFullYear();
  const range = since !== undefined && since < year ? `${since}–${year}` : `${year}`;
  return `© ${range} ${owner}`;
}
