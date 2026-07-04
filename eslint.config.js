import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['legacy/**', 'dist/**', 'node_modules/**', 'docs/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The legacy app's dead buttons came from data-callback string dispatch
      // and window-event wiring. Ban both in the rebuilt source forever.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='data-callback']",
          message:
            'data-callback string dispatch is banned. Wire buttons with a real onClick handler.',
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name='dispatchEvent']",
          message:
            'window event buses are banned. Use a zustand store or props for cross-component communication.',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'page',
          property: 'dispatchEvent',
          message:
            'Synthetic event dispatch is banned in e2e specs. Click real rendered controls.',
        },
      ],
    },
  }
);
