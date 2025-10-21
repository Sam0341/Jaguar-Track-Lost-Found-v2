
# UB Lost & Found (Next.js + TS + Tailwind)

Demo front-end for the University of Belize Lost & Found Management System.

## Quick Start

```bash
# 1) Install deps
npm install

# 2) Run dev server
npm run dev
```

Open http://localhost:3000 in your browser.

> This demo uses **localStorage** for data. You'll wire up a real backend later.

## What’s Included

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (with UB colors)
- Pages:
  - `/` Home
  - `/items` Browse + filter
  - `/items/[id]` Item details
  - `/report/lost` Report a lost item
  - `/report/found` Report a found item
  - `/reports` Simple analytics (recovery rate, common categories)
- Components: Navbar, Footer, ItemCard, ReportForm
- `lib/store.ts` — simple client-side storage (swap for real API/DB)

## Where to Add a Real Database / API

Replace `lib/store.ts` with calls to your API routes or server actions that
talk to a database (e.g., PostgreSQL/Prisma, Supabase, Firebase, etc.).

Ideas:
- Add authentication/roles (students, staff, admin).
- Allow image uploads (S3/Cloudinary) instead of URLs.
- Add moderation & claim/verify workflows.
- Export CSV reports.

## UB Colors

- `ubBlue`: `#003A70`
- `ubGold`: `#FDB813`

## License

MIT — use freely for demos and coursework.
