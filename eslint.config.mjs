import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const sourceFiles = ['packages/**/*.{ts,tsx}'];
const scriptFiles = ['scripts/*.mjs'];

export default tseslint.config(
  { ignores: ['**/dist/**'] },
  { ...eslint.configs.recommended, files: sourceFiles },
  {
    ...eslint.configs.recommended,
    files: scriptFiles,
    languageOptions: {
      globals: {
        console: 'readonly',
        decodeURIComponent: 'readonly',
        encodeURIComponent: 'readonly',
        process: 'readonly',
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: sourceFiles })),
  {
    files: sourceFiles,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Empty prop extensions preserve named interfaces in generated declarations.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
