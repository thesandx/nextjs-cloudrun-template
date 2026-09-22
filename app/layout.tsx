import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { env } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: env.appName,
    template: `%s | ${env.appName}`,
  },
  description: 'Production-ready Next.js App Router template deployed on Google Cloud Run.',
  robots: {
    // Deployed previews should not be indexed. Flip this on for the real site.
    index: env.isProduction,
    follow: env.isProduction,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches --color-paper for the active theme. Change both together.
  themeColor: '#fff7fa',
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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
