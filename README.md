# emmtee-sched

A no-login monthly volunteer scheduler. Volunteers open one shared link, pick their name, claim Sundays for Laptop (operator or assist) and Photog, and swap dates by consent. The organiser locks the poll, auto-fills gaps, reviews a draft, publishes, and shares the result as a poster-style PNG.

- Laptop Operator and Photog must be filled on every Sunday before a month can be published; Laptop Assist is optional.
- Works on phones, tablets and desktops, with a light/dark switcher (dark by default) and a live countdown to the deadline (Asia/Manila time).

## Stack

Next.js 16 · React 19 · Tailwind 4 · Drizzle ORM · Neon Postgres · Vercel

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (Neon `dev` and `test` branch URLs, a 6-digit `ORGANISER_PIN`, and `SESSION_SECRET` from `openssl rand -base64 48`).
3. `npm run db:migrate && npm run db:migrate:test`
4. Put your roster in `local/roster.json` (gitignored) and run `npm run seed -- local/roster.json`.
5. `npm run dev`, then open `/organiser` to create the first month. For the first month, set the Poster by hand; later months follow the rotation.

`local/roster.json` looks like this:

```json
{
  "volunteers": [
    { "name": "Volunteer A", "roles": ["laptop", "poster"], "posterOrder": 1 },
    { "name": "Volunteer B", "roles": ["photog"] },
    { "name": "Volunteer C", "roles": ["assist"] }
  ]
}
```

## Tests

- `npm test`: unit tests (no database)
- `npm run test:int`: database tests against the Neon `test` branch (wipes it; refuses to run if it matches `DATABASE_URL`)

## Deploying

Set `DATABASE_URL` (Neon `main` branch, pooled), `ORGANISER_PIN` and `SESSION_SECRET` in Vercel. Run migrations against production before deploying a schema change:

```bash
DATABASE_URL="<production url>" npx drizzle-kit migrate
```

## Privacy

No accounts and no contact details. Volunteer names live only in the database and in the gitignored `local/` folder, never in this repository.

## Fonts

Cinzel Decorative, Abril Fatface and Amatic SC (used in the schedule image), under the SIL Open Font License (see `assets/fonts/*-OFL.txt`).
