---
name: add-page
description: Add a new page (a route under app/) to this Next.js app, in the Mochi design language, mobile-first, with metadata and site-checklist compliance. Use when asked to create a page, screen, or route that renders UI.
---

# Add a page

The steps live in one place: [`docs/recipes.md` > Add a page](../../../docs/recipes.md#add-a-page). Follow them in order. This skill adds only the reading list and the checks.

## Read first

1. `docs/recipes.md` — the "Add a page" section.
2. `.github/instructions/design-language.md` — the twelve rules, [Responsive](../../../.github/instructions/design-language.md#responsive-an-app-on-a-phone-a-website-on-a-desktop) and [the site checklist](../../../.github/instructions/design-language.md#the-site-checklist).
3. An existing page with the same posture: `app/profile/page.tsx` (behind a login) or `app/example/page.tsx` (public, with a form).

## Rules that are easy to miss

- Server Component by default. Push `'use client'` to the smallest leaf that needs it.
- Build from `components/ui/` primitives and tokens. No raw hex, no arbitrary values — `pnpm lint` refuses them.
- Export `metadata` with a `title` and a one-sentence `description`.
- Do not link to the page from anywhere until the file exists. `tests/site-checklist.test.ts` fails on a broken link.
- Exactly one `Button variant="primary"` in any viewport.

## Done when

- `pnpm validate` is green.
- You checked the layout at 320px, 768px and 1440px, or you said plainly that you did not.
