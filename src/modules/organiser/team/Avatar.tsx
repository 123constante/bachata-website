import { useState } from 'react';
import { cn } from '@/lib/utils';
import { initials } from '../ui';

/** A person's photo, or their initials when there is none or it fails to load: never a blank circle. */
export function Avatar({ name, photoUrl, size = 40, className }: { name: string; photoUrl?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const px = { width: size, height: size };
  if (photoUrl && !broken) {
    return <img src={photoUrl} alt="" aria-hidden="true" loading="lazy" style={px} onError={() => setBroken(true)} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <span aria-hidden="true" style={px} data-testid="avatar-initials" className={cn('flex shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[14px] font-bold text-[var(--fg)]', className)}>
      {initials(name)}
    </span>
  );
}
