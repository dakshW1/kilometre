# Kilometre — Product Requirements Document (Hackathon MVP)

> **One-liner:** Kilometre is an earnings coach, accountant and union representative in every gig worker's pocket.
> **Build target:** Working web app demo in **2–3 hours**. Mobile-first rider screens + big-screen "City Pulse" map for judges.
> **Status:** MVP for college Shark Tank pitch (Bangalore). Data on the map is **simulated** — say so on stage.

---

## 1. Problem

Bangalore delivery and ride workers juggle several apps at once (Swiggy, Zomato, Zepto, Blinkit, Uber, Rapido, Ola, Porter), and none of those apps is on the worker's side.

| Pain | Reality today |
|---|---|
| Don't know real earnings | Earnings are spread across several apps. Fuel, commission, EMI and waiting time are never subtracted, so workers overestimate what they make per hour. |
| Unpaid waiting at restaurants | Riders wait 15–30 minutes for food and aren't paid for it. Nobody tracks which restaurants are the worst. |
| Missing payouts and incentives | Incentive rules are confusing, and missing money goes unnoticed. |
| Sudden ID deactivation | Accounts get blocked with no explanation. Riders don't know how to appeal. |
| Where and when to work | Riders guess. |

**Why the platforms won't fix it:** they have a conflict of interest. An independent app that works across all platforms is the only neutral party.

## 2. Target user

**Ravi, 26, Bangalore.** Delivers for Swiggy and Zepto, drives Rapido in the evenings. Has an Android phone, speaks Kannada and Hindi with a little English, rides 10–11 hours a day and pays a ₹3,200/month bike EMI.

## 3. Goals for the demo

1. Show a **3D map of Bangalore** with live-looking demand and restaurant wait scores (the "wow" moment).
2. Show **screenshot → AI extracts earnings → deduplicated ledger** (the core GenAI feature and the answer to "where does your data come from?").
3. Show the **wait timer** and the **true hourly wage**, including the shock number.
4. Show the **AI appeal / complaint generator** (the emotional moment).

**Out of scope tonight:** login/auth, real payments, native Android app, real platform integrations.

---

## 4. Data capture strategy (how we track rider activity)

| Method | What it captures | Feasible tonight (web)? | Later |
|---|---|---|---|
| **A. One-tap wait timer** | Restaurant wait time: "Arrived" → "Picked up" | ✅ **Yes (primary)** | Auto-triggered by geofence |
| **B. Screenshot upload + AI extraction** | Orders, payouts, incentives, distance, time, from any app | ✅ **Yes (primary)** | WhatsApp bot: rider forwards screenshots |
| **C. Quick log by text/voice** | "Waited 20 min at Biryani Junction, Swiggy order ₹48" → AI parses | ✅ Yes | Hands-free voice in Kannada/Hindi |
| **D. Browser geolocation** | Rider's current position, nearest restaurant snap | ✅ Yes (foreground only) | Background location in native app |
| **E. Android Notification Listener** | Order-assigned and payout notifications from all apps, fully automatic | ❌ Needs a native Android app | Phase 2. Needs explicit user consent. Google Play restricts this permission, so we must justify the use. |
| **F. Geofence dwell detection** | Automatic wait time when a rider stays within ~50 m of a restaurant | ❌ Native only | Phase 2 |
| **G. Account Aggregator (RBI AA framework)** | Verified platform payouts from the bank statement, with consent (via providers such as Setu, Finvu, OneMoney) | ❌ | Phase 3. Also enables worker credit scoring. |
| **H. Official platform APIs** | — | ❌ No public partner-earnings APIs from Indian platforms | Partnerships only |

**Not allowed:** Accessibility-service screen scraping or automating the platform apps. It creates terms-of-service and Play Store risk, and it breaks the "we're only an advisor" position.

**Pitch line:** *"Today riders tap once or forward a screenshot. In our Android app, it's fully automatic from notifications and location, and every rider's data makes the map smarter for everyone."*

---

## 5. Features (MVP)

Priority: **P0** = must be in the demo, **P1** = build if time allows, **P2** = roadmap slide only.

### F1. Onboarding / profile (P0, simple form, saved to localStorage)
- Name, preferred language (English / हिंदी / ಕನ್ನಡ)
- **Apps I work on** (multi-select chips with logos or colors): Swiggy, Zomato, Zepto, Blinkit, Swiggy Instamart, Uber, Ola, Rapido, Porter, Amazon Flex
- Vehicle: petrol bike / EV / e-cycle. **Fuel cost per km** (default ₹2.5), monthly EMI (default ₹3,200), phone/data per month (default ₹400)
- Daily earnings target (default ₹1,500)
- **Acceptance:** the profile is used in all calculations. Pre-fill a demo profile for "Ravi."

