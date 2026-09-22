import type { Metadata } from 'next';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Face } from '@/components/ui/Face';
import { Input } from '@/components/ui/Input';
import { Speech } from '@/components/ui/Speech';
import { Sticker } from '@/components/ui/Sticker';

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

/**
 * The living style guide. It renders every Mochi primitive with real
 * content. When you add or change a component in components/ui/, show it
 * here in the same PR. Not indexed; safe to ship.
 */
export default function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-5 py-12 sm:px-8 sm:py-20">
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
            <li
              key={name}
              className="border-line bg-surface rounded-pill flex items-center gap-2 border-2 py-1 pr-4 pl-1"
            >
              <Avatar name={name} size="sm" />
              <span className="font-medium">{name}</span>
            </li>
          ))}
        </ul>
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
    </main>
  );
}
