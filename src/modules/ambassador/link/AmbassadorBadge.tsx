import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** The ONE label and note for the badge; every profile render uses this component. */
export const AMBASSADOR_LABEL = 'Ambassador';
export const AMBASSADOR_NOTE = 'Helps new organisers join their city';

/** True only on an explicit `true`; an error, null or throw is false (no badge, no error UI). */
export async function fetchIsAmbassador(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_city_ambassador_public_v1', { p_user_id: userId });
    return !error && data === true;
  } catch {
    return false;
  }
}

export function AmbassadorBadge({ userId }: { userId: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(false);
  useEffect(() => {
    let live = true;
    setData(false);
    if (userId) void fetchIsAmbassador(userId).then((v) => { if (live) setData(v); });
    return () => { live = false; };
  }, [userId]);
  if (!data) return null;
  return (
    <div data-testid="ambassador-badge" className="min-w-0 max-w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] max-w-full items-center"
      >
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
          {AMBASSADOR_LABEL}
        </span>
      </button>
      {open ? <p data-testid="ambassador-note" className="text-sm text-foreground/80">{AMBASSADOR_NOTE}</p> : null}
    </div>
  );
}
