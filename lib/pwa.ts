/**
 * The installed app: its colour and its icons. Pure data, shared by
 * `app/layout.tsx` (the browser's theme colour) and `app/manifest.ts` (what a
 * phone uses when the user adds the app to the home screen).
 *
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 */

/**
 * The browser chrome and the splash screen colour. It matches `--color-paper`
 * for the active theme in `styles/globals.css`; `tests/site-checklist.test.ts`
 * fails when the two differ. Change both together.
 */
export const THEME_COLOR = '#fff7fa';

/**
 * PNG icons in `public/icons/`, drawn from `app/icon.svg`. `any` icons keep
 * their own shape. The `maskable` icon fills the square, with the face inside
 * the centre 80%, so Android can cut it to a circle or a squircle.
 */
export const PWA_ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const;
