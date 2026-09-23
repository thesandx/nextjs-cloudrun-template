'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

/**
 * EXAMPLE — the only Client Component in the example.
 *
 * `'use client'` is justified here and nowhere else in this feature: the form
 * holds state, handles submit and change events, and reads a `File` from an
 * `<input type="file">`. The page that renders it stays a Server Component, so
 * the list, the Firestore read and the URL signing ship no JavaScript.
 *
 * It demonstrates the three-step upload from the browser's side:
 *   1. POST /api/example            → create the document, get its id
 *   2. POST /api/example/upload     → get a signed PUT URL
 *   3. PUT  <signed url>            → send the bytes straight to Cloud Storage
 *   4. POST /api/example/finalize   → server verifies and attaches the object
 */

interface SignedUploadResponse {
  url: string;
  tmpPath: string;
  headers: Record<string, string>;
}

/** Must match ALLOWED_IMAGE_TYPES in services/example.service.ts. */
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/avif';

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return String((body as { message: unknown }).message);
    }
  } catch {
    // A non-JSON error body is not worth a second failure mode.
  }
  return `Request failed with status ${response.status}`;
}

export interface ExampleFormProps {
  className?: string;
}

export function ExampleForm({ className }: ExampleFormProps): React.JSX.Element {
  const router = useRouter();
  const titleId = useId();
  const ownerId = useId();
  const fileId = useId();

  const [title, setTitle] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('working');
    setError(null);

    try {
      const created = await fetch('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, ownerName }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!created.ok) throw new Error(await readError(created));
      const { id } = (await created.json()) as { id: string };

      if (file !== null) {
        const signed = await fetch('/api/example/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exampleId: id, filename: file.name, contentType: file.type }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!signed.ok) throw new Error(await readError(signed));
        const upload = (await signed.json()) as SignedUploadResponse;

        // Straight to Cloud Storage. `upload.headers` must be sent byte for
        // byte — they are part of the signature, and GCS recomputes it.
        // A longer timeout here: this is the user's upstream connection, not a
        // server-to-server call.
        const put = await fetch(upload.url, {
          method: 'PUT',
          headers: upload.headers,
          body: file,
          signal: AbortSignal.timeout(120_000),
        });
        if (!put.ok) throw new Error(`Upload failed with status ${put.status}`);

        const finalized = await fetch('/api/example/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exampleId: id, tmpPath: upload.tmpPath }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!finalized.ok) throw new Error(await readError(finalized));
      }

      setTitle('');
      setOwnerName('');
      setFile(null);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setStatus('idle');
    }
  }

  const fieldClass =
    'border-border bg-background min-h-11 w-full rounded-md border px-3 py-2 text-base';
  const labelClass = 'text-muted block text-sm font-medium';

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className={`flex w-full flex-col gap-4 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className={labelClass}>
          Title
        </label>
        <input
          id={titleId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ownerId} className={labelClass}>
          Owner name
        </label>
        <input
          id={ownerId}
          name="ownerName"
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          required
          maxLength={120}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className={labelClass}>
          Image <span className="font-normal">(optional, max 5 MB)</span>
        </label>
        <input
          id={fileId}
          name="image"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-transparent file:text-sm`}
        />
      </div>

      {error !== null ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'working'}
        className="bg-accent text-background min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === 'working' ? 'Saving…' : 'Create example'}
      </button>
    </form>
  );
}
