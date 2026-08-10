import eslint from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**'] },
  eslint.configs.recommended,
  {
    files: ['src/**/*.mjs', 'scripts/**/*.mjs', 'test/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];
