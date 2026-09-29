import { expect, test } from '@playwright/test';

/**
 * Smoke tests: the built app serves, and keeps its site-wide promises.
 *
 * Assertions are about structure, not copy, so they survive the home page
 * being replaced. They need no cloud account: nothing here reads Firestore or
 * Cloud Storage, and sign-in is unconfigured, which is the fail-closed state.
 */

test('the home page renders with a title and exactly one h1', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toBeVisible();
});

test('the page never scrolls sideways', async ({ page }) => {
  for (const path of ['/', '/design', '/sign-in']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test('an unknown URL answers 404 with the not-found page', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
});

test('every response carries the security headers', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('the health endpoint answers ok and is never cached', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toMatchObject({ status: 'ok' });
});

test('a write without a session is refused with 401', async ({ request }) => {
  const response = await request.patch('/api/profile', { data: { displayName: 'Mallory' } });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: 'unauthenticated' });
});