### F2. Rider dashboard (P0, mobile layout)
- **Earnings ring:** today's net earnings vs target (e.g. "₹1,120 / ₹1,500")
- **True hourly wage** (large number), with the "you think" gross hourly beside it (see §6)
- **Per-app breakdown:** stacked bar or cards per platform (earnings, orders, ₹/hour)
- **Unpaid waiting today:** "47 min waited = ₹74 lost"
- **"Go here" card:** "Move to HSR Sector 2, +₹180 expected in the next hour, Swiggy lunch rush." (Computed from the simulated demand grid for the current hour. One-line explanation from a template or AI.)
- Quick-action buttons: ⏱️ Start wait · 📸 Upload screenshot · 🎙️ Quick log · ⚖️ Appeal · 🆘 SOS (P2: visual only)

### F3. Restaurant wait timer (P0)
1. Rider taps **"Arrived at restaurant."**
2. The app gets browser geolocation and snaps to the nearest seeded restaurant within 150 m. Otherwise the rider picks from a searchable list or types a name.
3. Select the platform (chips from the profile).
4. A large full-screen timer counts up, color-coded: green < 5 min, amber 5–15, red > 15.
5. Tap **"Picked up."** A WaitLog is saved.
- **Acceptance:** the wait is saved, the dashboard's "unpaid waiting" updates, and the restaurant's average wait score updates on the map.

### F4. Screenshot import with AI extraction (P0, the core GenAI feature)
1. Upload one or more screenshots (drag-drop or file picker; mobile camera roll).
2. Compute a **SHA-256 hash** of each file. If it was seen before, show "Already uploaded" and skip (exact dedup).
3. Send to `/api/extract` → vision LLM → structured JSON (schema in §8.1).
4. Show a **review card**: the detected platform (with logo color), type (single order / daily summary / weekly payout / incentive), and a list of extracted orders with editable fields.
5. Run **record-level dedup** (§7). Flag possible duplicates with "Merge / Keep both."
6. **Confirm** → save entries to the ledger.
- **Acceptance:** works on at least 3 real screenshots from 2 different apps collected before the demo. Low-confidence fields are highlighted in amber for the rider to check.

### F5. Deduplication (P0, logic runs inside F4 and F6; see §7)

### F6. Quick log by text or voice (P1)
- Text box plus a mic button (Web Speech API; `hi-IN` works, test `kn-IN`, fall back to typing).
- Free text such as *"Zomato 3 orders 180 rupees, waited 25 min at Biryani Junction Koramangala"* → `/api/parse-log` → structured entries (earnings plus a wait log) → review → save (with dedup).

### F7. City Pulse map (P0, the visual wow, for the projector)
- Full-screen **dark 3D map** of Bangalore with a tilted camera (pitch ~50°).
- **Layer 1, demand:** deck.gl `HexagonLayer` with glowing 3D hex columns built from simulated demand points (§9). Height and color = demand.
- **Layer 2, restaurant wait score:** `ScatterplotLayer` pins colored by average wait (green / amber / red). Hover tooltip: "Biryani Junction · avg wait 22 min · 41 reports · worst 8–9 PM."
- **Layer 3 (P1), riders:** animated dots drifting around hotspots.
- **Controls:**
  - **Time slider** (6 AM – 1 AM): demand re-weights by hour, so lunch rises near tech parks and dinner rises in residential areas.
  - **🌧️ Rain toggle:** demand ×1.4, tint the map blue, show "Rain surge" banner.
  - **🏏 Event toggle ("RCB match at Chinnaswamy"):** large spike around the stadium from 7–11 PM.
  - **Platform filter** chips.
- Side panel: "Top 3 zones right now," "Worst 5 restaurants for waiting," and a live counter ("3,214 wait reports this week", simulated).

### F8. AI appeal / complaint generator (P0)
- **Inputs:** platform, issue type (**ID deactivated / payout missing / incentive not credited / false customer complaint / other**), date(s), description in any language (typed or spoken).
- **Auto-attached evidence** from the ledger: orders and earnings on those dates, wait logs, total trips, rating if entered.
- `/api/appeal` → returns:
  1. a formal letter in English for platform support or the grievance officer,
  2. a short summary in the rider's language saying what was sent and what to do next,
  3. a checklist of documents or screenshots to attach.
