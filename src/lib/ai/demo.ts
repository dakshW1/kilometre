// Canned AI responses for DEMO_MODE (or a missing key), so the stage demo never depends on Wi-Fi.
import type { AppealDraft, Extraction, ParsedLog } from './schemas';
import { sampleExtraction, sampleIdFromName } from '../samples';

// Matches the file to one of the built-in samples; unknown images get the Swiggy sample's answer.
export function demoExtraction(today: string, fileName = ''): Extraction {
  return sampleExtraction(sampleIdFromName(fileName) ?? 'swiggy-orders', today);
}

export function demoParseLog(text: string): ParsedLog {
  const num = (re: RegExp) => Number(text.match(re)?.[1] ?? NaN);
  const orders = num(/(\d+)\s*(?:orders?|order|rides?)/i);
  const amount = num(/(\d+)\s*(?:rs|rupees|₹|mile|milay)/i) || num(/₹\s*(\d+)/);
  const wait = num(/(\d+)\s*min/i);
  const platform = (['swiggy', 'zomato', 'zepto', 'blinkit', 'instamart', 'uber', 'ola', 'rapido', 'porter'] as const).find((p) => text.toLowerCase().includes(p)) ?? 'unknown';
  const at = text.match(/at\s+([A-Z][\w' ]+?)(?:\s+(?:in|,)|$)/)?.[1];
  return {
    earnings: Number.isFinite(amount) ? [{ platform, orders_count: Number.isFinite(orders) ? orders : 1, amount, time: null, date: null, distance_km: null }] : [],
    waits: Number.isFinite(wait) ? [{ restaurant_name: at ?? 'Restaurant', area: null, platform, duration_min: wait }] : [],
    unclear: 'Demo mode: simple offline parser.',
  };
}

export function demoAppeal(input: { platform: string; name: string; evidence: Record<string, unknown> }): AppealDraft {
  const e = input.evidence as { total_orders?: number; active_days?: number; last_active?: string | null; rating?: string | null };
  return {
    subject: `Request to review deactivation of Delivery Partner ID [YOUR PARTNER ID]`,
    letter_en: `Dear ${input.platform} Partner Support,

My delivery partner account was deactivated after my last shift${e.last_active ? ` on ${e.last_active}` : ''}, and I have not been given a reason.

According to my records I have completed ${e.total_orders ?? '[NUMBER]'} deliveries over ${e.active_days ?? '[NUMBER]'} active days${e.rating ? `, with a ${e.rating} rating` : ''}.

I request the specific reason for this action, reinstatement of my account, and a written reply within 7 days. If this is not resolved, I will escalate to your grievance officer and the relevant labour authorities.

Thank you,
${input.name}`,
    summary_local: 'आपकी अपील तैयार है। इसे सपोर्ट को भेजें। 7 दिन में जवाब न आए तो शिकायत अधिकारी को लिखें।',
    attach_checklist: ['Screenshot of the deactivation message', 'Your partner ID and registered phone number', 'Earnings screenshots from the last 2 weeks'],
  };
}
