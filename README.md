# API Harbor

HAR file viewer — parse, browse, and inspect HTTP requests from DevTools HAR exports.

## Features

- **Multi-file support** — load multiple HAR files at once, filter by file
- **Full-width request table** — method, status, path, initiator, type, timing, waterfall
- **Sortable** — by start time or duration
- **Search** — filter by URL, host, method, body content
- **Request drawer** — click any request for full detail
  - Headers, query params, request/response body
  - Schema inference from JSON body with field-level type detection
  - Click a schema field to highlight it in the raw JSON tree
  - Collapsible JSON viewer with syntax highlighting
  - Timing waterfall breakdown
- **Light theme** — warm editorial palette

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:9000 — drop a `.har` file exported from Chrome DevTools (Network panel → Export HAR).

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite 8
