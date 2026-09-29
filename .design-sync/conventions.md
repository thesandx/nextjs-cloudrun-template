# Mochi — how to build with it

Mochi is a soft, chunky design language: 2px ink outlines, a hard shadow straight down (the "mochi base"), rounded fonts, candy tones and little faces. Components are React, exposed on `window.Mochi` (`Mochi.Button`, `Mochi.Card`, …).

## Setup

No provider or wrapper is needed. Load `styles.css`: it carries the tokens, fonts and every utility class the components use, and styles `body` itself (paper background, ink text, Zen Maru Gothic). Headings `h1`–`h3` get the display font (Mochiy Pop One) automatically. Never set `font-bold` on a heading — the display face has one weight.

Themes re-assign tokens only. Default is "playroom". For a calm or dark product, set `data-theme="calm"` or `data-theme="night"` on `<html>`.

## Styling idiom: Tailwind utilities built from tokens

Style your own layout with these classes. Only classes compiled into `_ds_bundle.css` resolve: **no default Tailwind colours (`bg-blue-500`), no `rounded-lg`, no `shadow-lg`, no arbitrary values (`bg-[#fff]`, `w-[312px]`)**.

| Family      | Classes                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Colour      | `bg-` / `text-` / `border-` + `paper` `surface` `sunken` `ink` `ink-soft` `line` `brand` `brand-soft` `butter` `soda` `grape` `peach` `danger` `success` |
| Type        | `text-hero` `text-title` `text-heading` `text-body` `text-small` `text-key` · `font-display` `font-sans` · `font-medium`               |
| Radius      | `rounded-box` `rounded-input` `rounded-card` `rounded-sheet` `rounded-pill`                                                           |
| Outline     | `border-2 border-line` (outlines are always 2px ink)                                                                                   |
| Shadow      | `shadow-mochi-sm` `shadow-mochi` `shadow-mochi-lg`; `squish` makes a custom surface pressable                                        |
| Layout      | `flex` `grid` `gap-*` `p-*` `px-*` `py-*` `grid-cols-1…4` `max-w-5xl` `max-w-3xl` `mx-auto` `w-full` with `sm:` `md:` `lg:`             |
| Motion      | `animate-pop` `animate-rise-in` `animate-fade-in` `animate-wobble`                                                                   |

Page background is `bg-paper`; cards and inputs sit on `bg-surface`. Candy tones (`butter`, `soda`, `grape`, `peach`) are for identity, never meaning. Status (`danger`, `success`) always comes with words or an icon — use `Alert`, `Badge`, `FieldError`.

## Rules the components assume

- **One primary action per screen.** Exactly one `<Button>` (default `variant="primary"`); everything else `secondary` or `quiet`. Labels are verb phrases: "Create room", not "Submit".
- **Mobile first.** Unprefixed classes are the phone layout; add `sm:`/`md:`/`lg:`. On a phone the app is an app: `AppBar` on top (with `back`) and `TabBar` at the bottom. From `md` up it is a website: `SiteHeader` (or `Header`) on top, content in `PageShell` (the `max-w-5xl` frame), columns at `lg`.
- Every form control takes a visible `label`; errors go in the `error` prop, which replaces the hint.
- `Card peek={<Avatar …/>}` perches an avatar on the card's top edge — leave room above it (`pt-8`).

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: every token (`--color-*`, `--text-*`, `--radius-*`, `--shadow-mochi*`) and class.
- `guidelines/.github/instructions/design-language.md`: the full rulebook (cute budget, words, anti-slop list).
- `components/<group>/<Name>/<Name>.prompt.md` and `<Name>.d.ts`: each component's API and examples.

## Example

```jsx
const { PageShell, Card, Avatar, Input, Button, Badge } = window.Mochi;

<PageShell>
  <header className="flex flex-col gap-3">
    <h1 className="text-title">Join a room</h1>
    <p className="text-ink-soft">Ask the host for the 6-letter key.</p>
  </header>
  <div className="grid gap-6 lg:grid-cols-2">
    <Card peek={<Avatar name="momo" size="lg" />}>
      <div className="flex flex-col gap-4">
        <Input label="Room key" code maxLength={6} placeholder="······" />
        <Input label="Your nickname" hint="Friends see this on the board." />
        <Button block size="lg">Join game</Button>
      </div>
    </Card>
    <Card tone="butter" className="flex flex-col gap-2">
      <Badge tone="brand">Host</Badge>
      <p className="font-display text-heading">Bingo night</p>
      <p className="text-ink-soft">Five players, round 3 of 5.</p>
    </Card>
  </div>
</PageShell>
```
