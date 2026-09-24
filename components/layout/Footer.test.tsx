import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

describe('Footer', () => {
  it('is the contentinfo landmark with its line and links', () => {
    render(
      <Footer links={[{ href: '/api/health', label: 'Health' }]}>Built from a template.</Footer>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Built from a template.');
    expect(screen.getByRole('link', { name: 'Health' })).toHaveAttribute('href', '/api/health');
  });
});
