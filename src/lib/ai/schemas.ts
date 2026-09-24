import { z } from 'zod';

export const PLATFORM_IDS = ['swiggy', 'zomato', 'zepto', 'blinkit', 'instamart', 'uber', 'ola', 'rapido', 'porter', 'amazon_flex', 'unknown'] as const;

const nullableNum = z.number().nullable();
const nullableStr = z.string().nullable();

// ---------- Screenshot extraction ----------
export const ExtractSchema = z.object({
  platform: z.enum(PLATFORM_IDS),
  screenshot_type: z.enum(['order', 'daily_summary', 'weekly_payout', 'incentive', 'other']),
  date: nullableStr,
  summary: z.object({
    total_earnings: nullableNum,
    orders_count: nullableNum,
    incentives: nullableNum,
    tips: nullableNum,
    login_hours: nullableNum,
    distance_km: nullableNum,
  }),
  orders: z.array(z.object({
    order_id: nullableStr,
    time: nullableStr,
    amount: z.number(),
    incentive: nullableNum,
    tip: nullableNum,
    distance_km: nullableNum,
    restaurant_or_pickup: nullableStr,
    confidence: z.number().min(0).max(1),
  })),
  incentive_rule: nullableStr,
  notes: nullableStr,
});
export type Extraction = z.infer<typeof ExtractSchema>;

const N = { type: ['number', 'null'] };
const S = { type: ['string', 'null'] };

export const ExtractJSONSchema = {
  type: 'object',
  properties: {
    platform: { type: 'string', enum: [...PLATFORM_IDS] },
    screenshot_type: { type: 'string', enum: ['order', 'daily_summary', 'weekly_payout', 'incentive', 'other'] },
    date: { ...S, description: 'YYYY-MM-DD' },
    summary: {
      type: 'object',
      properties: { total_earnings: N, orders_count: N, incentives: N, tips: N, login_hours: N, distance_km: N },
      required: ['total_earnings', 'orders_count', 'incentives', 'tips', 'login_hours', 'distance_km'],
    },
    orders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order_id: S, time: { ...S, description: 'HH:MM 24h' }, amount: { type: 'number' }, incentive: N, tip: N,
          distance_km: N, restaurant_or_pickup: S, confidence: { type: 'number' },
        },
        required: ['order_id', 'time', 'amount', 'incentive', 'tip', 'distance_km', 'restaurant_or_pickup', 'confidence'],
      },
    },
    incentive_rule: S,
    notes: S,
  },
  required: ['platform', 'screenshot_type', 'date', 'summary', 'orders', 'incentive_rule', 'notes'],
};

export const EXTRACT_SYSTEM = `You extract earnings data from screenshots of Indian gig-work apps
(Swiggy, Zomato, Zepto, Blinkit, Instamart, Uber, Ola, Rapido, Porter, Amazon Flex).
Screens may be in English, Hindi or Kannada.
Rules:
- Return ONLY JSON matching the schema.
- Never guess. If a field is not visible, use null. Never invent order IDs.
- Amounts in INR as plain numbers (no ₹). Times as "HH:MM" 24-hour. Dates as "YYYY-MM-DD".
  If the year is missing use the year given in the prompt. If no date is visible, use null.
- "amount" is the base pay for that order or ride, excluding incentive and tip when they are shown separately.
- Give a confidence 0–1 per order: below 0.7 when any number on that row is blurry, cut off or ambiguous.
- screenshot_type: "order" for one or a list of orders/rides, "daily_summary" for a day's total screen,
  "weekly_payout" for a weekly settlement, "incentive" for an incentive/target offer, else "other".
- For a daily_summary, fill summary and leave orders empty unless individual rows are also visible.
- If this is not a gig-app earnings screen, return platform "unknown", type "other" and explain in notes.`;

// ---------- Quick log ----------
export const ParseLogSchema = z.object({
  earnings: z.array(z.object({
    platform: z.enum(PLATFORM_IDS),
    orders_count: z.number().int().min(1).max(60),
    amount: z.number().min(0),
    time: nullableStr,
    date: nullableStr,
    distance_km: nullableNum,
  })),
  waits: z.array(z.object({
    restaurant_name: z.string(),
    area: nullableStr,
    platform: z.enum(PLATFORM_IDS),
    duration_min: z.number().min(0.5).max(180),
  })),
  unclear: nullableStr,
});
export type ParsedLog = z.infer<typeof ParseLogSchema>;

export const ParseLogJSONSchema = {
  type: 'object',
  properties: {
    earnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string', enum: [...PLATFORM_IDS] },
          orders_count: { type: 'integer' }, amount: { type: 'number', description: 'total INR for these orders' },
          time: { ...S, description: 'HH:MM 24h' }, date: { ...S, description: 'YYYY-MM-DD' }, distance_km: N,
        },
        required: ['platform', 'orders_count', 'amount', 'time', 'date', 'distance_km'],
      },
    },
    waits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          restaurant_name: { type: 'string' }, area: S,
          platform: { type: 'string', enum: [...PLATFORM_IDS], description: 'unknown if not stated' }, duration_min: { type: 'number' },
        },
        required: ['restaurant_name', 'area', 'platform', 'duration_min'],
      },
    },
    unclear: { ...S, description: 'anything you could not understand, in plain words' },
  },
  required: ['earnings', 'waits', 'unclear'],
};

export const PARSE_LOG_SYSTEM = `You turn a gig worker's quick message into structured log entries.
The message can mix English, Hindi, Kannada and Hinglish, typed or transcribed from voice
(e.g. "Zomato 3 orders 180 rupees, waited 25 min at Biryani Junction Koramangala",
"aaj swiggy pe 5 order kiye 260 mile", "Rapido 2 ride 150").
Rules:
- Return ONLY JSON matching the schema.
- "amount" is the TOTAL rupees for that group of orders. orders_count defaults to 1 if not stated.
- Use null for anything not stated. Never invent numbers, platforms or restaurants.
- Resolve relative words using the date and time given in the prompt ("today", "aaj", "kal" = yesterday for past work).
- Put anything you cannot map in "unclear".`;

// ---------- Appeal ----------
export const AppealSchema = z.object({
  subject: z.string(),
  letter_en: z.string(),
  summary_local: z.string(),
  attach_checklist: z.array(z.string()).max(8),
});
export type AppealDraft = z.infer<typeof AppealSchema>;

export const AppealJSONSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    letter_en: { type: 'string' },
    summary_local: { type: 'string' },
    attach_checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['subject', 'letter_en', 'summary_local', 'attach_checklist'],
};

export const APPEAL_SYSTEM = `You help Indian gig workers write formal, polite and firm appeals and complaints to platforms.
You get: platform, issue type, dates, the rider's own description (any language), and EVIDENCE computed from the rider's Kilometre log.
Rules:
- Use ONLY facts from the description and the evidence. Never invent order IDs, amounts, dates, ratings or policies.
  If a useful fact is missing, write a placeholder in square brackets, e.g. [YOUR PARTNER ID].
- Cite the concrete numbers from the evidence (deliveries/rides completed, active days, amounts, last active date).
- Ask for: the specific reason for the action, the fix (reinstatement / payment of the missing amount), and a written reply within 7 days.
- Say the rider may escalate to the platform's grievance officer and the relevant labour or welfare authorities if unresolved. Do not name specific laws.
- letter_en: English, under 230 words, starting "Dear <Platform> Partner Support," and ending with the rider's name.
- summary_local: under 60 words, very simple words, in the requested language, saying what the letter asks for and what to do next.
- attach_checklist: 3–6 short items the rider should attach (screenshots, IDs, dates).`;
