import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // The engine must stay pure and deterministic: the same seed and orders
  // must always produce the same world, in the browser and on the server.
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in rng.ts.' },
        { object: 'Date', property: 'now', message: 'Ticks are the only clock in the engine.' },
        {
          object: 'performance',
          property: 'now',
          message: 'Ticks are the only clock in the engine.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'The engine must not depend on the browser.' },
        { name: 'document', message: 'The engine must not depend on the browser.' },
        { name: 'process', message: 'The engine must not depend on Node.' },
        { name: 'fetch', message: 'The engine must not do I/O.' },
        { name: 'setTimeout', message: 'Ticks are the only clock in the engine.' },
        { name: 'setInterval', message: 'Ticks are the only clock in the engine.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Ticks are the only clock in the engine.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'The engine must not depend on Node.' },
            { group: ['**/apps/**'], message: 'The engine must not depend on apps.' },
          ],
        },
      ],
    },
  },
);
