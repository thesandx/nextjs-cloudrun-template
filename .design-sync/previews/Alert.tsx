import { Alert, Button } from 'nextjs-cloudrun-template';

export const Success = () => (
  <Alert tone="success" title="Room created.">
    Share the key PLZ4K9 with your group.
  </Alert>
);

export const DangerWithAction = () => (
  <Alert
    tone="danger"
    title="That key expired."
    action={<Button variant="secondary">Ask for a new key</Button>}
  >
    Keys last one hour after the last round.
  </Alert>
);

export const Info = () => <Alert title="The host paused the game." />;
