import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/** ESLint flat config: Next.js rules + TypeScript rules; Prettier handles formatting. */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    // The hexagonal boundary. src/core holds the domain rules (grading, mastery,
    // scheduling, progress) and must stay free of React, Next, Node and browser APIs,
    // so it can be tested in isolation and ported to Swift against shared fixtures.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*'],
              message: 'src/core is framework-free.',
            },
            {
              group: ['node:*', 'fs', 'path', 'crypto'],
              message: 'src/core has no Node access. Use a port.',
            },
            {
              group: ['@/features/*', '@/adapters/*', '@/app/*', '@/lib/*', '@/components/*'],
              message:
                'src/core depends on nothing outside itself. Define a port in src/core/ports.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'indexedDB',
        'fetch',
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      'out/**',
      'node_modules/**',
      'next-env.d.ts',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'content/**',
      'ios/**',
      'practice/**',
      // Agent worktrees are full checkouts of this repo.
      '.claude/**',
    ],
  },
  {
    // zod only through src/core/zod.ts: zod's own `z` namespace carries every locale, and
    // Turbopack cannot shake it, so a direct import puts them on every page.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/zod.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: "Import zod as `import * as z from '@/core/zod'`." }],
          patterns: [
            { group: ['zod/*'], message: "Import zod as `import * as z from '@/core/zod'`." },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
