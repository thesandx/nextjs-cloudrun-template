import { Button, Card, PageShell } from 'nextjs-cloudrun-template';

export const Wide = () => (
  <div className="bg-paper">
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-title">Tonight's rooms</h1>
        <p className="text-ink-soft max-w-prose">Pick a room to join, or start your own.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="font-display text-heading">Bingo night</p>
          <p className="text-ink-soft">5 players</p>
        </Card>
        <Card>
          <p className="font-display text-heading">Friday trivia</p>
          <p className="text-ink-soft">3 players</p>
        </Card>
        <Card tone="brand-soft">
          <p className="font-display text-heading">Your room</p>
          <Button size="md">Create room</Button>
        </Card>
      </div>
    </PageShell>
  </div>
);

export const Reading = () => (
  <div className="bg-paper">
    <PageShell width="reading">
      <h1 className="text-title">House rules</h1>
      <p>
        The host calls every number twice. A full line wins the round, and the next round starts
        when everyone is ready.
      </p>
    </PageShell>
  </div>
);