- Buttons: Copy · Download as .txt or PDF · Share (via WhatsApp link).
- **Acceptance:** the letter cites specific dates, order counts and amounts from the rider's own data. The prompt must forbid inventing facts.

### F9. Incentive decoder (P1)
- Paste or upload a platform incentive message: *"Complete 18 orders 7–11 PM, get ₹150."*
- The AI returns whether it's realistic given the rider's average orders per hour, the effective ₹ per extra order, and a verdict: "Worth it / Not worth it."

### Roadmap (P2, pitch slide only)
Android app with automatic notification capture and geofenced waiting · crash detection + SOS + automatic insurance claim · rest-point map (toilets, water, shade, charging) · women rider safety mode · heat and rain guard · welfare / e-Shram registration helper · rider circles · public **Gig Pay Index** · earnings-based credit score and loans · insurance · EV partner offers · career ladder coach.

---

## 6. Calculations

```
gross_earnings      = Σ(order_pay + incentives + tips)          // as shown by the apps
fuel_cost           = Σ(distance_km) × fuel_cost_per_km
fixed_daily_cost    = (monthly_emi + monthly_phone_data) / 26    // ~26 working days
net_earnings        = gross_earnings − fuel_cost − fixed_daily_cost
                      − platform_fees (only if the screenshot shows gross before fees)

paid_hours          = Σ(active delivery/ride time)               // if known, else hours estimate
total_hours         = login_hours (profile or log) incl. waiting

gross_hourly ("you think") = gross_earnings / paid_hours
true_hourly               = net_earnings / total_hours

unpaid_wait_minutes = Σ(wait_log.duration_min)
unpaid_wait_cost    = unpaid_wait_minutes × (true_hourly / 60)
```
Demo data should give roughly **gross ₹180/hr vs true ₹94/hr**. That gap is the shock stat.

---

## 7. Deduplication algorithm

Duplicates come from three places: (a) the same screenshot uploaded twice, (b) different screenshots of the same order (order detail vs daily list), (c) a manual log plus a screenshot of the same order.

```
Layer 1 — Exact file:
  hash = SHA-256(file bytes)
  if hash ∈ screenshots.hash → reject "Already uploaded on <date>"

Layer 2 — Strong key:
  if order_id present:
     key = platform + ":" + order_id
     if exists → duplicate (auto-skip, show "1 duplicate skipped")

Layer 3 — Fuzzy match (no order id):
  candidates = entries where same platform AND same date
  match if |amount − c.amount| ≤ ₹1 AND |time − c.time| ≤ 10 min
  → flag "Possible duplicate", UI offers [Merge] [Keep both]
  merge rule: keep the record with more fields filled; prefer screenshot over manual

Layer 4 — Summary vs detail (avoid double counting):
  if a DAILY_SUMMARY exists for (platform, date):
     totals for that day come from the summary
     individual orders are kept for detail but marked counted_in_summary = true
```
Wait logs: dedup if same restaurant, same platform and start times within 5 minutes.

---

## 8. AI prompts (API routes)

Use **Claude** (`claude-sonnet-5` for extraction quality, or `claude-haiku-4-5-20251001` for speed and cost) or Gemini. Send screenshots as base64 image content blocks. Ask for **JSON only** and validate it with Zod on the server. If parsing fails, retry once.

### 8.1 `/api/extract` — screenshot → JSON
**System prompt:**
```
You extract earnings data from screenshots of Indian gig-work apps
(Swiggy, Zomato, Zepto, Blinkit, Instamart, Uber, Ola, Rapido, Porter, Amazon Flex).
Screens may be in English, Hindi or Kannada.
Rules:
- Return ONLY valid JSON matching the schema. No prose.
- Never guess. If a field is not visible, use null.
- Amounts in INR as numbers (no ₹ symbol). Times as "HH:MM" 24h. Dates as "YYYY-MM-DD"
  (if year missing, assume current year; if date missing, null).
- Give a confidence 0–1 per order.
- Detect screenshot_type: "order" | "daily_summary" | "weekly_payout" | "incentive" | "other".
```
**Output schema:**
```json
{
  "platform": "swiggy|zomato|zepto|blinkit|instamart|uber|ola|rapido|porter|amazon_flex|unknown",
  "screenshot_type": "order|daily_summary|weekly_payout|incentive|other",
  "date": "YYYY-MM-DD|null",
  "summary": { "total_earnings": 0, "orders_count": 0, "incentives": 0, "tips": 0, "login_hours": 0, "distance_km": 0 },
  "orders": [
    { "order_id": "string|null", "time": "HH:MM|null", "amount": 0, "incentive": 0, "tip": 0,
      "distance_km": 0, "restaurant_or_pickup": "string|null", "confidence": 0.0 }
  ],
  "incentive_rule": "string|null",
  "notes": "string|null"
}
```

