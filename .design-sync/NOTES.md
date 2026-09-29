# design-sync notes — Mochi

Synced to claude.ai/design project "Mochi Design System" (`projectId` in config.json).

## How this repo is shaped for the converter

- This is a Next.js **app**, not a published package. There is no `dist/`. The DS is
  `components/ui/` + `components/layout/`; `.design-sync/entry.ts` re-exports both.
  Feature folders (`auth`, `example`, `profile`, `design`) are app code and stay out.
- `buildCmd` must run before the converter on every sync:
  1. `node .design-sync/build-css.mjs` compiles `.design-sync/tailwind-entry.css`
     (imports `styles/globals.css`) with the repo's own `@tailwindcss/postcss` into
     `.design-sync/.cache/mochi.css` (= `cssEntry`).
  2. `tsc -p .design-sync/tsconfig.dts.json` emits `.d.ts` into `.design-sync/.cache/types`.
- `overrides/dts.mjs` is a fork (see `libOverrides`). It reads that `.d.ts` tree. It keeps
  inherited interaction props (`onClick`, `disabled`, `value`...) that upstream drops. It
  declares the package's own helper types a prop references (`RadioOption`, `TabItem`,
  `BackButtonProps`...) after the Props interface, and it prints an over-long
  string-literal union (Input's `type`) as `string`, not `unknown`.
  It needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` once per clone.
- `componentSrcMap` lists every component, because the converter derives the component
  list from `.d.ts` exports of the package entry, and an app has none.
- `next/link` and `next/navigation` are shimmed via `.design-sync/tsconfig.json` paths
  (`shims/`). `usePathname()` reads `document.documentElement.dataset.pathname`, default `/`.
- Fonts: the app loads them with `next/font/local`; `fonts.css` (`extraFonts`) declares
  the same families from `public/fonts/`, and `tailwind-entry.css` sets `--font-mochiy` /
  `--font-zen-maru` on `:root`.
- Playwright: chromium-1228 is cached locally; `playwright@1.61.1` in `.ds-sync/` matches it.

## Tailwind safelist

Only classes Tailwind finds in `components/` + `app/` are compiled, plus the
`@source inline(...)` safelist in `tailwind-entry.css`. A preview (or a design) using a
class outside that set silently gets no style — this bit Skeleton (`h-32`). Add to the
safelist, not to a component.

## Known render warns

- `[FONT_MISSING] "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold"` — system fallbacks
  in the `--font-sans` / `--font-display` stacks, after the shipped brand fonts. Benign.
- `[RENDER_THIN] Sticker` — SVG only, no text; the screenshot shows all three kinds. Benign.

## Preview notes

- Card overrides: `TabBar` single 390px (it is `fixed` and `md:hidden`), `SiteHeader`
  column 1200px (`hidden md:block`), `Dialog` single (opens with `showModal`), and
  column cards for wide ones (Header, Footer, PageShell, AppBar, Avatar, Face).
- MobileMenu's `Open` cell presses the menu button once on mount, because the open state
  is internal. The menu sits in a `relative` phone header row, as `Header` renders it.
- `AppBar`'s title has `py-1`: `truncate` clips to the line box, and Mochiy Pop One's
  descenders fall below `text-title`'s 1.15 line-height.

## Re-sync risks

- `componentSrcMap` must gain an entry for every new component in `components/ui/` or
  `components/layout/`, and `entry.ts` must export it.
- Previews are ported from `app/design/page.tsx`; when that page changes, re-check them.
- The fork `overrides/dts.mjs` is from design-sync 2.1.280; diff it against the bundled
  `lib/dts.mjs` on upgrades. Its prelude matches helper types by name in the generated
  `.d.ts`; two exported types with the same name would pick the first.
