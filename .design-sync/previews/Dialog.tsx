import { Button, Dialog } from 'nextjs-cloudrun-template';

export const LeaveRoom = () => (
  <Dialog
    open
    onClose={() => {}}
    title="Leave this room?"
    actions={
      <>
        <Button variant="secondary">Stay</Button>
        <Button>Leave room</Button>
      </>
    }
  >
    <p>Your score stays on the board. You can join again with the same key.</p>
  </Dialog>
);
