import type { Metadata } from 'next';

import { DialogDemo } from '@/components/design/DialogDemo';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Face } from '@/components/ui/Face';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Speech } from '@/components/ui/Speech';
import { Spinner } from '@/components/ui/Spinner';
import { Sticker } from '@/components/ui/Sticker';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';

export const metadata: Metadata = {
  title: 'Design',
  robots: { index: false, follow: false },
};

const SWATCHES = [
  { name: 'paper', className: 'bg-paper', use: 'Page background' },
  { name: 'surface', className: 'bg-surface', use: 'Cards, inputs' },
  { name: 'ink', className: 'bg-ink', use: 'Text and outlines' },
  { name: 'brand', className: 'bg-brand', use: 'The main action' },
  { name: 'butter', className: 'bg-butter', use: 'Identity tone' },
  { name: 'soda', className: 'bg-soda', use: 'Identity tone' },
  { name: 'grape', className: 'bg-grape', use: 'Identity tone' },
  { name: 'peach', className: 'bg-peach', use: 'Identity tone' },
];

const PLAYERS = ['sandy', 'momo', 'captain_k', 'bubbles', 'rajma chawal'];

const GAMES = [
  { value: 'bingo', label: 'Bingo' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'draw', label: 'Draw it', disabled: true },
];

const ROUND_LENGTHS = [
  { value: 'short', label: 'Short', hint: 'About 5 minutes.' },
  { value: 'standard', label: 'Standard', hint: 'About 10 minutes.' },
  { value: 'marathon', label: 'Marathon', hint: 'Until someone gives up.' },
];

const GAME_VIEWS = [
  {
    id: 'board',
    label: 'Board',
    content: <p className="text-ink-soft">Numbers called so far: 12, 7, 33, 41.</p>,
  },
  {
    id: 'players',
    label: 'Players',
    content: <p className="text-ink-soft">Five players, two with one line left.</p>,
  },
  {
    id: 'rules',
    label: 'Rules',
    content: <p className="text-ink-soft">A full line wins the round.</p>,
  },
];

/**
 * The living style guide. It renders every Mochi primitive with real
 * content. When you add or change a component in components/ui/, show it
 * here in the same PR. Not indexed; safe to ship.
 */
