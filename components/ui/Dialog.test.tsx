import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog';

/*
 * jsdom has <dialog> but no modal behaviour. Give it the two methods the
 * component calls, so these tests cover our wiring rather than the browser's.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('Dialog', () => {
  it('is named by its title when open', () => {
    render(
      <Dialog open onClose={() => {}} title="Leave this room?">
        Your score stays on the board.
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Leave this room?' })).toBeInTheDocument();
  });

  it('stays closed when not open', () => {
    render(<Dialog open={false} onClose={() => {}} title="Leave this room?" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks the parent to close from the close button', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Leave this room?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('asks the parent to close on Escape instead of closing itself', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Leave this room?" />);
    const dialog = screen.getByRole('dialog');
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(onClose).toHaveBeenCalledOnce();
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('renders the actions', () => {
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Leave this room?"
        actions={<button type="button">Leave room</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Leave room' })).toBeInTheDocument();
  });
});
