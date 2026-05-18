# Loomwright v2

This repository contains the extracted Loomwright v2 design build.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The root `index.html` redirects to the
canonical app shell, `Loomwright Shell.html`.

## Useful scripts

- `npm run dev` - start the local development server.
- `npm run validate` - check that HTML entry files only reference files that
  exist in the repository.
- `npm run build` - copy the static app into `dist/` for preview/deployment.
- `npm run preview` - serve the built `dist/` directory locally.

## Editing notes

- Edit `Loomwright Shell.html` and the root `*.jsx` / `*.css` files.
- Treat `Loomwright.bundle.jsx`, `Loomwright Shell - Standalone.html`,
  `Loomwright Shell.standalone-src.html`, and `Loomwright Shell-print.html` as
  generated review artifacts unless you intentionally regenerate them.
- The `*_HOOKUP.md` and audit files document design intent and backend hookup
  requirements.