export default function DesignPage() {
  return (
    <PageShell>
      <header className="flex flex-col gap-4">
        <span className="bg-brand-soft border-line shadow-mochi inline-grid size-20 place-items-center rounded-full border-2">
          <Face size={64} blink label="The Mochi face" />
        </span>
        <h1 className="text-hero">Mochi</h1>
        <p className="text-ink-soft max-w-prose">
          Soft on the outside, firm underneath. Chunky outlines and a hard base keep things clear;
          faces, blush and a little bounce keep them friendly.
        </p>
      </header>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Colour</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <li key={swatch.name} className="flex flex-col gap-2">
              <span
                className={`border-line rounded-input block h-16 border-2 ${swatch.className}`}
              />
              <span className="font-medium">{swatch.name}</span>
              <span className="text-small text-ink-soft">{swatch.use}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Type</h2>
        <p className="font-display text-hero">Bingo night</p>
        <p className="font-display text-key tracking-[0.3em]">PLZ4K9</p>
        <p className="max-w-prose">
          Body text is Zen Maru Gothic: rounded, calm and easy to read at 16px. Headings are Mochiy
          Pop One, which carries the personality. Nothing else.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Buttons</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button>Create room</Button>
          <Button variant="secondary">Join with a key</Button>
          <Button variant="quiet">How scoring works</Button>
          <Button variant="secondary" disabled>
            Waiting for host
          </Button>
        </div>
        <p className="text-small text-ink-soft">Press one. It sinks onto its base — the squish.</p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Join a room</h2>
        <Card peek={<Avatar name="momo" size="lg" />}>
          <div className="flex flex-col gap-4">
            <Input label="Room key" code maxLength={6} autoComplete="off" placeholder="······" />
            <Input label="Your nickname" hint="Friends see this on the board." />
            <Button block size="lg">
              Join game
            </Button>
          </div>
        </Card>
        <Input label="Room key" code defaultValue="PLZ4K" error="Keys are 6 letters or numbers." />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Players</h2>
        <ul className="flex flex-wrap gap-3">
          {PLAYERS.map((name) => (
            <Chip key={name} as="li" leading={<Avatar name={name} size="sm" />}>
              {name}
            </Chip>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="brand">Host</Badge>
          <Badge tone="success">Ready</Badge>
          <Badge>Spectating</Badge>
          <Badge tone="danger">Left the room</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Room settings</h2>
        <Card className="flex flex-col gap-6">
          <Select label="Game" options={GAMES} placeholder="Pick a game" />
          <RadioGroup
            label="Round length"
            name="round-length"
            options={ROUND_LENGTHS}
            defaultValue="standard"
          />
          <Textarea label="House rules" hint="Players see this before the first round." />
          <div className="flex flex-col gap-1">
            <Checkbox
              label="Allow late joiners"
              hint="They start with zero points."
              defaultChecked
            />
            <Checkbox label="Show the leaderboard" />
            <Checkbox label="Voice chat" hint="Coming later." disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Switch label="Sound effects" hint="Plays when someone wins." defaultChecked />
            <Switch label="Reduce animations" />
          </div>
          <Button variant="secondary">Save settings</Button>
        </Card>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Feedback</h2>
        <Alert tone="success" title="Room created.">
          Share the key PLZ4K9 with your group.
        </Alert>
        <Alert
          tone="danger"
          title="That key expired."
          action={<Button variant="secondary">Ask for a new key</Button>}
        >
          Keys last one hour after the last round.
        </Alert>
        <Alert title="The host paused the game." />
        <Progress label="Round" value={3} max={5} valueText="3 of 5" />
        <Spinner label="Loading rounds" />
        <div className="flex items-center gap-3" aria-hidden="true">
          <Skeleton shape="circle" className="size-11" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-3/5" />
            <Skeleton className="w-2/5" />
          </div>
        </div>
        <p className="text-small text-ink-soft">
          A skeleton holds the shape of content on its way, so the screen appears at once.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Views</h2>
        <Tabs label="Game views" items={GAME_VIEWS} />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Nothing here yet</h2>
        <Card>
          <EmptyState
            title="No rounds yet."
            action={<Button variant="secondary">Start round</Button>}
          >
            Rounds you play in this room show up here.
          </EmptyState>
        </Card>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Interruptions</h2>
        <p className="text-ink-soft max-w-prose">
          A dialog is for a decision that must stop the user. It rises from the bottom on a phone
          and centres on a wide screen.
        </p>
        <div>
          <DialogDemo />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Page chrome</h2>
        <div className="border-line bg-paper rounded-card overflow-hidden border-2">
          <Header
            appName="Playroom"
            links={[
              { href: '/', label: 'Home' },
              { href: '/design', label: 'Design' },
            ]}
            currentPath="/design"
          />
          <Footer links={[{ href: '/api/health', label: 'Health' }]}>
            Built from the Cloud Run template.
          </Footer>
        </div>
        <p className="text-small text-ink-soft">
          Every page sits inside <code>PageShell</code>, which sets the width, gutter and rhythm.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Moments</h2>
        <Speech>momo joined. That makes five of you.</Speech>
        <Speech mood="sad">This key has expired. Ask the host for a fresh one.</Speech>
        <Card
          tone="brand-soft"
          peek={<Avatar name="bubbles" size="lg" mood="wow" />}
          className="flex flex-col gap-1"
        >
          <Sticker kind="sparkle" size={36} className="animate-pop absolute top-4 right-5" />
          <Sticker kind="heart" size={22} className="animate-pop absolute top-12 right-14" />
          <p className="font-display text-key">BINGO!</p>
          <p className="text-ink-soft">bubbles takes round 3 with two numbers to spare.</p>
        </Card>
      </section>
    </PageShell>
  );
}
