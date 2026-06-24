// Flat ESLint config for Next.js 16 + ESLint 9.
//
// `next lint` was removed in Next 16, so we run ESLint directly. This reuses
// the already-installed `eslint-config-next` "core-web-vitals" preset (React,
// react-hooks, a11y, and Next correctness rules) via FlatCompat, plus a small
// TypeScript block for unused-var detection — no new packages required.
// Strictness is intentionally moderate: correctness rules stay as errors;
// style-only rules are warnings so the linter is usable on the existing
// codebase without forcing a large refactor (see Phase 0 audit).

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'next-env.d.ts',
      'netlify/**',
      'public/**',
      'supabase/**',
      'eslint.config.mjs',
      'next.config.*',
      'postcss.config.*',
      'tailwind.config.*',
      'sentry.*.config.*',
      'instrumentation*.ts',
    ],
  },

  // Next + React + a11y correctness (via the maintained preset).
  ...compat.config({
    extends: ['next/core-web-vitals'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Style-only rules → warnings (surface for cleanup, never block).
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  }),

  // TypeScript: catch unused vars/imports (the dead-code class that
  // app-layer-only security is most vulnerable to). Underscore-prefixed
  // names are intentionally ignored.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
]
