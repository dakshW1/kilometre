import { hasSupabase } from '@/lib/supabase/env';
import AuthShell from '../AuthShell';
import SignupForm from './SignupForm';

export const metadata = { title: 'Create account · Kilometre' };

export default function SignupPage() {
  return (
    <AuthShell
      supabaseReady={hasSupabase}
      title={<>Start earning <span className="font-serif font-normal italic text-heat">what you&apos;re worth.</span></>}
      subtitle="Free for riders. Takes 30 seconds, then we set up your apps and costs."
    >
      <SignupForm disabled={!hasSupabase} />
    </AuthShell>
  );
}