### 8.2 `/api/parse-log` — free text or voice → entries
```
Convert the rider's message (any mix of English, Hindi, Kannada, Hinglish) into JSON:
{ "earnings": [ {platform, orders_count, amount, time|null, date|null} ],
  "waits":    [ {restaurant_name, area|null, platform|null, duration_min} ] }
Use null for anything not stated. Do not invent numbers.
```

### 8.3 `/api/appeal` — complaint / appeal letter
```
You help Indian gig workers write formal, polite, firm appeals to platforms.
Inputs: platform, issue_type, dates, rider description (any language), EVIDENCE JSON from their logs.
Output JSON: { "letter_en": string, "summary_local": string (in {language}), "attach_checklist": string[] }
Rules:
- Use ONLY facts from the description and evidence. Never invent order IDs, amounts or dates.
- Cite concrete numbers from evidence (orders completed, amounts, dates, total trips).
- Request: reason for action, reinstatement/payment, and a response timeline.
- Mention that the rider may escalate to the platform grievance officer and relevant labour/welfare authorities.
- Keep letter under 250 words. summary_local under 60 words, simple words.
```

### 8.4 `/api/incentive` (P1)
```
Given incentive text + rider stats {avg_orders_per_hour, avg_pay_per_order}, return JSON:
{ "target_orders", "window_hours", "orders_needed_per_hour", "achievable": bool,
  "extra_per_order_inr", "verdict": "worth_it|not_worth_it|borderline", "explanation_local" }
```

---

## 9. Seed / simulated data

**Map center:** `[77.5946, 12.9716]` (lng, lat), zoom 11.5, pitch 50, bearing -20.

**Hotspots** (lng, lat, profile):
| Zone | lng | lat | Peak profile |
|---|---|---|---|
| Koramangala | 77.6245 | 12.9352 | lunch + dinner (very high) |
| HSR Layout | 77.6474 | 12.9116 | dinner high |
| Indiranagar | 77.6408 | 12.9784 | dinner + late night |
| Whitefield | 77.7500 | 12.9698 | lunch (tech parks) |
| Manyata Tech Park | 77.6210 | 13.0450 | lunch |
| Electronic City | 77.6602 | 12.8452 | lunch |
| Marathahalli | 77.6974 | 12.9591 | lunch + dinner |
| Bellandur | 77.6762 | 12.9260 | lunch |
| BTM Layout | 77.6101 | 12.9166 | dinner |
| Jayanagar | 77.5938 | 12.9250 | evening |
| MG Road | 77.6050 | 12.9756 | evening + late night |
| Chinnaswamy Stadium | 77.5996 | 12.9788 | event spike 19–23 |
| Hebbal | 77.5970 | 13.0358 | medium |
| Malleswaram | 77.5709 | 13.0035 | medium |

**Generator (`lib/simulate.ts`):** for each hotspot, generate `N = base × hourWeight(hour, profile) × (rain ? 1.4 : 1) × (event && zone==Chinnaswamy ? 4 : 1)` points with a Gaussian spread of σ ≈ 0.008°. Use a seeded random generator so the map is stable between reloads.
Hour weights: lunch profile peaks at 12–14, dinner at 19–22, late night at 22–01, with a small base level at other hours.

**Restaurants:** ~40 **fictional** restaurants near the hotspots (e.g. "Biryani Junction", "Dosa Point", "Burger Garage", "Chai Adda"), each with `avg_wait_min` between 4 and 28 and `reports` between 5 and 120. **Don't use real restaurant names with fake wait scores on stage.**

**Demo rider "Ravi":** 7 days of history across Swiggy, Zepto and Rapido (~12 orders/day), wait logs and incentives, tuned so the dashboard shows gross ~₹180/hr vs true ~₹94/hr.

---

## 10. Data model (TypeScript)

