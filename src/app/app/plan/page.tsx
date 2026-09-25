import PlanView from '@/components/plan/PlanView';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Plan · Kilometre' };

export default async function PlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('profiles').select('created_at').eq('id', user!.id).maybeSingle();
  return <PlanView createdAt={(data?.created_at as string | undefined) ?? user?.created_at ?? null} />;
}
