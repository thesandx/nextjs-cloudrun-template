import { Avatar, Button, Card, Input, Sticker } from 'nextjs-cloudrun-template';

export const JoinForm = () => (
  <div className="max-w-md pt-8">
    <Card peek={<Avatar name="momo" size="lg" />}>
      <div className="flex flex-col gap-4">
        <Input label="Room key" code maxLength={6} autoComplete="off" placeholder="······" />
        <Input label="Your nickname" hint="Friends see this on the board." />
        <Button block size="lg">
          Join game
        </Button>
      </div>
    </Card>
  </div>
);

export const Tones = () => (
  <div className="grid grid-cols-2 gap-4">
    <Card tone="surface">
      <p className="font-medium">Surface</p>
    </Card>
    <Card tone="brand-soft">
      <p className="font-medium">Brand soft</p>
    </Card>
    <Card tone="butter">
      <p className="font-medium">Butter</p>
    </Card>
    <Card tone="soda">
      <p className="font-medium">Soda</p>
    </Card>
    <Card tone="grape">
      <p className="font-medium">Grape</p>
    </Card>
    <Card tone="peach">
      <p className="font-medium">Peach</p>
    </Card>
  </div>
);

export const Celebration = () => (
  <div className="max-w-md pt-8">
    <Card
      tone="brand-soft"
      peek={<Avatar name="bubbles" size="lg" mood="wow" />}
      className="flex flex-col gap-1"
    >
      <Sticker kind="sparkle" size={36} className="absolute top-4 right-5" />
      <Sticker kind="heart" size={22} className="absolute top-12 right-14" />
      <p className="font-display text-key">BINGO!</p>
      <p className="text-ink-soft">bubbles takes round 3 with two numbers to spare.</p>
    </Card>
  </div>
);
