import { redirect } from 'next/navigation';
import AppShell from '@/components/app/AppShell';
import { ProfileProvider } from '@/components/app/ProfileContext';
import { defaultProfile, type Profile } from '@/lib/profile';
import { hasSupabase } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  if (!hasSupabase) redirect('/login');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/app');

  // A missing table (schema not run yet) must not take the whole app down.
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data && !data.onboarded) redirect('/onboarding');
  const name = (user.user_metadata?.name as string | undefined) ?? '';
  const profile: Profile = data ? { ...defaultProfile(user.id, name), ...data } : defaultProfile(user.id, name);

  return (
    <ProfileProvider value={{ profile, email: user.email ?? '', dbReady: !error }}>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}
