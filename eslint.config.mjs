import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

/**
 * Flat ESLint config.
 *
 * Layering, in order:
 *   1. Next.js core-web-vitals  - framework + accessibility + performance rules
 *   2. Next.js typescript       - typescript-eslint recommended, wired for Next
 *   3. Repository rules         - the conventions in .github/instructions/
 *   4. Architecture boundaries  - the layer rules in architecture.md, enforced
 *   5. eslint-config-prettier   - LAST, disables every stylistic rule so
 *                                 Prettier owns formatting without conflicts
 *
 * Every rule below that is not a general best practice names the document it
 * enforces. A rule nobody can trace back to a written decision gets deleted by
 * the next person who finds it inconvenient.
 */

/**
 * Import restrictions that apply in every layer.
 *
 * `no-restricted-imports` options do NOT merge across config objects — the last
 * matching block wins outright. So each boundary block below spreads this list
 * rather than relying on an earlier block to still apply.
 */
const forbiddenEverywhere = [
  {
    group: ['..', '../**'],
    message:
      'Import through the `@/*` alias, not a parent-relative path: `@/lib/env`, never `../../../lib/env`. See CLAUDE.md > Where files go.',
  },
  {
    group: ['@/utils/**', '@/helpers/**', '@/src/**', '@/api/**', '@/common/**', '@/shared/**'],
    message:
      'That top-level folder does not exist and must not be created. Nest inside app/, components/, hooks/, lib/, services/ or types/. See coding-rules.md rule 1.',
  },
];

/** `app/` composes the layers below it, so nothing below may import back into it. */
const noImportingApp = {
  group: ['@/app/**'],
  message:
    'Dependencies point inward. Nothing below `app/` may import from it. Move the shared code down into lib/, services/ or types/. See architecture.md > Layers.',
};

/**
 * The Mochi design language, enforced.
 *
 * Every rule here is written in .github/instructions/design-language.md. The
 * checks look inside `className` — both the string form and the strings passed
 * to `cn()` or interpolated in a template literal — because that is where an
 * off-system value actually reaches the browser.
 *
 * They cannot see a class name built at runtime from a variable. That case, and
 * the judgement calls (one primary button, the cute budget, the anti-slop list),
 * stay with the reviewer.
 *
 * To step outside a rule, say why on the line:
 *   // eslint-disable-next-line no-restricted-syntax -- the speech tail needs a
 *   // smaller corner on one side only.
 *
 * `no-restricted-syntax` options do NOT merge across config objects — the last
 * matching block wins outright. Every later block that sets the rule spreads
 * this list, or the design checks silently stop applying to those files.
 */
const DESIGN = {
  /** Matches a class name at a word start, after whitespace or a `sm:`/`hover:` prefix. */
  head: '(^|\\s|:)',
  /** Matches the end of a class name, allowing an `/70` opacity modifier. */
  tail: '([\\s/]|$)',
};

