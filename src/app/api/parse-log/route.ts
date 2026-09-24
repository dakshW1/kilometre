import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoMode, generateJSON } from '@/lib/ai/gemini';
import { demoParseLog } from '@/lib/ai/demo';
import { PARSE_LOG_SYSTEM, ParseLogJSONSchema, ParseLogSchema } from '@/lib/ai/schemas';
import { isoDateIST } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
const Body = z.object({ text: z.string().trim().min(2).max(1000) });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Type or say what you want to log.' }, { status: 400 });

  const today = isoDateIST();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date());
  try {
    const parsed = demoMode
      ? demoParseLog(body.data.text)
      : await generateJSON({
        system: PARSE_LOG_SYSTEM,
        prompt: `Now: ${today} ${time} (Asia/Kolkata).\nRider's message:\n"""${body.data.text}"""`,
        jsonSchema: ParseLogJSONSchema,
        zod: ParseLogSchema,
      });
    return NextResponse.json({
      parsed: { ...parsed, earnings: parsed.earnings.map((e) => ({ ...e, date: e.date ?? today })) },
      now: time,
      demo: demoMode,
    });
  } catch (e) {
    console.error('[parse-log]', e);
    return NextResponse.json({ error: 'The AI could not understand that. Try something like "Zomato 3 orders 180 rupees".' }, { status: 502 });
  }
}
