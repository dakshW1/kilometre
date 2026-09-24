export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  // An Indian roadside kilometre stone: rounded orange top, plain base.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M8 29V13a8 8 0 0 1 16 0v16z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M9.1 13a6.9 6.9 0 0 1 13.8 0v1.6H9.1z" fill="#FF7A3D" />
      <path d="M12 20.5h8M12 24.5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 29h22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark className={dark ? 'text-white' : 'text-ink'} />
      <span className={`font-display text-[19px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Kilometre</span>
    </span>
  );
}
