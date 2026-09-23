/**
 * Stub for the `server-only` package, aliased in `vitest.config.ts`.
 *
 * `import 'server-only'` is a build-time guard: the real package resolves to a
 * module that throws unless the bundler picked its `react-server` export, which
 * is how a Server Component module makes it a hard error for a Client Component
 * to import it. Vitest is not that bundler, so outside Next.js the real package
 * throws for every test that touches `services/`.
 *
 * Replacing it here removes the guard from the test run only. The guard still
 * does its job in `next build`, which is the build that ships.
 */
export {};