const designTokenSelectors = [
  {
    pattern: `(#[0-9a-fA-F]{3,8}|${DESIGN.head}(shadow|rounded|bg|text|border|fill|stroke|ring|outline|from|via|to)-\\[)`,
    message:
      'No raw hex and no arbitrary value in a className. Use a token from styles/globals.css. If the value you need does not exist, add the token and say why. See design-language.md rule 2.',
  },
  {
    pattern: `${DESIGN.head}(bg|text|border|fill|stroke|ring|decoration|outline|divide|accent|caret|from|via|to)-(black|white|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\\d{2,3})?${DESIGN.tail}`,
    message:
      'That is a default Tailwind colour, not a Mochi one. Text and outlines use `ink` and `line` — never black, white or a grey. Fills use `paper`, `surface`, `sunken`, `brand` or a candy tone. See design-language.md rules 3 and 9.',
  },
  {
    pattern: `${DESIGN.head}text-(xs|sm|base|lg|xl|[2-9]xl)${DESIGN.tail}`,
    message:
      'Only six text sizes exist: `text-hero`, `text-title`, `text-heading`, `text-body`, `text-small`, `text-key`. See design-language.md > Type.',
  },
  {
    pattern: `${DESIGN.head}border(-[0148])?${DESIGN.tail}`,
    message:
      'Outlines are 2px: `border-2 border-line`. Never a 1px hairline, never 4px or more. See design-language.md rule 4.',
  },
  {
    pattern: `${DESIGN.head}shadow(-(2xs|xs|sm|md|lg|xl|2xl|inner|none))?${DESIGN.tail}`,
    message:
      'Shadows are hard and straight down: `shadow-mochi-sm`, `shadow-mochi`, `shadow-mochi-lg`. A blurred grey shadow is not part of this language. See design-language.md rule 5.',
  },
  {
    pattern: `${DESIGN.head}rounded-(none|xs|sm|md|lg|xl|[2-4]xl)${DESIGN.tail}`,
    message:
      'Radius follows the hierarchy: `rounded-input`, `rounded-card`, `rounded-sheet`, `rounded-pill`, `rounded-full`. See design-language.md rule 6.',
  },
].flatMap(({ pattern, message }) => [
  { selector: `JSXAttribute[name.name='className'] Literal[value=/${pattern}/]`, message },
  {
    selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${pattern}/]`,
    message,
  },
]);

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: 'template/rules',
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      // Deterministic import order. Auto-fixable with `pnpm lint:fix`.
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Unused code is dead weight; `_`-prefixed args are an explicit opt-out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // `any` erases the guarantees the strict tsconfig is buying us.
      '@typescript-eslint/no-explicit-any': 'error',

      // Prefer `import type` so type-only imports are erased at compile time.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Server logs belong in a structured logger, not stdout noise.
      // `console.warn`/`console.error` stay allowed for genuine failures.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Catch `==`, implicit globals and other classic footguns.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],

      // A `debugger` statement that reaches the image stops the container on
      // an attached inspector. The Next config does not extend eslint's
      // recommended set, so this is not on by default.
      'no-debugger': 'error',

      // An empty `catch {}` turns a failure into silence. Handle the error
      // path or rethrow. See coding-rules.md rule 6.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Configuration is read once, validated once, in `lib/env.ts`. A direct
      // read elsewhere is untyped, unvalidated, and skips startup validation.
      // See CLAUDE.md > Never do this.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration from `@/lib/env`, never `process.env` directly. Declare the variable in lib/env.ts, .env.example, deploy.yml and cloud/environment-variables.md.',
        },
      ],

      'no-restricted-imports': ['error', { patterns: forbiddenEverywhere }],
    },
  },

  {
    // Architecture boundaries, from architecture.md > Layers.
    // Allowed:   app/ -> components/ -> lib/   and   app/ -> services/ -> lib/
    // Forbidden: lib/ -> services/, components/ui/ -> services/, anything -> app/
    name: 'template/boundaries/below-app',
    files: ['components/**', 'hooks/**', 'services/**', 'lib/**', 'types/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...forbiddenEverywhere, noImportingApp] }],
    },
  },

  {
    name: 'template/boundaries/lib-is-pure',
    files: ['lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbiddenEverywhere,
            noImportingApp,
            {
              group: ['@/services/**', '@/components/**', '@/hooks/**'],
              message:
                '`lib/` is the bottom layer: pure utilities, config and logging, with no I/O and no React. Anything that calls an external system belongs in `services/`. See architecture.md > Layers.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'template/boundaries/ui-is-presentational',
    files: ['components/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbiddenEverywhere,
            noImportingApp,
            {
              group: ['@/services/**'],
              message:
                '`components/ui/` takes data as props and does no fetching. Fetch in the route or a feature component and pass the result down. See coding-rules.md rule 5.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'template/boundaries/services-have-no-ui',
    files: ['services/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbiddenEverywhere,
            noImportingApp,
            {
              group: ['@/components/**', '@/hooks/**'],
              message:
                '`services/` is external I/O only. It must stay replaceable (REST -> gRPC, one vendor -> another) without touching a component. See architecture.md > Layers.',
            },
          ],
        },
      ],
    },
  },

  {
    // The visual rules of .github/instructions/design-language.md. UI that
    // ignores the tokens is the fastest way for a product built from this
    // template to stop looking like the design system it inherited.
    name: 'template/design-language',
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...designTokenSelectors],
    },
  },

  {
    // Rule 4: `'use client'` here turns the entire application into a client
    // bundle. It is the single most expensive one-line mistake in the repo.
    name: 'template/root-layout-stays-server',
    files: ['app/layout.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...designTokenSelectors,
        {
          selector: "ExpressionStatement[directive='use client']",
          message:
            "Never put 'use client' in the root layout — it makes every component below it client code. Push the directive down to the interactive leaf instead. See coding-rules.md rule 4.",
        },
      ],
    },
  },

  {
    // Rule 6: every outbound call gets a timeout. A `fetch` with no `signal`
    // inherits no deadline, so one slow dependency holds a Cloud Run request
    // open until the platform kills it.
    //
    // The check looks for a `signal` property anywhere in the call. It cannot
    // see through an options object built elsewhere — pass the signal at the
    // call site, or disable the rule on the line with a reason.
    name: 'template/outbound-calls-time-out',
    files: ['services/**', 'app/api/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...designTokenSelectors,
        {
          selector: "CallExpression[callee.name='fetch']:not(:has(Property[key.name='signal']))",
          message:
            'Give every outbound `fetch` a timeout: `fetch(url, { signal: AbortSignal.timeout(5000) })`. See coding-rules.md rule 6.',
        },
      ],
    },
  },

  {
    name: 'template/config-and-scripts',
    files: ['*.config.{ts,mjs,js}', 'scripts/**', 'tests/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      // Build and test tooling runs outside the application, before and around
      // `lib/env.ts`, so it reads the raw environment.
      'no-restricted-properties': 'off',
    },
  },

  {
    name: 'template/env-is-the-one-reader',
    files: ['lib/env.ts'],
    rules: {
      // This file is the single, deliberate reader of `process.env`. Every
      // other read is a defect — see the block above.
      'no-restricted-properties': 'off',
    },
  },

  prettier,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'pnpm-lock.yaml',
  ]),
]);
