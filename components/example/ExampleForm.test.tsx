import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExampleForm } from './ExampleForm';

const router = { refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('ExampleForm', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function submit(title: string): void {
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
    fireEvent.click(screen.getByRole('button', { name: 'Create example' }));
  }

  it('says so when the example is created', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 }));
    render(<ExampleForm />);
    submit('First note');

    expect(await screen.findByRole('status')).toHaveTextContent('Example created.');
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('says what went wrong when the request fails', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'Sign in first.' }, { status: 401 }));
    render(<ExampleForm />);
    submit('First note');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The example was not created.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
