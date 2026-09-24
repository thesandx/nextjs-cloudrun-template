'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

/**
 * Opens a `Dialog` on `/design`. A client island because the dialog's open
 * state lives in its parent; the rest of the page stays server-rendered.
 */
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Leave room
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Leave this room?"
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Stay
            </Button>
            <Button onClick={close}>Leave room</Button>
          </>
        }
      >
        <p>Your score stays on the board. You can join again with the same key.</p>
      </Dialog>
    </>
  );
}
