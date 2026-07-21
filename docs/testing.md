# Testing

Vitest, jsdom and React Testing Library. `pnpm test` runs everything; `pnpm test:watch` while developing.

## Why Vitest

It resolves the same `tsconfig.json` path aliases natively (`resolve.tsconfigPaths`), needs no separate Babel or SWC transform config, and starts fast enough to run on every PR without caching. Jest would work; it would just need more configuration to reach the same place.

## Layout

Tests live next to the code they test:

```
lib/utils.ts
lib/utils.test.ts
components/ui/Button.tsx
components/ui/Button.test.tsx
tests/setup.ts          ← global setup, loaded before every test file
```

Colocation means a test is impossible to overlook when changing the implementation, and moving a module moves its test with it.

## The Server Component constraint

**Async Server Components cannot be rendered by React Testing Library.** There is no supported way to render them in a test environment today.

This is not the limitation it first appears, because an async Server Component is usually two separable things:

```tsx
// app/orders/page.tsx  — thin, mostly composition
export default async function OrdersPage() {
  const orders = await getOrders(); // ← the logic worth testing
  return <OrderList orders={orders} />; // ← the rendering worth testing
}
```

Test `getOrders()` as a unit in `services/`, and `<OrderList>` as a component. The page that glues them together is covered by an end-to-end test, if the project has one.

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

If a query is hard to write, the markup is probably inaccessible. Fix the markup rather than reaching for a test id.

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

**Test the failure paths.** The happy path rarely causes the incident.

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

No threshold is enforced, deliberately. A coverage gate reliably produces tests written to satisfy the gate — assertions on getters, snapshot tests of static markup — which cost maintenance and catch nothing.

Use coverage as a map of what is untested, then decide what is worth testing. If your team wants a floor anyway, add `thresholds` to `vitest.config.ts` and start it _below_ the current number so it ratchets up rather than blocking work on day one.

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
