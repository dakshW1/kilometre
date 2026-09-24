'use client';

import { useFormStatus } from 'react-dom';
import { ArrowRight, LoaderCircle } from 'lucide-react';

export default function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="group flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-extrabold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <LoaderCircle size={18} className="animate-spin" /> : <>{children}<ArrowRight size={18} className="transition group-hover:translate-x-0.5" /></>}
    </button>
  );
}
