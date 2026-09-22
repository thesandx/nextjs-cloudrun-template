import Link from 'next/link';

import { buttonStyles } from '@/components/ui/Button';
import { Face } from '@/components/ui/Face';

/**
 * Home page — a Server Component. No `'use client'`, no hooks, no JS shipped
 * to the browser for this route.
 *
 * This is the only page in the template. Replace it with the real application;
 * keep the folder conventions described in .github/instructions/, and build
 * the UI from the Mochi primitives described in design-language.md.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-5 py-12 sm:px-8">
      <span className="bg-brand-soft border-line shadow-mochi inline-grid size-20 place-items-center rounded-full border-2">
        <Face size={64} blink label="The Mochi mascot" />
      </span>
      <h1 className="text-hero">Hello World</h1>
      <p className="text-ink-soft max-w-prose">
        This project is running successfully on Google Cloud Run.
      </p>
      <div>
        <Link href="/design" className={buttonStyles()}>
          See the design language
        </Link>
      </div>
    </main>
  );
}