```ts
type Platform = 'swiggy'|'zomato'|'zepto'|'blinkit'|'instamart'|'uber'|'ola'|'rapido'|'porter'|'amazon_flex';

interface Profile { name: string; language: 'en'|'hi'|'kn'; platforms: Platform[];
  vehicle: 'petrol'|'ev'|'ecycle'; fuelCostPerKm: number; monthlyEmi: number;
  monthlyPhoneData: number; dailyTarget: number; }

interface EarningEntry { id: string; platform: Platform; date: string; time?: string;
  orderId?: string; amount: number; incentive?: number; tip?: number; distanceKm?: number;
  pickup?: string; source: 'screenshot'|'manual'|'voice'|'seed';
  screenshotId?: string; countedInSummary?: boolean; confidence?: number; }

interface DailySummary { id: string; platform: Platform; date: string; totalEarnings: number;
  ordersCount?: number; loginHours?: number; distanceKm?: number; screenshotId?: string; }

interface WaitLog { id: string; restaurantId?: string; restaurantName: string; platform?: Platform;
  start: string; end: string; durationMin: number; lat?: number; lng?: number;
  source: 'timer'|'manual'|'voice'|'seed'; }

interface Screenshot { id: string; hash: string; uploadedAt: string; platform?: Platform; type: string; }

interface Restaurant { id: string; name: string; area: string; lat: number; lng: number;
  avgWaitMin: number; reports: number; }

interface Appeal { id: string; platform: Platform; issueType: string; dates: string[];
  description: string; letterEn: string; summaryLocal: string; createdAt: string; }
```
**Storage tonight:** a `localStorage`-backed store (Zustand with the `persist` middleware), with seed data loaded on first run and a "Reset demo" button. Supabase is optional later.

---

