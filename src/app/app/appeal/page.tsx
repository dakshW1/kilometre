import AppealView from '@/components/appeal/AppealView';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Appeals · Kilometre' };

export default async function AppealPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('appeals').select('id, platform, issue_type, created_at, letter_en').order('created_at', { ascending: false }).limit(5);
  return <AppealView past={data ?? []} />;
}
