import { Button } from 'nextjs-cloudrun-template';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button>Create room</Button>
    <Button variant="secondary">Join with a key</Button>
    <Button variant="quiet">How scoring works</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button size="md">Save name</Button>
    <Button size="lg">Start game</Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button disabled>Create room</Button>
    <Button variant="secondary" disabled>
      Waiting for host
    </Button>
  </div>
);

export const Block = () => (
  <div className="w-full max-w-md">
    <Button block size="lg">
      Join game
    </Button>
  </div>
);
