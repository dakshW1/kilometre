# Kilometre

**The app that works for gig workers.** Kilometre is an earnings coach, accountant and union rep in every Bengaluru delivery and ride rider's pocket.

- **Real hourly wage:** combines every app, then subtracts fuel, EMI, phone costs and unpaid waiting. "Apps show ₹178/hr. You really earn ₹94/hr."
- **City Pulse:** a 3D demand map of Bengaluru with a time slider, live rain forecast and match-night surges.
- **Screenshot import:** Gemini reads payout screenshots from any app (English, Hindi, Kannada), with 4-layer duplicate protection.
- **Wait timer:** one tap in, one tap out. Builds a city-wide restaurant wait-time map.
- **Quick log:** type or speak "Zomato 3 orders 180 rupees" in any language.
- **Appeals:** AI-written appeals for ID blocks and missing payouts, using only facts from the rider's own log.
- **Live weather:** rain alerts and an hourly rain forecast (Open-Meteo).

Demand data on the map is simulated for the demo. Restaurant names are fictional.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · MapLibre + deck.gl (3D map, free OpenFreeMap tiles) · Motion + Lenis · Supabase (auth + Postgres with RLS) · Google Gemini · Open-Meteo

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Database

In Supabase → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) once. For instant demo signups, turn off **Authentication → Sign In / Providers → Email → Confirm email**.

## Environment variables

| Name | Where to get it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | no (protected by RLS) |
| `GEMINI_API_KEY` | aistudio.google.com/apikey | **yes, server only** |
| `GEMINI_MODEL` | optional, default `gemini-3.8-flash` | no |
| `DEMO_MODE` | `true` = offline saved AI answers | no |

Weather and map tiles need no keys.

## Deploy to Vercel

1. vercel.com → **Add New… → Project** → import this GitHub repo. Framework preset: **Next.js** (auto-detected). Root directory: the repo root.
2. Under **Environment Variables**, add the variables above.
3. Click **Deploy**.
4. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL (e.g. `https://kilometre.vercel.app`).

## Demo helpers

- `npm run samples` redraws the demo payout screenshots in `demo-screenshots/` with today's date (needs Chrome or Edge installed).
- `/app?rain=1` simulates rain on a dry day (clearly marked "simulated"); `/app?rain=0` goes back to live weather.
- The Import page has "Try a sample" buttons that always use today's date.

Docs: [`docs/PRD.md`](docs/PRD.md) · [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)
