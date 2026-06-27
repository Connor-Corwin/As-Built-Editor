# As-Built Editor

A browser web app for **modernizing AVL building as-built documentation**.
Upload a PDF of the drawings (vector CAD exports or scanned pages) and — over
time — build an editable digital version of the systems: connections, rack
layouts, and labels.

This repository currently contains the **MVP**: reliable PDF upload, viewing,
and local-first persistence, on an architecture deliberately scaffolded for the
hybrid editor that comes next.

## What works today (MVP)

- **Projects** — create, rename, open, and delete projects (one per building /
  as-built set).
- **Upload** — drag-and-drop or browse for one or more PDFs per project. Both
  vector CAD exports and scanned/raster drawings are supported.
- **Viewer** — renders pages with PDF.js; page navigation and zoom.
- **Local-first** — everything is stored in the browser (IndexedDB via Dexie);
  drawings never leave your machine and survive a reload. No backend required.
- **Editing overlay (scaffold)** — a transparent Konva canvas is layered over
  each page, pixel-aligned to the drawing, ready to host editable racks,
  connections, and labels.

## Tech stack

- [Vite](https://vite.dev/) + React + TypeScript
- [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) — renders vector
  and scanned PDFs to canvas (no reliance on extractable text)
- [react-konva](https://konvajs.org/) — interactive overlay layer
- [Dexie](https://dexie.org/) — IndexedDB storage
- [Zustand](https://github.com/pmndrs/zustand) — UI state
- Tailwind CSS, Vitest

## Getting started

```bash
npm install
npm run dev        # start the dev server (prints a local URL)
```

Other scripts:

```bash
npm run build      # typecheck + production build
npm run test       # run unit tests (Vitest)
npm run preview    # preview the production build
```

## Project structure

```
src/
  db/         # Dexie schema, domain models, CRUD repository
  store/      # Zustand app/UI state (current project, page, zoom)
  lib/        # PDF.js setup + render helpers
  features/
    projects/ # project list + workspace
    upload/   # PDF drop zone / file picker
    viewer/   # PDF.js renderer + Konva overlay
  components/ # shared UI
```

## Test fixtures

`samples/` holds two example PDFs (a vector page and a scanned/raster page) for
manual testing. They can be regenerated with `node scripts/make-samples.mjs`
(requires Playwright/Chromium). `scripts/smoke.mjs` is an optional end-to-end
browser check of upload + render + persistence.

## Roadmap (next phases)

- Rack elevation editor (drag equipment into RU slots)
- Connection list table, linked to the drawing
- Label / callout placement on the overlay
- OCR for scanned PDFs; export of the modernized as-built (PDF / CSV)
- Optional cloud backend for multi-device sync and sharing
