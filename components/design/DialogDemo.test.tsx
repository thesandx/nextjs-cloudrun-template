import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { DialogDemo } from './DialogDemo';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('DialogDemo', () => {
  it('opens the dialog and closes it again', () => {
    render(<DialogDemo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(screen.getByRole('dialog', { name: 'Leave this room?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
