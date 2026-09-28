import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';
import { PWA_ICONS, THEME_COLOR } from '@/lib/pwa';

/**
 * The web app manifest, served at `/manifest.webmanifest` and linked from
 * every page. It makes the phone posture installable: "Add to Home Screen"
 * opens the app full screen, with no browser bar, like a native app.
 *
 * There is no service worker, on purpose. A cache in the browser keeps
 * serving the old build after a deploy, the same failure as trap 26 in a CDN.
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: env.appName,
    short_name: env.appName,
    description: 'Production-ready Next.js App Router template deployed on Google Cloud Run.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: PWA_ICONS.map((icon) => ({ ...icon })),
  };
}
