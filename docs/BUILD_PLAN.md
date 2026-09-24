# Kilometre — 2-Hour Build Plan

Companion to `PRD.md` (features) and the design canvas (https://claude.ai/artifact/RncZbnSeMULvJz54eYCc8Z).

## Stack decisions

| Layer | Choice | Key needed? |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind | — |
| 3D map | **MapLibre GL + deck.gl** (3D hexagon columns, 3D buildings, pitch/rotate) | **None.** Uses free OpenFreeMap vector tiles. |
| Motion | `motion` (Framer Motion) scroll effects + **Lenis** smooth scroll | — |
| Auth + DB | **Supabase** (email + password auth, Postgres, Row Level Security) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| AI | Google Gemini (vision for screenshots, text for appeals and logs) | `GEMINI_API_KEY` (server only) |
| Deploy | Vercel | — |

## Site flow

```
/                 Landing: full-screen 3D Bengaluru map. The camera flies across the city as you scroll
                  (problem → true wage → wait times → appeals → CTA)
/signup /login    Supabase email + password
/onboarding       Name, language, apps you work on, vehicle, fuel ₹/km, EMI, daily target → profiles table
/app              Rider dashboard: earnings ring, real vs shown hourly wage, unpaid waiting, by-app, go-here
/app/pulse        City Pulse: 3D hex demand map, time slider, rain/match toggles, zone list, restaurant waits
/app/wait         Wait timer (arrived → picked up) → wait_logs
/app/import       Screenshot upload → AI extraction → dedup review → earnings
/app/log          Quick text/voice log → AI parse → review → earnings + waits
/app/appeal       AI appeal/complaint generator using the rider's own logged facts
```

## Database (Supabase)

`profiles` · `earnings` · `wait_logs` · `screenshots` (sha256, unique per user) · `appeals`. Every table has RLS limiting it to `auth.uid()`. Schema: `gigboss/supabase/schema.sql`.

## Phases

| Phase | Time | Scope | Done when |
|---|---|---|---|
| **1. Foundation + landing** | 0:00–0:35 | Scaffold, design tokens and fonts, Supabase clients and middleware, schema SQL, signup/login, 3D scroll landing page | Landing flies over the 3D city; signup creates a user |
| **2. City Pulse** | 0:35–1:05 | App shell and nav, deck.gl 3D hex map with simulated demand, time slider, rain and match modes, zone cards, detail panel, restaurant wait pins | Slider and toggles change the 3D map live |
| **3. Rider core** | 1:05–1:30 | Onboarding → profile, dashboard with true-wage math, wait timer, seed demo data button | A new user onboards and sees the dashboard with real numbers |
| **4. AI features** | 1:30–1:50 | `/api/extract` + dedup + review, `/api/appeal`, `/api/parse-log`, `DEMO_MODE` cached responses | A screenshot becomes ledger rows, and an appeal letter generates |
| **5. Polish + ship** | 1:50–2:00 | Loading states, mobile check, Vercel deploy, backup demo video | Deployed URL works end to end |

**Cut order if behind:** quick log → restaurant pins → Lenis → language toggle. **Never cut:** 3D map, screenshot import, true wage, appeal.

## Keys you need to create (5 minutes)

1. **Supabase:** create a project at supabase.com → Project Settings → API → copy the URL and anon key. Then SQL Editor → run `supabase/schema.sql`. For the demo, turn off "Confirm email" under Authentication → Providers → Email so signups work instantly.
2. **Gemini:** aistudio.google.com/apikey → Create API key.
3. Put them in `gigboss/.env.local` (see `.env.example`).

---

## Status (25 Sep 2026)

| Phase | Status |
|---|---|
| 1. Foundation + landing | ✅ Done: 3D scroll landing, Supabase auth, schema |
| 2. City Pulse | ✅ Done: 3D hex map, time slider, rain/match, zone cards, detail card, Google Maps directions |
| 3. Rider core | ✅ Done: onboarding, dashboard with true-wage maths, wait timer, demo-week seed |
| 4. AI features | ✅ Done: screenshot import (Gemini vision) + 4-layer dedup, quick log (text/voice), appeal generator |
| 5. Polish + ship | ⏳ Vercel deploy, rehearsal, backup video |

**AI model:** `gemini-3.8-flash`, falling back automatically to `gemini-3.5-flash` and `gemini-flash-latest` when a model is busy. Set `DEMO_MODE=true` in `.env.local` to use saved responses with no internet.

## Run it

```
cd gigboss
npm run dev        # http://localhost:3000
```

## 3-minute demo script

1. **Landing (30s):** scroll slowly through the 3D city. Pause on ₹180 → ₹94.
2. **Sign up → onboarding (30s):** pick apps, costs and goal, with "Load a demo week" ticked.
3. **Dashboard (30s):** "Apps show ₹178/hr. Ravi really earns ₹94/hr. 47 minutes unpaid today."
4. **City Pulse (40s):** drag the time slider to lunch, turn on Match at Chinnaswamy, click a zone, then "Guide me here".
5. **Import (30s):** "Try a sample screenshot" → AI reads 4 orders → Merge the matched one → Add. Upload it again → "Already imported."
6. **Appeal (20s):** Hindi description → letter citing the rider's own trip count.

Always keep a recorded backup video of this flow.

## Live weather (added)

- Source: **Open-Meteo** (free, no API key), refreshed every 10 min and cached on the server.
- **Alert banner** on every app page when it's raining now, rain is likely within 3 hrs, or it feels ≥36°C. "Notify me" enables browser notifications, once per weather event.
- **Dashboard weather card:** current conditions, a 12-hour rain-chance chart, and advice.
- **City Pulse:** Rain mode follows the live forecast for the selected hour (LIVE badge). Tap it to override, then "Use live weather" to go back.
- **Stage demo on a dry day:** open `/app?rain=1` to simulate rain (marked "simulated"). It stays on while you move around the app; `/app?rain=0` returns to live.
