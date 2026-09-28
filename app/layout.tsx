import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TabBar } from '@/components/layout/TabBar';
import { env } from '@/lib/env';
import { THEME_COLOR } from '@/lib/pwa';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: env.appName,
    template: `%s | ${env.appName}`,
  },
  description: 'Production-ready Next.js App Router template deployed on Google Cloud Run.',
  applicationName: env.appName,
  // iOS reads these, not the manifest, when the user adds the app to the home
  // screen. The manifest in app/manifest.ts serves every other browser.
  appleWebApp: { capable: true, title: env.appName, statusBarStyle: 'default' },
  robots: {
    // Deployed previews should not be indexed. Flip this on for the real site.
    index: env.isProduction,
    follow: env.isProduction,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the page draw under a phone's notch and home indicator, so TabBar can
  // pad itself with env(safe-area-inset-bottom) like a native nav bar.
  viewportFit: 'cover',
  // Matches --color-paper for the active theme. See lib/pwa.ts.
  themeColor: THEME_COLOR,
};

/**
 * Mochi typefaces, self-hosted from public/fonts (Latin subsets, ~72 KB total).
 * Self-hosting means the build never calls Google Fonts, so the Docker build
 * works offline. See .github/instructions/design-language.md, "Type".
 */
const mochiy = localFont({
  src: '../public/fonts/mochiypopone-400.woff2',
  weight: '400',
  variable: '--font-mochiy',
  display: 'swap',
});

const zenMaru = localFont({
  src: [
    { path: '../public/fonts/zenmarugothic-400.woff2', weight: '400' },
    { path: '../public/fonts/zenmarugothic-500.woff2', weight: '500' },
    { path: '../public/fonts/zenmarugothic-700.woff2', weight: '700' },
  ],
  variable: '--font-zen-maru',
  display: 'swap',
});

/**
 * The product theme. 'playroom' is the default token set; 'calm' and 'night'
 * re-assign tokens in styles/globals.css. Set once per product, here only.
 */
const THEME: 'playroom' | 'calm' | 'night' = 'playroom';

/**
 * Root layout — a Server Component, and it must stay one.
 *
 * Adding `'use client'` here would turn the entire application into a client
 * bundle. Providers that need client state belong in their own
 * `'use client'` component rendered from here as a child.
 *
 * It holds the two postures of the shell. A phone gets an app: the `TabBar`
 * at the bottom. From `md` up the same destinations move to the `SiteHeader`
 * at the top, and the page reads as a website. Both are CSS breakpoints, so
 * the server sends one HTML for every screen and nothing guesses the device.
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={THEME}
      className={`${mochiy.variable} ${zenMaru.variable}`}
      suppressHydrationWarning
    >
      {/*
        pb-28 keeps the last line of every page clear of the floating TabBar,
        on a phone only: from md up the TabBar hides. The flex column lets a
        short page push the footer to the bottom of the screen. SiteHeader and
        TabBar are client components rendered from this Server Component, so
        the layout itself stays server-only.
      */}
      <body className="flex min-h-dvh flex-col pb-28 antialiased md:pb-0">
        <SiteHeader appName={env.appName} />
        {children}
        <Footer
          owner={env.appName}
          links={[
            { href: '/design', label: 'Components' },
            { href: '/api/health', label: 'Health' },
          ]}
        />
        <TabBar />
      </body>
    </html>
  );
}
