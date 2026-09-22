import Link from 'next/link';

import { buttonStyles } from '@/components/ui/Button';
import { Face } from '@/components/ui/Face';

/**
 * The 404 route. It follows the empty-state recipe in design-language.md:
 * a sleepy face, one line that says what happened, one action that leaves.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-5 py-12 sm:px-8">
      <span className="bg-sunken border-line inline-grid size-20 place-items-center rounded-full border-2">
        <Face mood="sleepy" size={64} />
      </span>
      <h1 className="text-title">Page not found</h1>
      <p className="text-ink-soft max-w-prose">
        This page does not exist, or it moved somewhere else.
      </p>
      <div>
        <Link href="/" className={buttonStyles()}>
          Back to home
        </Link>
      </div>
    </main>
  );
}
