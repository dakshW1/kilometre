import { hasSupabase } from '@/lib/supabase/env';
import AuthShell from '../AuthShell';
import LoginForm from './LoginForm';

export const metadata = { title: 'Log in · Kilometre' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  return (
    <AuthShell
      supabaseReady={hasSupabase}
      title={<>Welcome <span className="font-serif font-normal italic text-heat">back.</span></>}
      subtitle="Your earnings, waits and appeals are right where you left them."
    >
      <LoginForm disabled={!hasSupabase} next={typeof next === 'string' ? next : '/app'} />
    </AuthShell>
  );
}
