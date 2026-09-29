---
name: add-component
description: Add a React component to this repo in the right folder (components/ui, components/layout or components/<feature>), with an exported props interface, tokens-only styling, a colocated test, and a /design entry for a new primitive. Use when asked to create or extract a component.
---

# Add a component

The steps live in one place: [`docs/recipes.md` > Add a component](../../../docs/recipes.md#add-a-component). Follow them in order.

## Read first

1. `docs/recipes.md` — the "Add a component" section.
2. `.github/instructions/project-structure.md` — which folder.
3. `.github/instructions/design-language.md` — tokens, primitives, anti-slop.
4. The closest existing primitive in `components/ui/`. **Add a variant to it before you write a new one.**

## Rules that are easy to miss

- `components/ui/` takes props and does no fetching. `pnpm lint` refuses a `@/services/*` import there.
- Export the props interface and accept `className`.
- Colocate `<Name>.test.tsx`.
- A new or changed `components/ui/` primitive also appears on `/design` (`app/design/page.tsx`) in the same pull request.

## Done when

`pnpm validate` is green, including the new test.
