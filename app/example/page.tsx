import type { Metadata } from 'next';

import { ExampleForm } from '@/components/example/ExampleForm';
import { formatUtc } from '@/lib/utils';
import { type ExampleView, listExamples } from '@/services/example.service';

/**
 * EXAMPLE — `GET /example`.
 *
 * An async Server Component: it reads Firestore and signs read URLs on the
 * server, so the browser downloads JavaScript only for the form. The list,
 * the query and the credentials never cross the network boundary.
 *
 * Note what it does NOT do: there is no `useEffect` fetching `/api/example`.
 * The route handler exists for the form and for other clients; the page reads
 * the service directly, which is one less round trip.
 *
 * Delete this folder with the rest of the example.
 */

export const metadata: Metadata = {
  title: 'Data layer example',
  robots: { index: false, follow: false },
};

// Reads live data on every request, and signs URLs that expire. Caching either
// would serve stale rows and dead image links.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

function ExampleCard({ item }: { item: ExampleView }): React.JSX.Element {
  return (
    <li className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4">
      {item.imageUrl === null ? (
        <div className="border-border text-muted flex h-24 w-full shrink-0 items-center justify-center rounded border border-dashed text-xs sm:w-24">
          No image
        </div>
      ) : (
        // A plain <img>, not next/image: the source is a signed URL that
        // changes on every render, so the optimiser's cache would never hit and
        // every request would re-fetch through the Next.js image endpoint.
        // eslint-disable-next-line @next/next/no-img-element -- signed URLs are unstable by design; see above
        <img
          src={item.imageUrl}
          alt=""
          className="h-24 w-full shrink-0 rounded object-cover sm:w-24"
          loading="lazy"
        />
      )}

      <div className="min-w-0">
        <h3 className="truncate font-medium">{item.title}</h3>
        <p className="text-muted mt-1 text-sm">{item.ownerName}</p>
        <p className="text-muted mt-1 font-mono text-xs">{formatUtc(item.createdAt)}</p>
      </div>
    </li>
  );
}

export default async function ExamplePage(): Promise<React.JSX.Element> {
  const { items, nextCursor } = await listExamples({ limit: PAGE_SIZE });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-muted font-mono text-xs uppercase tracking-wider">Example</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Data layer</h1>
        <p className="text-muted text-balance text-sm sm:text-base">
          Firestore for documents, Cloud Storage for files, both reached with the Cloud Run service
          account and no key file. Copy the pattern, then delete this page.
        </p>
      </header>

      <section aria-labelledby="create-heading" className="flex flex-col gap-4">
        <h2 id="create-heading" className="text-lg font-medium">
          Create
        </h2>
        <ExampleForm />
      </section>

      <section aria-labelledby="list-heading" className="flex flex-col gap-4">
        <h2 id="list-heading" className="text-lg font-medium">
          Latest {PAGE_SIZE}
        </h2>

        {items.length === 0 ? (
          <p className="text-muted text-sm">Nothing yet. Create one above.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <ExampleCard key={item.id} item={item} />
            ))}
          </ul>
        )}

        {nextCursor !== null ? (
          <p className="text-muted text-sm">
            More rows exist. Pass <code className="font-mono text-xs">?cursor={nextCursor}</code> to{' '}
            <code className="font-mono text-xs">/api/example</code> for the next page — cursors,
            never offsets.
          </p>
        ) : null}
      </section>
    </main>
  );
}
