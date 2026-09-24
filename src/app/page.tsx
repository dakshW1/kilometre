import Landing from '@/components/landing/Landing';
import { hasSupabase } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  let signedIn = false;
  if (hasSupabase) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims;
  }
  return <Landing signedIn={signedIn} />;
}
