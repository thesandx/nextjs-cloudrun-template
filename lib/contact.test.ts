import { describe, expect, it } from 'vitest';

import { copyrightLine, isExternalHref, mailtoHref, telHref } from './contact';

describe('telHref', () => {
  it('keeps the plus and the digits only', () => {
    expect(telHref(' +91 98765-43210 ')).toBe('tel:+919876543210');
    expect(telHref('(020) 7946 0958')).toBe('tel:02079460958');
  });

  it('refuses a value with no digits', () => {
    expect(() => telHref('call us')).toThrow('Not a phone number');
  });
});

describe('mailtoHref', () => {
  it('builds a mailto link from a trimmed address', () => {
    expect(mailtoHref(' hello@example.com ')).toBe('mailto:hello@example.com');
  });

  it('refuses a value that is not an address', () => {
    expect(() => mailtoHref('hello at example')).toThrow('Not an email address');
  });
});

describe('isExternalHref', () => {
  it.each([
    ['https://example.com', true],
    ['mailto:a@b.co', true],
    ['tel:+911234', true],
    ['//cdn.example.com/x', true],
    ['/design', false],
    ['#top', false],
  ])('%s → %s', (href, expected) => {
    expect(isExternalHref(href)).toBe(expected);
  });
});

describe('copyrightLine', () => {
  const now = new Date('2026-09-28T00:00:00Z');

  it('uses the current year', () => {
    expect(copyrightLine('Playroom', undefined, now)).toBe('© 2026 Playroom');
  });

  it('shows a range when the site started earlier', () => {
    expect(copyrightLine('Playroom', 2024, now)).toBe('© 2024–2026 Playroom');
  });

  it('shows one year when the start year is this year', () => {
    expect(copyrightLine('Playroom', 2026, now)).toBe('© 2026 Playroom');
  });
});
