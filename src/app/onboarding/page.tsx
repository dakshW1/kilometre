import { redirect } from 'next/navigation';
import { hasSupabase } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import OnboardingFlow from './OnboardingFlow';

export const metadata = { title: 'Set up · Kilometre' };

export default async function OnboardingPage() {
  if (!hasSupabase) redirect('/login');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/onboarding');
  const { data: profile } = await supabase.from('profiles').select('name, onboarded').eq('id', user.id).maybeSingle();
  if (profile?.onboarded) redirect('/app');
  return <OnboardingFlow initialName={profile?.name || (user.user_metadata?.name as string) || ''} />;
}
