'use client';

import { useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, on the close button, and on a tap outside the sheet. */
  onClose: () => void;
  /** Names the dialog. A question or a result: "Leave this room?" */
  title: string;
  children?: React.ReactNode;
  /** The actions, primary last: `<Button variant="secondary">Stay</Button><Button>Leave room</Button>`. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * A modal sheet on the native `<dialog>`, so focus trapping, Escape and the
 * inert background come from the browser rather than from JavaScript here.
 * On a phone it sits at the bottom, in thumb reach; from `sm:` it centres.
 *
 * Use it for a decision that must interrupt. Everything else stays in the page.
 */
export function Dialog({ open, onClose, title, children, actions, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Keep `open` the single source of truth: the parent closes it.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the <dialog> itself, not its content, is the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'bg-surface text-ink border-line shadow-mochi-lg rounded-sheet border-2',
        'backdrop:bg-ink/40',
        'inset-x-4 mx-auto mt-auto mb-4 max-w-lg p-0 sm:my-auto',
        'open:animate-pop',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-heading pt-2">
            {title}
          </h2>
          <Button variant="quiet" onClick={onClose} className="shrink-0">
            Close
          </Button>
        </div>
        {children !== undefined && <div className="flex flex-col gap-3">{children}</div>}
        {actions !== undefined && (
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </dialog>
  );
}
