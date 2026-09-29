import { Button, Card, EmptyState } from 'nextjs-cloudrun-template';

export const InCard = () => (
  <div className="max-w-xl">
    <Card>
      <EmptyState title="No rounds yet." action={<Button variant="secondary">Start round</Button>}>
        Rounds you play in this room show up here.
      </EmptyState>
    </Card>
  </div>
);

export const TextOnly = () => (
  <EmptyState title="No friends online.">They show up here the moment they open the app.</EmptyState>
);
