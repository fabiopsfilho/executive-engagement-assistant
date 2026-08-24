# AWS T&C Executive Engagement Assistant

An AI-powered advisor that helps the AWS Training & Certification team prepare for
executive engagements. It synthesizes internal AWS/Salesforce data, uploaded
documents, and public signals into a single unified analysis, then generates a
conversational executive slide deck, a suggested agenda, and a prescriptive Skills
Session — all grounded in an expert AI-skills-transformation persona and never
fabricated.

## Three ways to access it

The experience is identical across all three — they all load the same web app and
the same Bedrock-backed API. Pick whichever fits the user's workflow:

1. **Standalone web app (no install).** Open the site and **select or type any
   customer name** to build the engagement story. You don't need a scheduled EBC
   agenda — typing a name is enough; the backend enriches everything from there.
   This is the simplest entry point and the recommended default.

2. **Chrome extension** (`chrome-extension/`). Adds a side panel while you browse
   Salesforce; it auto-detects the account you're viewing and can capture the page
   as internal context. See `chrome-extension/README.md`.

3. **Firefox extension** (`firefox-extension/`). The same capability using
   Firefox's sidebar. See `firefox-extension/README.md`.

Both extensions simply embed the standalone web app (passing the account via
`?account=CompanyName`), so any improvement to the app benefits all three.

## Project layout

| Path | What it is |
|------|-----------|
| `src/` | The React + Vite web app (the standalone interface) |
| `backend/` | AWS CDK stack + Lambdas (analysis, slides, agenda) on Bedrock |
| `chrome-extension/` | Chrome side-panel extension |
| `firefox-extension/` | Firefox sidebar extension |
| `docs/research/` | Source research behind the expert persona (provenance) |

---

## Development (React + TypeScript + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
