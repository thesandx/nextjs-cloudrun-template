import type { NextConfig } from 'next';

/**
 * Next.js configuration.
 *
 * `output: 'standalone'` is the single most important setting in this file:
 * it makes `next build` emit `.next/standalone`, a self-contained server that
 * bundles only the `node_modules` actually reachable at runtime. The Docker
 * runtime stage copies that folder instead of the full dependency tree, which
 * is what keeps the production image small (see `Dockerfile`).
 *
 * Do not remove it without also rewriting the Dockerfile.
 */
const nextConfig: NextConfig = {
  output: 'standalone',

  // Fail the production build on type errors. This is the default; it is
  // spelled out so nobody "temporarily" flips it to unblock a deploy.
  // (Next.js 16 removed the `eslint` config key along with `next lint` —
  // linting runs as its own CI step via `pnpm lint`.)
  typescript: { ignoreBuildErrors: false },

  // Drops the `X-Powered-By: Next.js` header, which tells a scanner which
  // framework to try first and tells a user nothing.
  poweredByHeader: false,
  reactStrictMode: true,

  // Emitted on every response. Tightened here rather than in middleware so the
  // headers apply to static assets too.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
