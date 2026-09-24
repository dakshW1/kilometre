import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { demoMode, generateJSON } from '@/lib/ai/gemini';
import { demoExtraction } from '@/lib/ai/demo';
import { EXTRACT_SYSTEM, ExtractJSONSchema, ExtractSchema } from '@/lib/ai/schemas';
import { isoDateIST } from '@/lib/dates';
import { classify, type ExistingOrder } from '@/lib/dedup';
import { sampleExtraction, sampleIdFromName } from '@/lib/samples';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No image received.' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Please upload an image (PNG or JPG).' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That image is over 8 MB.' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  // Layer 1: the exact same image file was already imported.
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { data: seen } = await supabase.from('screenshots').select('uploaded_at').eq('sha256', sha256).maybeSingle();
  if (seen) return NextResponse.json({ sha256, duplicateFile: { uploadedAt: seen.uploaded_at } });

  const today = isoDateIST();
  let extraction;
  let offline = demoMode;
  try {
    extraction = demoMode
      ? demoExtraction(today, file.name)
      : await generateJSON({
        system: EXTRACT_SYSTEM,
        prompt: `Today is ${today} (Asia/Kolkata). Extract the earnings data from this screenshot.`,
        images: [{ mimeType: file.type, data: bytes.toString('base64') }],
        jsonSchema: ExtractJSONSchema,
        zod: ExtractSchema,
      });
  } catch (e) {
    console.error('[extract]', e);
    // Built-in demo samples have a known correct reading: use it so a busy AI can't break the pitch.
    const sample = sampleIdFromName(file.name);
    if (!sample) return NextResponse.json({ error: 'The AI is busy or could not read this screenshot. Try again in a moment.' }, { status: 502 });
    extraction = sampleExtraction(sample, today);
    offline = true;
  }

  const date = extraction.date ?? today;
  const { data: existing } = await supabase.from('earnings')
    .select('id, platform, date, time, order_id, amount, source')
    .eq('platform', extraction.platform).eq('date', date).eq('kind', 'order');
  const results = extraction.orders.map((o) => {
    const r = classify({ order_id: o.order_id, time: o.time, amount: o.amount }, extraction.platform, date, (existing ?? []) as ExistingOrder[]);
    return r.status === 'new' ? { status: r.status } : { status: r.status, matchId: r.match.id, matchSource: r.match.source, matchTime: r.match.time };
  });
  const { data: summary } = await supabase.from('earnings').select('id').eq('platform', extraction.platform).eq('date', date).eq('kind', 'daily_summary').maybeSingle();

  return NextResponse.json({ sha256, extraction: { ...extraction, date }, results, existingSummary: !!summary, demo: offline });
}
