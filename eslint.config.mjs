import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { config, configs } from 'typescript-eslint';

export default config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'packages/docs/.astro/**'],
  },
  js.configs.recommended,
  ...configs.strictTypeChecked,
  ...configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: ['tsconfig.json', 'packages/*/tsconfig.json'],
        }),
      ],
    },
    rules: {
      'import-x/prefer-default-export': 'off',
      'import-x/no-rename-default': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [
            { pattern: 'branchly', group: 'external', position: 'after' },
            { pattern: '@branchly/**', group: 'external', position: 'after' },
            { pattern: '@/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['type'],
          distinctGroup: true,
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            orderImportKind: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [configs.disableTypeChecked],
  },
  {
    files: ['packages/docs/**/*.ts'],
    extends: [configs.disableTypeChecked],
    settings: {
      'import-x/core-modules': ['astro:content'],
    },
  },
  eslintPluginPrettierRecommended,
);
