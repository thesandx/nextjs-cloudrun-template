import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileForm } from './ProfileForm';

const router = { refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const INITIAL = { displayName: 'New user', dateOfBirth: null, gender: null };

describe('ProfileForm', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts from the saved values', () => {
    render(
      <ProfileForm
        initial={{ displayName: 'momo', dateOfBirth: '1996-04-12', gender: 'female' }}
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('momo');
    expect(screen.getByLabelText('Date of birth')).toHaveValue('1996-04-12');
    expect(screen.getByLabelText('Gender')).toHaveValue('female');
  });

  it('sends the edits, with empty optional fields as null', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<ProfileForm initial={INITIAL} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' momo ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: 'momo',
      dateOfBirth: null,
      gender: null,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved.');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows a mistake under its field and sends nothing', async () => {
    render(<ProfileForm initial={INITIAL} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    });
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the server message when saving fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Sign in to continue.' }), { status: 401 }),
    );
    render(<ProfileForm initial={INITIAL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to continue.');
  });
});
