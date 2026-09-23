import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Face } from '@/components/ui/Face';
import { Input } from '@/components/ui/Input';
import { Speech } from '@/components/ui/Speech';
import { Sticker } from '@/components/ui/Sticker';
import { env } from '@/lib/env';

/**
 * Home page — a Server Component. No `'use client'`, no hooks, no JS shipped
 * to the browser for this route. The press effect on a button is CSS, so the
 * page is interactive with JavaScript switched off.
 *
 * It has two jobs. It proves the deploy works, with real values from the
 * running build. And it shows a new contributor what the template gives them,
 * built only from the primitives in `components/ui/`.
 *
 * Replace it with the real application. Keep the folder conventions in
 * .github/instructions/, and keep building the UI from the primitives.
 */

/** Example players. Real nicknames, not invented full names. See design-language.md > Words. */
const PLAYERS = ['momo', 'sandy', 'captain_k', 'bubbles', 'rajma chawal'];

/**
 * The deploy workflow passes the commit SHA as a build arg, so this value is
 * inlined at build time and is correct for the image you are looking at.
 * Region and deploy time are set on the Cloud Run service at runtime, which a
 * statically prerendered page cannot read — `/api/health` serves those.
 * See CLAUDE.md > Traps, item 8.
 */
const commit = env.appVersion.length > 7 ? env.appVersion.slice(0, 7) : env.appVersion;

const BUILD_FACTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Service', value: env.appName },
  { label: 'Commit', value: commit },
  { label: 'Mode', value: env.nodeEnv },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-5 py-12 sm:gap-24 sm:px-8 sm:py-20">
      <header className="flex flex-col gap-5">
        <span className="bg-brand-soft border-line shadow-mochi-lg inline-grid size-20 place-items-center rounded-full border-2">
          <Face size={64} blink label="The Mochi mascot" />
        </span>
        <h1 className="text-hero">Hello World</h1>
        <p className="text-ink-soft max-w-prose">
          This project is running successfully on Google Cloud Run. Everything you see below comes
          from the seven primitives in <Code>components/ui/</Code> — so a new screen starts from
          parts that already match.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/design" className={buttonStyles()}>
            See every component
          </Link>
          <Link href="/api/health" className={buttonStyles({ variant: 'quiet' })}>
            Check the health probe
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">This build</h2>
        <Card>
          <dl className="grid gap-5 sm:grid-cols-3">
            {BUILD_FACTS.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <dt className="text-small text-ink-soft">{fact.label}</dt>
                <dd className="font-display break-all">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <p className="text-small text-ink-soft max-w-prose">
          The deploy workflow passes the commit as a build argument, so it is baked into this image.
          The region and the deploy time belong to the Cloud Run service, not the image, so{' '}
          <Code>/api/health</Code> serves those at runtime — with the full commit.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">The primitives, in one screen</h2>
        <p className="text-ink-soft max-w-prose">
          An example, not a product — nothing below is wired to anything. It is here so you can see
          the parts working together before you write your first screen.
        </p>

        <Card
          tone="brand-soft"
          peek={<Avatar name="momo" size="lg" />}
          className="flex flex-col gap-6"
        >
          <Sticker kind="sparkle" size={32} className="absolute top-5 right-5" />
          <Sticker kind="heart" size={20} className="absolute top-14 right-14 hidden sm:block" />

          <Speech>Five of you are here. Start when you like.</Speech>

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

          <Input label="Room key" code maxLength={6} autoComplete="off" placeholder="······" />
        </Card>

        <p className="text-small text-ink-soft max-w-prose">
          Every face is drawn from its nickname, so a player keeps the same one all session. The
          page at <Code>/design</Code> renders every variant and every token.
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-title">Make it yours</h2>
        <ol className="marker:text-ink marker:font-display flex list-decimal flex-col gap-4 pl-6">
          <Step>
            Start with <Code>CLAUDE.md</Code> — the operating manual. It records the traps that look
            like bugs and are not.
          </Step>
          <Step>
            Read <Code>.github/instructions/design-language.md</Code> before you write any UI.{' '}
            <Code>pnpm lint</Code> enforces most of it.
          </Step>
          <Step>
            Run <Code>pnpm rename</Code> to take the template name off the project.
          </Step>
          <Step>
            Replace this page. Keep <Code>/design</Code> — it stays useful for as long as the
            product does.
          </Step>
        </ol>
      </section>
    </main>
  );
}

/**
 * A file path or command inside a sentence. A tinted chip rather than a
 * monospace face, which the design language keeps out of small text.
 */
function Code({ children }: { children: React.ReactNode }) {
  return <span className="bg-sunken rounded-input px-1 py-0.5 font-medium">{children}</span>;
}

function Step({ children }: { children: React.ReactNode }) {
  return <li className="text-ink-soft max-w-prose">{children}</li>;
}
