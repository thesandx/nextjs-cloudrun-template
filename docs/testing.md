# Testing

Vitest, jsdom and React Testing Library. `pnpm test` runs everything. Use `pnpm test:watch` while developing.

## Why Vitest

It resolves the same `tsconfig.json` path aliases natively (`resolve.tsconfigPaths`), needs no separate Babel or SWC transform config, and starts fast enough to run on every PR without caching. Jest would also work. It would just need more configuration to reach the same result.

## Layout

Tests live next to the code they test:

```
lib/utils.ts
lib/utils.test.ts
components/ui/Button.tsx
components/ui/Button.test.tsx
services/repository.emulator.test.ts   ← needs a running emulator, see below
tests/setup.ts                          ← global setup, loaded before every test file
tests/server-only.stub.ts               ← aliased over the `server-only` package
```

Colocation makes a test hard to overlook when you change the implementation. When you move a module, its test moves with it.

### Environments

The default is jsdom. A file opts into Node with a directive on its first line:

```ts
// @vitest-environment node
```

Use it for anything that is not React. `services/*.emulator.test.ts` needs it because the Google Cloud SDKs use gRPC and Node APIs jsdom does not provide. `lib/env.test.ts` needs it for a subtler reason: `lib/env.ts` skips its production requirement when `window` is defined, and jsdom defines `window` — under the default environment those tests would pass while proving nothing about container startup.

`tests/setup.ts` runs for every file regardless, so everything DOM-specific in it is guarded. Without the guard a Node-environment file fails during setup with `window is not defined`, before a single test runs.

### `server-only`

Every module in `services/` starts with `import 'server-only'`, which resolves to a module that throws unless the bundler picked its `react-server` export. Next.js does; Vitest does not.

`vitest.config.ts` therefore aliases it to `tests/server-only.stub.ts`. The guard still applies to `next build`, which is the build that ships. Remove the alias and every test touching `services/` fails with "This module cannot be imported from a Client Component module".

## The Server Component constraint

**Async Server Components cannot be rendered by React Testing Library.** There is no supported way to render them in a test environment today.

This is less limiting than it first appears. An async Server Component is usually two separable things:

```tsx
// app/orders/page.tsx  — thin, mostly composition
export default async function OrdersPage() {
  const orders = await getOrders(); // ← the logic worth testing
  return <OrderList orders={orders} />; // ← the rendering worth testing
}
```

Test `getOrders()` as a unit in `services/`, and `<OrderList>` as a component. An end-to-end test covers the page that combines them, if the project has one.

**Synchronous** Server Components — like `app/page.tsx` in this template — render fine. See `app/page.test.tsx`.

## Writing tests

Query the way a user finds things: by role and accessible name.

```tsx
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('calls onClick when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
```

Query priority, best to worst:

1. `getByRole` with a name — matches how assistive technology finds elements
2. `getByLabelText` — form fields
3. `getByText` — non-interactive content
4. `getByTestId` — last resort

If a query is hard to write, the markup is probably inaccessible. Fix the markup instead of using a test id.

## Testing services

Mock at the network boundary, not the module boundary — mocking your own module tests the mock.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getUser } from '@/services/user.service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getUser', () => {
  it('returns the parsed user on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: '1', email: 'a@b.c' }), { status: 200 }),
        ),
    );

    const result = await getUser('1');

    expect(result).toEqual({ ok: true, data: { id: '1', email: 'a@b.c' } });
  });

  it('returns an error result on a 500 rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const result = await getUser('1');

    expect(result.ok).toBe(false);
  });
});
```

**Test the failure paths.** Most incidents come from a failure path, not the happy path.

## Testing the data layer

Three different problems, three different answers.

### Pure rules — test them exhaustively

`lib/storage-paths.ts` decides which object paths and uploads are allowed, and it calls nothing. That is the whole reason it is in `lib/`: the rules most worth testing are also the cheapest to test.

```ts
it('never produces a name that buildObjectPath then rejects', () => {
  for (const hostile of ['../../etc/passwd', 'emoji-🙂.png', 'null\u0000byte.png']) {
    const filename = sanitiseFilename(hostile);
    expect(() => buildObjectPath({ collection: 'x', docId: 'y', filename })).not.toThrow();
  }
});
```

No emulator, no bucket, no credential. These run in `pnpm validate` like any other test.

### The repository — against a real emulator

```bash
pnpm test:emulator
```

Mocks are the wrong tool here. The behaviour worth testing is Firestore's, not ours: whether `update` rejects a missing document, whether a cursor stays stable across a page boundary, whether `serverTimestamp` has resolved by the next read. A mock answers each of those the way its author expected — which is exactly the assumption that needs checking.

So the suites talk to the emulator, and skip when it is absent:

```ts
// @vitest-environment node

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const describeEmulator = emulatorHost === '' ? describe.skip : describe;

describeEmulator('createRepository (emulator)', () => {
  // ...
});
```

Name the file `*.emulator.test.ts`, give each run a fresh collection (`notes_${Date.now()}_${random}`) so a crashed earlier run cannot fail this one, and clean up in `afterAll`.

**The skip is a convenience, not permission to ignore them.** CI runs `pnpm test:emulator` in its own required job. Run it yourself before pushing a change to `services/repository.ts` or a collection schema.

### Cloud Storage — there is no emulator

Test the path and validation logic (pure, above), and leave the signing and the moving to the dev bucket. The parts worth automating are already the pure ones.

## Route handlers

Route handlers are plain functions — call them directly.

```ts
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });

  it('is never cached', () => {
    expect(GET().headers.get('cache-control')).toContain('no-store');
  });
});
```

## Coverage

```bash
pnpm test:coverage
```

No threshold is enforced, deliberately. A coverage gate reliably produces tests that only satisfy the gate — assertions on getters, snapshot tests of static markup. They cost maintenance and catch nothing.

Use coverage as a map of what is untested, then decide what is worth testing. If your team wants a floor anyway, add `thresholds` to `vitest.config.ts`. Start it _below_ the current number, so it rises over time instead of blocking work immediately.

## What to test

| Test                                    | Skip                                            |
| --------------------------------------- | ----------------------------------------------- |
| Business logic and edge cases           | Framework behaviour (Next.js is already tested) |
| Error and failure paths                 | Trivial getters and pass-through props          |
| Component behaviour a user observes     | Implementation details and internal state       |
| Boundary parsing and validation         | Static markup snapshots                         |
| Anything a bug report was filed against | Third-party library internals                   |

## Not included

**End-to-end tests.** Playwright against a running container is the right next step when the app has real user journeys — a login, a checkout, a multi-step form. Adding it before there is a journey to test is a maintenance cost with no return.

When you add it: run it against `docker compose up`, so it exercises the production image rather than the dev server.
