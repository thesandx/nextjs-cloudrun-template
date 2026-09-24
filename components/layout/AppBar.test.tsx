import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppBar } from './AppBar';

const router = { back: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('AppBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes the title the page heading', () => {
    render(<AppBar title="Profile" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
  });

  it('has no back arrow on a top-level screen', () => {
    render(<AppBar title="Home" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('goes to the fallback when the user did not arrive from inside the app', () => {
    render(<AppBar title="Profile" back={{ fallbackHref: '/', label: 'Back to home' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(router.push).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('runs a custom back step instead of navigating', () => {
    const onBack = vi.fn();
    render(<AppBar title="Verify OTP" back={{ onBack }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });
});
