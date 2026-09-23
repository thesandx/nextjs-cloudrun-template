# `services/`

The integration layer: every call that leaves this process lives here.

The template ships the data layer in this folder — Firestore, Cloud Storage, and a typed repository over both. Read [`docs/data-layer.md`](../docs/data-layer.md) before adding a collection, and [CLAUDE.md > Firestore data modeling](../CLAUDE.md#firestore-data-modeling) before writing a query.

| Module                | Owns                                                     |
| --------------------- | -------------------------------------------------------- |
| `firestore.client.ts` | Lazy Firestore singleton, pinned to the named database   |
| `storage.client.ts`   | Lazy Cloud Storage singleton and the app's bucket        |
| `repository.ts`       | Typed, zod-validated, cursor-paginated collections       |
| `storage.service.ts`  | Signed upload and read URLs, upload verification         |
| `sharded-counter.ts`  | Counters above one write per second                      |
| `health.service.ts`   | The opt-in dependency checks behind `/api/health?deep=1` |
| `example.service.ts`  | **Example.** Delete it once you have copied the pattern  |

## Why this layer exists

Without it, `fetch` calls, retry logic, auth headers and response parsing spread across pages and components. Named modules keep them in one place: the rest of the app calls `userService.getById(id)` — a typed function — and knows nothing about transport. A change from REST to gRPC, or a new cache, then touches one file.

## `services/` vs `lib/`

|              | `lib/`                                        | `services/`                                  |
| ------------ | --------------------------------------------- | -------------------------------------------- |
| Purpose      | Pure helpers, config, cross-cutting utilities | I/O with external systems                    |
| Side effects | None                                          | Network, database, cloud SDKs                |
| Examples     | `cn()`, `env`, `logger`                       | `userService`, `billingService`, `gcsClient` |

## Rules

1. **Server-side only.** Files here may read secrets and MUST NOT be imported from a `'use client'` component. Add `import 'server-only';` at the top of **every** module here — the build then fails loudly if a client component imports it. Note that Vitest needs the stub aliased in `vitest.config.ts`; the guard still applies to `next build`, which is the build that ships.
2. **One module per external system**, named `<domain>.service.ts` or `<system>.client.ts`.
3. **Validate at the boundary.** Never assume an external payload matches its declared type; parse and narrow, then return your own domain type from `types/`.
4. **Return `Result<T>` (see `types/index.ts`) or throw a typed error.** Do not return `null` to mean three different failures.
5. **Every outbound call gets a timeout.** An un-timed `fetch` on Cloud Run holds a request slot open until the platform's 300s limit. This exhausts concurrency during a downstream outage. `AbortSignal.timeout` covers `fetch`; the Google Cloud SDKs use gRPC, so wrap those in `withTimeout` from `@/lib/utils`.
6. **Log failures via `@/lib/logger`**, never `console.log`.
7. **Log identifiers, never contents.** A collection name, a document id and an object path are safe and make an error traceable. File contents, personal data and a signed URL are not — a signed URL is a bearer credential for as long as it lives.
8. **Construct a cloud client lazily.** A module-level `new Firestore()` opens a gRPC channel at import time, which makes `next build` reach for credentials on a CI runner that has none.

## Template

```ts
import 'server-only';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { Result } from '@/types';

const TIMEOUT_MS = 5_000;

export interface User {
  id: string;
  email: string;
}

export async function getUser(id: string): Promise<Result<User>> {
  try {
    const response = await fetch(`${env.appUrl}/api/users/${id}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return { ok: false, error: new Error(`Upstream returned ${response.status}`) };
    }

    return { ok: true, data: (await response.json()) as User };
  } catch (error) {
    logger.error('getUser failed', error, { userId: id });
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
```