## 11. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript + Tailwind** |
| UI kit | shadcn/ui, lucide-react icons, framer-motion for the earnings ring and animations |
| Map | **deck.gl** (`HexagonLayer`, `ScatterplotLayer`) + **react-map-gl/maplibre** with a free dark basemap (CARTO Dark Matter: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`) |
| Charts | Recharts (per-app bars) |
| State | Zustand + persist (localStorage) |
| AI | Claude API (or Gemini) through Next.js route handlers. Key in `.env.local`, never sent to the client. |
| Validation | Zod |
| Voice | Web Speech API (Chrome). Sarvam AI as a later upgrade. |
| Hashing | `crypto.subtle.digest('SHA-256', buffer)` in the browser |
| Deploy | Vercel (optional). Run locally for the demo if the Wi-Fi is unreliable. |

**Folder structure**
```
app/
  page.tsx                 → redirect to /rider
  rider/page.tsx           → F2 dashboard (mobile frame)
  rider/wait/page.tsx      → F3 timer
  rider/import/page.tsx    → F4 screenshot import + review
  rider/log/page.tsx       → F6 quick log
  rider/appeal/page.tsx    → F8 appeal generator
  pulse/page.tsx           → F7 City Pulse map (full screen)
  onboarding/page.tsx      → F1
  api/extract/route.ts
  api/parse-log/route.ts
  api/appeal/route.ts
  api/incentive/route.ts   (P1)
lib/
  store.ts  simulate.ts  seed.ts  calc.ts  dedup.ts  hash.ts  schemas.ts
components/
  EarningsRing.tsx  AppBreakdown.tsx  GoHereCard.tsx  WaitTimer.tsx
  ReviewCard.tsx  PulseMap.tsx  PlatformChip.tsx
```

---

## 12. UI / design spec — "rider cockpit"

- **Theme:** dark by default. Background `#0A0E14`, surface `#121821`, text `#E6EDF3`, muted `#7D8590`.
- **Accents:** neon green `#22E07A` (earnings), amber `#FFB020` (warning / waiting), red `#FF4D5E` (bad), cyan `#3DD6F5` (map and info).
- **Platform colors:** Swiggy `#FC8019`, Zomato `#E23744`, Zepto `#7B2CF5`, Blinkit `#F8CB46`, Uber `#FFFFFF`, Rapido `#FFD400`, Ola `#B6E23A`, Porter `#1E6FFF`.
- **Typography:** large numbers in a tabular-figure font (e.g. `Space Grotesk` or `JetBrains Mono` for figures, `Inter` for text).
- **Rider screens:** shown inside a centered phone frame (max-width 420px) on desktop so the projector looks like a phone. Tap targets ≥ 48px, big icons, minimal text. Designed for glove-and-helmet use.
- **Pulse screen:** edge-to-edge map, glass-blur side panel, hex columns glowing cyan → amber → red, subtle auto-rotation when idle.
- **Motion:** the earnings ring animates on load, the wait timer pulses once it's red, hex heights animate when the slider moves.
- **Language toggle:** EN / हिं / ಕ on every rider screen (translate only the labels on the main screens).

---

## 13. Build plan (≈3 hours, team of 3–4)

| Time | Person A — Map | Person B — Rider UI | Person C — AI + logic | Person D — Pitch/data |
|---|---|---|---|---|
| 0:00–0:20 | Scaffold Next.js, Tailwind, shadcn; push repo | Pull repo, phone frame layout, nav | `.env`, `/api/extract` hello world with one image | Collect 3–5 real payout screenshots and one wait-time story from a rider |
| 0:20–1:15 | `PulseMap` with deck.gl + MapLibre + simulated hexes | Dashboard: ring, true hourly, per-app, Go-here | Extraction prompt + Zod + review JSON; `hash.ts`, `dedup.ts` | `seed.ts`: Ravi's 7 days, 40 fictional restaurants |
| 1:15–2:00 | Time slider, rain and event toggles, restaurant pins, side panel | Wait timer page + import review UI | `/api/appeal` + appeal page wiring; `calc.ts` | Pitch slides (problem, demo, business model, market, ask) |
| 2:00–2:30 | Polish: glow, tooltip, idle rotation | Connect store → dashboard updates live | Quick log (P1) or incentive decoder (P1) | Rehearse the demo script |
| 2:30–3:00 | **Everyone:** full demo run × 3, fix bugs, **record a backup video**, test offline fallback (cached AI responses for demo inputs) |

**Cut order if behind:** F9 → F6 → rider dots → language toggle. **Never cut:** map, screenshot import, true hourly wage, appeal.

**Demo safety:** keep a `DEMO_MODE` flag that returns cached AI responses for the exact demo screenshots if the API or Wi-Fi fails.

---

## 14. Demo script (~3 minutes)

1. **Hook (20s):** "This is Ravi. He delivered your lunch today…" Play the real rider's audio quote if you have it.
2. **City Pulse (40s):** Show the 3D Bangalore map and drag the time slider to lunch, so Whitefield and Manyata light up. Toggle 🏏 RCB match, and Chinnaswamy spikes. Toggle 🌧️ rain. Hover a red restaurant: "avg wait 22 min."
3. **Screenshot import (40s):** Upload a real Swiggy screenshot, and the AI extracts the orders. Upload the same one again: "Already uploaded." Upload an overlapping one: "1 duplicate merged."
4. **Dashboard (30s):** "Ravi thinks he earns ₹180/hr. His real wage is ₹94/hr. And he lost ₹74 today waiting at restaurants, unpaid."
5. **Appeal (30s):** "Ravi's ID was blocked." Type in Hindi, and a formal letter appears citing his 312 trips and 4.8 rating from his own data.
6. **Close (20s):** Business model (free for riders; revenue from loans, insurance, EV partners and data), the market (~2.35 crore gig workers by 2029–30, per NITI Aayog), roadmap (Android auto-capture), and the ask.

---

## 15. Business model (for slides)

Free for riders. Revenue from: **embedded loans** (earnings history as a credit score; ~2–3% NBFC commission) · **insurance** distribution (accident, health, income-loss) · **EV and fuel partners** (referrals) · **B2B data** (Gig Pay Index, demand insights for insurers, lenders, researchers and government) · optional **premium** at ₹49/month.

## 16. Risks and judge questions

| Question | Answer |
|---|---|
| Where does the data come from without APIs? | Screenshots and one-tap logs now. Automatic capture from notifications and location in the Android app. Every rider improves the map. |
| Won't platforms block you? | We never touch or automate their apps. We're an advisor on the worker's own phone, using the worker's own data. |
| Won't everyone crowd into the same hotspot? | We balance the load by sending riders to different zones. |
| Privacy? | Consent first, the rider owns their data, only anonymized aggregates go into the map and the Gig Pay Index. |
| Will riders pay? | They don't need to. Partners pay. |
| AI hallucination in appeals? | Letters use only the rider's logged facts, and the rider reviews them before sending. |

---
*Numbers marked approximate (NITI Aayog projections, costs) must be verified before final slides. Map data in the demo is simulated.*
