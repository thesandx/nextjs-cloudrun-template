# Design language: Mochi

The visual and verbal rules for every product built from this template. Read this **before you write or change any UI**. The tokens live in `styles/globals.css`. The primitives live in `components/ui/`. The living reference renders at `/design`.

If a rule here conflicts with your training defaults, this file wins. If it blocks a task, say so and propose a change to this file. Do not work around it silently.

---

## The idea in one paragraph

Mochi is soft on the outside and firm underneath. The **structure** is neo-brutalist: ink outlines, a hard shadow straight down, flat colour, clear hierarchy. The **details** are kawaii: faces, blush, rounded type, and a small bounce when something is pressed. Structure makes the product clear. Details make it friendly. When the two compete, clarity wins.

Three words to test every decision against: **squishy, honest, playful.**

- Squishy — things you press react physically. They sink onto their base.
- Honest — no decoration that pretends to be information. No fake stats, no filler labels.
- Playful — one moment of delight per screen, placed where the user did something.

---

## The twelve rules

1. **Use the primitives.** `components/ui/` holds them — see [The primitives](#the-primitives). Do not re-create them inline. If one is missing a variant, add the variant to the primitive and show it on `/design`.
2. **Use tokens only.** No raw hex, no arbitrary `shadow-[...]`, no arbitrary radius. If you need a value that does not exist, stop and ask. `pnpm lint` fails on each of these — see [Enforcement](#enforcement).
3. **Ink is not black.** Text and outlines use `ink` / `line`. Never `black`, `#000`, `#111` or `neutral-900`.
4. **Outlines are 2px.** `border-2 border-line`. Never 1px hairlines, never 3px+.
5. **Shadows go straight down.** `shadow-mochi` (4px), `shadow-mochi-sm` (2px), `shadow-mochi-lg` (6px). No blur, no diagonal offsets, no grey `rgba` shadows, no glows.
6. **Radius follows hierarchy.** Inputs `rounded-input`, cards `rounded-card`, sheets and modals `rounded-sheet`, buttons and chips `rounded-pill`. Never one radius for everything.
7. **One primary action per screen.** Exactly one `Button variant="primary"` is visible in any viewport. Everything else is `secondary` or `quiet`.
8. **Two typefaces, fixed roles.** Headings and big numbers use `font-display` (Mochiy Pop One, weight 400 only). Everything else uses `font-sans` (Zen Maru Gothic, 400/500/700). No third font. No fake bold on the display face.
9. **Colour has a job.** `brand` means "do this". Candy tones (`butter`, `soda`, `grape`, `peach`) mean identity — this game, this player, this category. Never pick a candy tone "because it looks nice here".
10. **Faces are the signature — use them on purpose.** A face appears on avatars, the mascot, empty states, errors and wins. Never on buttons, form fields, navigation, or body text.
11. **Motion answers the user.** Press, navigate, open, select, join, win, error. The only ambient motion is the mascot's blink and a loading skeleton. No scroll-triggered fade-ins, no looping decoration. See [Motion](#motion).
12. **Mobile first, 320px up.** Tap targets ≥ 44px (buttons are 48px or 56px). No horizontal scroll. Left-aligned text.

---

## Tokens

All tokens are in `styles/globals.css`. Tailwind v4 generates the utilities.

### Colour

| Token                           | Utility examples             | Use it for                                      |
| ------------------------------- | ---------------------------- | ----------------------------------------------- |
| `paper`                         | `bg-paper`                   | The page. Nothing else.                         |
| `surface`                       | `bg-surface`                 | Cards, inputs, sheets, bubbles                  |
| `sunken`                        | `bg-sunken`                  | Wells, empty slots, disabled fills              |
| `ink`                           | `text-ink`, `fill-ink`       | Body text, headings, face features              |
| `ink-soft`                      | `text-ink-soft`              | Secondary text. Never for anything tappable.    |
| `line`                          | `border-line`                | Every outline                                   |
| `brand`                         | `bg-brand`                   | The primary action, focus rings, selected state |
| `brand-soft`                    | `bg-brand-soft`              | Highlight fills, the mascot's background        |
| `butter` `soda` `grape` `peach` | `bg-butter` …                | Identity only (see rule 9)                      |
| `blush`                         | `fill-blush`                 | Cheeks on faces. Nowhere else.                  |
| `danger`                        | `bg-danger`, `border-danger` | Errors — always with words, never colour alone  |
| `success`                       | `bg-success`                 | Confirmations — always with words               |

Text on a coloured fill is always `text-ink`. Never white text on `brand` or a candy tone — the contrast fails.

### Type

| Utility        | Face         | Use it for                                          |
| -------------- | ------------ | --------------------------------------------------- |
| `text-hero`    | display      | One per page. The page's single biggest statement.  |
| `text-title`   | display      | Section headings                                    |
| `text-heading` | display/sans | Card titles, large buttons                          |
| `text-body`    | sans         | Everything you read                                 |
| `text-small`   | sans         | Hints, captions, metadata                           |
| `text-key`     | display      | Room keys, scores, countdowns — big glanceable data |

- Sentence case everywhere. No ALL-CAPS labels, no tracked-out small caps. The only uppercase text is a room key.
- Body line length stays under ~70 characters (`max-w-prose`).
- Do not emphasise a single word inside a headline with colour, italic or a highlight.

### Radius, shadow, motion

| Token              | Value                    | Use                                      |
| ------------------ | ------------------------ | ---------------------------------------- |
| `rounded-box`      | 8px                      | Checkboxes only                          |
| `rounded-input`    | 14px                     | Inputs, small wells                      |
| `rounded-card`     | 22px                     | Cards, bubbles                           |
| `rounded-sheet`    | 32px                     | Modals, bottom sheets, hero panels       |
| `rounded-pill`     | 999px                    | Buttons, chips, avatars (`rounded-full`) |
| `shadow-mochi-sm`  | 0 2px 0 ink              | Chips, bubbles, small pressables         |
| `shadow-mochi`     | 0 4px 0 ink              | Cards, buttons                           |
| `shadow-mochi-lg`  | 0 6px 0 ink              | One hero element per page, open sheets   |
| `squish` (utility) | hover lifts, press sinks | Anything pressable. Buttons have it.     |
| `ease-squish`      | overshoot curve          | Things that pop in or get pressed        |
| `ease-settle`      | no overshoot             | Things that move from A to B             |
| `ease-spring`      | soft overshoot           | A selection that slides into place       |
| `animate-pop`      | 420ms scale-in           | A win, a new player joining              |
| `animate-wobble`   | 520ms                    | A wrong answer, an invalid key           |
| `animate-blink`    | every 6s                 | The mascot's eyes. Only the mascot.      |

The full motion set is in [Motion](#motion).

Not every card needs a shadow. A shadow says "this is an object you can press or pick up". Static information inside a card sits flat.

---

## The primitives

Each primitive lives in `components/ui/`, has a colocated test, and renders on `/design`. Pick the primitive by its job.

| Primitive    | Use it for                                                          |
| ------------ | ------------------------------------------------------------------- |
| `Button`     | An action. `buttonStyles()` styles a `Link` the same way.           |
| `Card`       | One object the user can act on. `peek` puts a face over the edge.   |
| `Input`      | One line of text, with a label, a hint and an error.                |
| `Textarea`   | Several lines of text. Same label, hint and error as `Input`.       |
| `Select`     | One choice from a long list. It is a native select.                 |
| `RadioGroup` | One choice from five options or fewer.                              |
| `Checkbox`   | A yes/no value that a form submits later.                           |
| `Switch`     | A setting that applies at once.                                     |
| `Field`      | The label, hint and error. Use it to wrap a new form control.       |
| `Badge`      | A short state in words: "Host", "Ready". Not pressable.             |
| `Chip`       | A pill that names one thing, often with an `Avatar`. Not pressable. |
| `Alert`      | A message in the interface voice: a result, a problem, a status.    |
| `Progress`   | How far through something the user is. It shows the value in words. |
| `Spinner`    | Work that the user asked for and that is not complete yet.          |
| `EmptyState` | A space with no content yet. A sleepy face, one line, one action.   |
| `Skeleton`   | The shape of content that is loading. Use it as a loading fallback. |
| `Tabs`       | Two to five views of the same thing. A client component.            |
| `Dialog`     | A decision that must interrupt. A bottom sheet on a phone.          |
| `Avatar`     | A player. The name sets the colour and the mood.                    |
| `Face`       | The mascot face. See [Signature patterns](#signature-patterns).     |
| `Speech`     | The mascot speaks. Moments only.                                    |
| `Sticker`    | Decoration. Two per viewport at most.                               |

`components/layout/` holds the page chrome:

| Component    | Use it for                                                                       |
| ------------ | -------------------------------------------------------------------------------- |
| `PageShell`  | The page's `<main>`: width, gutter and rhythm.                                   |
| `AppBar`     | The top of an app screen: an on-screen back arrow, the title (`h1`), one action. |
| `BackButton` | The back arrow alone. It returns inside the app, or goes to a fallback page.     |
| `TabBar`     | The floating bottom bar with the top-level destinations. The root layout has it. |
| `Header`     | A website header: the mascot logo and the main links.                            |
| `Footer`     | The site footer.                                                                 |

**Behave like an app.** A user must never need the browser's back button. A screen below a tab has an `AppBar` with a back arrow. A focused task, such as sign-in, hides the `TabBar` (see `TABLESS_PATHS` in `lib/navigation.ts`). A step inside one screen, such as the OTP step, uses the back arrow to return to the step before it.

Status is never colour alone. `Alert` draws a glyph, `Checkbox` draws a tick, `RadioGroup` draws a dot, `Switch` moves its knob, and `Tabs` lifts the selected tab onto a base.

---

## Motion

Motion makes the app feel physical: a screen settles into place, a selection slides to where you tapped, a sheet rises from the bottom. Each movement answers something the user did. None of it costs load time.

### The rules

1. **CSS only.** No animation library, and no JavaScript that runs per frame. Motion adds no script to a page.
2. **Animate `transform` and `opacity` only.** The browser moves them on the GPU, without layout or paint. To animate a size, use `scaleX` or `scaleY`, as `Progress` does. Never animate `width`, `height`, `top` or `margin`.
3. **Never hide the first paint.** An animation that plays on page load starts from a visible state (`opacity` above 0). An element at `opacity: 0` does not count for Largest Contentful Paint, so it delays the metric until it appears.
4. **Use `backwards` fill on anything that wraps content.** A `transform` that stays after the animation turns the element into a containing block, and every `position: fixed` child inside it breaks.
5. **Short.** 200ms to 320ms for most motion. Up to 520ms for a win or an error.
6. **Reduced motion stops everything.** The base layer in `styles/globals.css` cuts every animation and transition to near zero. Do not override it.
7. **Answer at the press, not at the response.** A control moves when the user taps it, even when the result needs the network. `TabBar` slides its pill on the tap, before the next page arrives.
8. **Keep motion free, and keep the page light.** Motion adds no JavaScript. A large library still costs load time, so load it with `import()` when an action needs it. See `coding-standards.md` > React for the rules and the examples.

### The motion set

| Utility                                           | Where it plays                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `animate-page-enter`                              | Every navigation. `app/template.tsx` wraps each page in it.           |
| `animate-slide-in-next` / `animate-slide-in-back` | A step change inside one screen, such as the sign-in steps.           |
| `animate-rise-in`                                 | Something that appears because of an action: `Alert`, a field error.  |
| `animate-fade-in`                                 | A panel that replaces another: the `Tabs` panel.                      |
| `animate-check`                                   | A tick, a radio dot or a tab icon that turns on.                      |
| `animate-wobble`                                  | A field that has an error. It plays once, when the error appears.     |
| `animate-pop`                                     | A win, a new player joining.                                          |
| `animate-breathe`                                 | A `Skeleton` while content loads.                                     |
| `sheet-motion`                                    | `Dialog`: rises in, sinks out, and the backdrop fades.                |
| `press`                                           | A pressable thing with no base: a tab. Never together with `squish`.  |
| A sliding pill                                    | The selection in `Tabs` and `TabBar`. `transform` with `ease-spring`. |

### Loading

A dynamic page that reads data shows a loading state at once on navigation, so a tap never waits on the server with no answer. Use `Skeleton` in the shape of the page. `coding-standards.md` says when to use `loading.tsx` and when to use an inner `<Suspense>`. The fallback in `app/profile/page.tsx` is the example.

---

## Themes and the cute budget

A product sets its theme once, with `THEME` in `app/layout.tsx`. The theme re-assigns tokens; components do not change.

| Theme      | For                                            | Cute budget                                                                    |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `playroom` | Party games, social, anything fun              | **High** — faces on every player, mascot on every key moment, stickers allowed |
| `calm`     | Wellness, habits, focus, utilities             | **Medium** — mascot on empty states and completions only, no stickers          |
| `night`    | Dark products: map trackers, gaming companions | **Low** — mascot on loading, empty and error states only; faces on avatars     |

Products with a formal or ceremonial tone (a wedding site, a legal page, a portfolio for employers) do **not** use Mochi. They use the same structure tokens (spacing, radius, type scale discipline) with their own palette and type. Say so in that project's `CLAUDE.md`.

Budget limits per viewport, all themes:

- One `peek` card.
- One `Speech` bubble.
- Two `Sticker`s (zero in `calm` and `night`).
- One `shadow-mochi-lg` element.

---

## Signature patterns

These make Mochi recognisable. Use them; do not invent new decorative devices.

**The face.** `<Face mood="happy" />`. Two dot eyes, a small mouth, blush. Moods: `happy`, `wow`, `wink`, `sleepy`, `sad`. Pick the mood from the situation: `wow` for a win, `sad` for an error, `sleepy` for an empty or idle state.

**The peek.** `<Card peek={<Avatar name={player} size="lg" />}>`. A face sits over the top edge of a card, as if it is looking in. Use it for the one card that matters most on the screen — the join form, the winner, the current player.

**The squish.** Every pressable surface uses the `squish` utility. On press it sinks 3px onto its base. Never change the distance or add a scale effect on top.

**The moment.** When the user achieves something (joins, wins, completes), the screen reacts once: `animate-pop` on the result, the mascot changes mood, maybe one `Speech` line. Then it is quiet again.

**Generated avatars.** `<Avatar name="momo" />` derives colour and mood from the name. Never use letter initials in circles. Never use random avatars that change between renders.

---

## Layout

- **Left-aligned** text and forms. Centre only a room key, a single score, or a lone empty-state message.
- **Show the product first.** The hero shows the real thing working — a board, a map, the key entry — not a description of it. On a party game, the first viewport contains the key input.
- **Vertical rhythm.** Sections are separated by `gap-16` (mobile) to `gap-24` (desktop). Inside a card, `gap-4`.
- **No card grids for the sake of it.** Three identical cards in a row is not a layout. Use cards only when each one is a distinct object the user can act on (a game, a player, a room).
- **Page width** `max-w-3xl` for reading and forms, `max-w-5xl` for boards and maps. Padding `px-5` mobile, `sm:px-8`.

---

## Words

The interface speaks plainly. The mascot speaks warmly. Keep the two voices separate.

**Interface voice** (headings, buttons, labels, hints, errors):

- Say what the thing is or does, in the user's words. "Join with a key", not "Enter lobby credentials".
- Buttons are verb phrases that name the result: "Create room", "Start round", "Save nickname". The same action keeps the same name everywhere — the button "Create room" produces the toast "Room created".
- Errors say what happened and how to fix it: "Keys are 6 letters or numbers." No apologies, no "Oops".
- Sentence case. No trailing arrows (`→`) on buttons or links. No emoji in interface text.

**Mascot voice** (only inside `Speech`):

- One line, under ~12 words, present tense, reacting to what just happened. "momo joined. That makes five of you."
- It never gives instructions that the interface needs. If the user must read it to proceed, it belongs in the interface voice.

**Banned** — these read as generated copy. Rewrite any sentence that uses them:

- Rule-of-three slogans: "No login. No download. Just a key." / "Big group, one key, zero setup."
- Words: seamless, effortless, unleash, elevate, supercharge, magic, vibe, delightful, curated, next-level, game-changer, "in seconds".
- Meta strings joined with middle dots: "2–20 players · 10 min". Write "For 2 to 20 players, about 10 minutes" or show the numbers as separate labelled facts.
- Fake content: invented testimonials, invented user counts, "Trusted by …", a diverse-sounding set of made-up full names. Example players use nicknames people actually type (`momo`, `captain_k`, `rajma chawal`).

---

## The anti-slop list

If your output contains any of these, remove it before you report the task as done. Each one is a default that generated UIs produce whatever the subject.

- An ALL-CAPS tracked-out label above a heading ("LIVE", "UP TO 20 PLAYERS", "FEATURES").
- Numbered `01 / 02 / 03` markers on content that is not a real sequence.
- A "How it works" section of three equal cards as the default second section.
- Cream background with a terracotta or clay accent. Near-black with an acid-green accent.
- Soft grey blurred shadows, glassmorphism, gradient blobs, gradient text, noise textures.
- Identical border radius and shadow on every element.
- Icons from a generic set placed in coloured circles above feature text.
- A monospace face for small labels.
- Section entrances that fade and slide up on scroll.
- Repeating the primary CTA in every section. Once in the hero, once at the end, at most.
- A static "example" of the product where a live, interactive one is possible.
- Placeholder text used as a label.

---

## Accessibility floor

This is the minimum, not a goal.

- Text contrast ≥ 4.5:1. All documented pairs pass; `text-ink-soft` is for secondary text on `paper` or `surface` only.
- Visible focus on everything interactive (the base styles give a 3px `brand` ring — do not remove it).
- Colour never carries meaning alone. Errors have words. Selected states have an outline change or a check, not only a fill.
- `prefers-reduced-motion` is respected globally. Do not override it.
- Faces are decorative (`aria-hidden`) unless they are the only content; then pass `label`.
- Every input has a visible `label`.

---

## Recipes

**Party-game landing page (first viewport, 390px wide):**

```
┌──────────────────────────────┐
│ ◉ Playroom          Games    │  logo = mascot face, not a letter
│                              │
│ Bingo for your group chat    │  text-hero, left aligned
│                              │
│ ┌─(face peeks)─────────────┐ │
│ │ Room key                 │ │  Card peek + Input code
│ │ [ P L Z 4 K 9 ]          │ │
│ │ [ Join game            ] │ │  the one primary
│ └──────────────────────────┘ │
│ Hosting? Create a room       │  Button quiet
└──────────────────────────────┘
```

Below the fold: a live, playable mini board. Then the list of games as distinct cards, each with its own candy tone.

**Empty state:** a `Face mood="sleepy"` at 72px, one line of interface voice saying what goes here, one button that fills it. "No rounds yet. Start round".

**Error state:** `Speech mood="sad"` with the cause and the fix, plus the action as a `Button`. `animate-wobble` on the field that caused it.

**Win state:** the result in `text-key` with `animate-pop`, the winner's `Avatar` as a peek, the mascot's `wow` face, one `Speech` line, one or two `Sticker`s (playroom only).

---

## Enforcement

Rules 2 to 6 are lint checks, not reminders. The `template/design-language` block in `eslint.config.mjs` reads every `className` — the string form, the strings passed to `cn()`, and template literals — and fails the build on:

| Refused in a `className`                                                 | Rule |
| ------------------------------------------------------------------------ | ---- |
| A raw hex value, or an arbitrary `bg-[…]` / `shadow-[…]` / `rounded-[…]` | 2    |
| A default Tailwind colour: `text-gray-500`, `bg-white`, `border-black`   | 3, 9 |
| A 1px `border`, or `border-4` and wider                                  | 4    |
| A blurred shadow: bare `shadow`, `shadow-sm`, `shadow-lg`                | 5    |
| A default radius: `rounded-md`, `rounded-xl`                             | 6    |
| A size outside the scale: `text-sm`, `text-2xl`                          | Type |

Each message names the rule it enforces. To step outside one, say why on the line: `// eslint-disable-next-line no-restricted-syntax -- reason`. A bare disable is a defect.

Two limits to know:

- The checks read literal strings. A class name built at runtime from a variable escapes them.
- They read `className` only. An SVG `fill` attribute is not a class name, which is why the white specular dot in `Face.tsx` is a literal `#fff` — it is a highlight on an ink pupil, not a theme colour, and it stays white in every theme.

Everything else on this page — one primary action, the cute budget, the words, the anti-slop list — is a human judgement. No check replaces looking at the screen.

---

## Before you report UI work as done

Check each item. Do not skip the last one.

1. It works at 320px and at desktop width. No horizontal scroll.
2. One primary button per viewport.
3. `pnpm validate` is green. It fails on the token rules above, so a clean run means the diff carries no raw hex, arbitrary value, or default Tailwind colour, size, radius or shadow.
4. Nothing from the anti-slop list or the banned words.
5. Budgets respected: peek, speech, stickers, large shadow.
6. Every new or changed primitive appears on `/design` and has a colocated `<Name>.test.tsx`.
7. **Remove one thing.** Look at the screen and take away the least necessary decoration. Then check again.
