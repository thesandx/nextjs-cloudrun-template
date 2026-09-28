import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContactLink } from './ContactLink';

describe('ContactLink', () => {
  it('makes a phone number dial on tap', () => {
    render(<ContactLink kind="phone" value="+91 98765 43210" />);
    expect(screen.getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute(
      'href',
      'tel:+919876543210',
    );
  });

  it('makes an email address open the mail app on tap', () => {
    render(<ContactLink kind="email" value="hello@example.com" />);
    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
  });
});
