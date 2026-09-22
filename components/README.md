# `components/`

Reusable React components. `components/ui/` ships the Mochi primitives; everything else is yours to add.

The visual rules are in [`.github/instructions/design-language.md`](../.github/instructions/design-language.md). Read it before you add a component. The primitives render with real content at `/design`.

## Layout

| Folder                  | Contents                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `components/ui/`        | Mochi primitives: `Button`, `Card`, `Input`, `Avatar`, `Face`, `Speech`, `Sticker`. |
| `components/layout/`    | Structural chrome: `Header`, `Footer`, `Sidebar`, `PageShell`.                      |
| `components/<feature>/` | Components belonging to one feature. Create the folder when the feature exists.     |

## Rules

1. **Server Components by default.** Only add `'use client'` when the component needs state, effects, event handlers, or browser-only APIs.
2. **Push `'use client'` to the leaves.** A client boundary at the top of a tree turns every descendant into client code. Keep interactive islands small and let Server Components pass data into them as props.
3. **One component per file**, named after the file. `components/ui/Button.tsx` exports `Button`.
4. **Props are typed and exported** so consumers and tests can reference them: `export interface ButtonProps { ... }`.
5. **No data fetching inside `ui/`.** Presentational components receive data as props. Fetching belongs in a Server Component page or in `services/`.
6. **Accessible by construction.** Semantic elements, real `<button>`s, labelled inputs, keyboard reachable. `eslint-plugin-jsx-a11y` runs via `eslint-config-next` and its findings are errors, not suggestions.
7. **Style with Tailwind utilities and the tokens in `styles/globals.css`.** No raw hex, no arbitrary values, no default Tailwind colours, sizes, radii or shadows. `pnpm lint` fails on each of these.
   **Reach for a primitive before you write one.** If a primitive is missing a variant, add the variant there rather than styling around it.
8. **Mobile-first and responsive.** Base utilities target the small screen; add `sm:`/`md:`/`lg:` to scale up. Use fluid widths, keep touch targets at least 44px, and never cause horizontal scroll on a phone.
9. **Colocate a test.** `components/ui/Button.tsx` has `components/ui/Button.test.tsx` beside it. A new or changed primitive also appears on `/design`, in the same pull request.

## Template

A feature component, built from the primitives and the tokens:

```tsx
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export interface PlayerCardProps {
  name: string;
  score: number;
  className?: string;
}

export function PlayerCard({ name, score, className }: PlayerCardProps) {
  return (
    <Card peek={<Avatar name={name} size="lg" />} className={cn('flex flex-col gap-1', className)}>
      <h2 className="text-heading">{name}</h2>
      <p className="text-small text-ink-soft">{score} points</p>
    </Card>
  );
}
```
