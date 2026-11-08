import { useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** The ONE label and note for the badge; every profile render uses this component. */
export const AMBASSADOR_LABEL = 'Ambassador';
export const AMBASSADOR_NOTE = 'Helps new organisers join their city';
/** The ONE function the badge asks. It takes a dancer_profiles id (the id every
 *  public person, DJ and teacher page carries) and is true only for a CLAIMED,
 *  non-archived profile whose claimer is a city ambassador. */
export const AMBASSADOR_RPC = 'is_claimed_profile_ambassador_v1';

/** True only on an explicit `true`; an error, null or throw is false (no badge, no error UI). */
export async function fetchIsAmbassador(profileId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(AMBASSADOR_RPC, { p_profile_id: profileId });
    return !error && data === true;
  } catch {
    return false;
  }
}

export function AmbassadorBadge({ profileId }: { profileId: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const [data, setData] = useState(false);
  useEffect(() => {
    let live = true;
    setData(false);
    if (profileId) void fetchIsAmbassador(profileId).then((v) => { if (live) setData(v); });
    return () => { live = false; };
  }, [profileId]);
  if (!data) return null;
  return (
    <div data-testid="ambassador-badge" className="min-w-0 max-w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={noteId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] max-w-full items-center"
      >
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
          {AMBASSADOR_LABEL}
        </span>
      </button>
      {open ? <p id={noteId} data-testid="ambassador-note" className="text-sm text-foreground/80">{AMBASSADOR_NOTE}</p> : null}
    </div>
  );
}
