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

## Add components

```bash
npx shadcn@latest add <component>
```

## Build

```bash
npm run build
```

Writes to `dist/`, which is committed so `index.html` at the repo root can open it
directly (`dist/index.html`) without a build step — same as `v1/dashboard.html`.
Run this after any change and commit the result.

## Data pipeline

`extract.py` and `data.json` are unchanged from v1 (see the root
[README](../README.md#setup-v2)) — not yet wired into the React app.
