// @vitest-environment node
/**
 * The site checklist in design-language.md, as checks. It reads the source,
 * not a running server, so it runs inside `pnpm validate` with no build.
 *
 * Each check names the checklist item it enforces. A failure lists every
 * offending file, so one run shows the whole list.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string, match: (path: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, match);
    return match(path) ? [path] : [];
  });
}

const rel = (path: string): string => relative(ROOT, path).split(sep).join('/');

/** Source that renders UI: pages, layouts and components, without tests. */
const UI_SOURCE = ['app', 'components'].flatMap((dir) =>
  walk(join(ROOT, dir), (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)),
);

/** Every `page.tsx`, as the URL path it serves. Route groups `(x)` add no segment. */
const PAGES = walk(join(ROOT, 'app'), (path) => path.endsWith(`${sep}page.tsx`)).map((file) => {
  const segments = rel(file)
    .split('/')
    .slice(1, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));
  return { file, route: `/${segments.join('/')}` };
});

/** Every `route.ts` under app/, as the URL path it serves. */
const ROUTE_HANDLERS = walk(join(ROOT, 'app'), (path) => path.endsWith(`${sep}route.ts`)).map(
  (file) => `/${rel(file).split('/').slice(1, -1).join('/')}`,
);

function routeExists(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? '';
  const known = [...PAGES.map((page) => page.route), ...ROUTE_HANDLERS];
  return known.some((route) => {
    const pattern = route.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+');
    return new RegExp(`^${pattern}/?$`).test(pathname);
  });
}

/** Internal paths in `href="/…"`, `href: '/…'` and `href={'/…'}`. Template literals are skipped. */
function internalHrefs(source: string): string[] {
  const found = source.matchAll(/href(?:=\{?|:\s*)['"](\/[^'"]*)['"]/g);
  return [...found].map((match) => match[1] ?? '').filter((href) => !href.startsWith('//'));
}

describe('site checklist', () => {
  it('has no broken internal links', () => {
    const broken = UI_SOURCE.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return internalHrefs(source)
        .filter((href) => !routeExists(href))
        .map((href) => `${rel(file)} → ${href}`);
    });
    const tabs = readFileSync(join(ROOT, 'lib/navigation.ts'), 'utf8');
    const brokenTabs = internalHrefs(tabs)
      .filter((href) => !routeExists(href))
      .map((href) => `lib/navigation.ts → ${href}`);
    expect([...broken, ...brokenTabs]).toEqual([]);
  });

  it('has no dead link or button target: no href="#", no empty href, no javascript:', () => {
    const offenders = UI_SOURCE.filter((file) =>
      /href=(?:\{)?['"](?:#|javascript:[^'"]*)?['"]/.test(readFileSync(file, 'utf8')),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('gives every page its own title and meta description', () => {
    const missing = PAGES.filter(({ file, route }) => {
      const source = readFileSync(file, 'utf8');
      if (source.includes('generateMetadata')) return false;
      // The home page may take its title from the layout's default.
      const hasTitle = route === '/' || /\btitle:/.test(source);
      return !(
        source.includes('export const metadata') &&
        hasTitle &&
        /\bdescription:/.test(source)
      );
    }).map(({ file }) => rel(file));
    expect(missing).toEqual([]);
  });

  it('has a custom 404 page with its own title', () => {
    const notFound = readFileSync(join(ROOT, 'app/not-found.tsx'), 'utf8');
    expect(notFound).toMatch(/title:/);
    expect(notFound).toMatch(/href="\/"/);
  });

  it('has a favicon', () => {
    const icons = readdirSync(join(ROOT, 'app')).filter((name) =>
      /^(icon|favicon)\.(svg|ico|png)$/.test(name),
    );
    expect(icons.length).toBeGreaterThan(0);
  });

  it('ships no placeholder text', () => {
    const PLACEHOLDER =
      /lorem ipsum|dolor sit amet|\bTODO\b|\bFIXME\b|\bTBD\b|coming soon|your text here|example\.com/i;
    const offenders = UI_SOURCE.filter((file) => PLACEHOLDER.test(readFileSync(file, 'utf8'))).map(
      rel,
    );
    expect(offenders).toEqual([]);
  });

  it('never hardcodes a copyright year', () => {
    const offenders = UI_SOURCE.filter((file) =>
      /(?:©|&copy;|copyright)\s*(?:\d{4})/i.test(readFileSync(file, 'utf8')),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('keeps every image in public/ under 200 KB', () => {
    const LIMIT = 200 * 1024;
    const heavy = walk(join(ROOT, 'public'), (path) =>
      /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(path),
    )
      .filter((path) => statSync(path).size > LIMIT)
      .map((path) => `${rel(path)} (${Math.round(statSync(path).size / 1024)} KB)`);
    expect(heavy).toEqual([]);
  });

  it('prints no phone number or email address as plain text', () => {
    // A tel:/mailto: link or ContactLink is fine; a bare value in JSX text is not.
    const offenders = UI_SOURCE.filter((file) =>
      />[^<{]*(?:[\w.+-]+@[\w-]+\.[\w.]+|\+\d[\d\s-]{7,}\d)[^<]*</.test(readFileSync(file, 'utf8')),
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});
