# Outreach Dashboard — v2

Vite + React + TypeScript + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com).

This is the active version of the dashboard. Branding (colors, typography) will be
customized in `src/index.css` and `components.json` once brand assets are provided —
for now it's the shadcn default theme.

## Develop

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` with hot reload. This is the primary way to work on v2 —
don't open `index.html`/`dist/` directly during development.

## Add components

```bash
npx shadcn@latest add <component>
```

## Build

```bash
npm run build
```

Writes a single self-contained `dist/index.html` (via `vite-plugin-singlefile`) with all
JS/CSS inlined, so it can be opened directly via `file://` with no server — same as
`v1/dashboard.html`, and needed because browsers block loading separate JS module files
over `file://`. The root `index.html` picker links here. Run this after any change and
commit the result.

## Data pipeline

`extract.py` and `data.json` are unchanged from v1 (see the root
[README](../README.md#setup-v2)) — not yet wired into the React app.
