import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabase } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (hasSupabase) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
