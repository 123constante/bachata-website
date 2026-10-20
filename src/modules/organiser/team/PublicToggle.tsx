import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { fetchShownOnPublicTeam, publicTeamErrorMessage, publicTeamQueryKey, setShownOnPublicTeam } from './publicTeamApi';

export const PUBLIC_TOGGLE_LABEL = 'Show me on the public team';
export const PUBLIC_ON_NOTE = 'Visitors to your page see your name and photo in its team.';
export const PUBLIC_OFF_NOTE = 'Visitors do not see you in the team on your page. You still help run it.';
export const NO_PROFILE_NOTE = 'Finish your dancer profile first, then you can show on the public team.';

/**
 * The person's OWN row only (A-DB2): one switch, saying what visitors see. It
 * reads the public row, and changes it through organiser_team_set_public_v1;
 * a refusal keeps the switch where it was and says why.
 */
export function PublicToggle({ organiserId, profileId, onChanged }: { organiserId: string; profileId: string | null; onChanged?: (msg: string) => void }) {
  const qc = useQueryClient();
  const noteId = useId();
  const key = publicTeamQueryKey(organiserId, profileId);
  const shown = useQuery({ queryKey: key, queryFn: () => fetchShownOnPublicTeam(organiserId, profileId!), enabled: !!profileId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = shown.data === true;
  const unknown = !profileId || shown.data === undefined;
  const reason = !profileId ? NO_PROFILE_NOTE : shown.isError ? 'Whether you show on the team did not load. Reload the page.' : null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const status = await setShownOnPublicTeam(organiserId, !on);
      const next = status === 'unchanged' ? on : status === 'public';
      qc.setQueryData(key, next);
      void qc.invalidateQueries({ queryKey: ['organiser-lineup', organiserId] });
      onChanged?.(next ? 'You now show on the public team.' : 'You no longer show on the public team.');
    } catch (e) {
      setError(publicTeamErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-[4px] px-[16px] py-[8px]" data-testid="team-public">
      <div className="flex min-h-[44px] items-center gap-[12px]">
        <span id={`${noteId}-l`} className="flex-1 text-[15px] text-[var(--fg)]">{PUBLIC_TOGGLE_LABEL}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${noteId}-l`}
          aria-describedby={noteId}
          disabled={busy || unknown || shown.isError}
          onClick={() => void toggle()}
          data-testid="team-public-switch"
          className={cn('relative h-[44px] w-[64px] shrink-0 rounded-full border transition-colors duration-300 motion-reduce:transition-none disabled:opacity-60',
            on ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-[var(--line-strong)] bg-[var(--card2)]')}
        >
          <span aria-hidden="true" className={cn('absolute top-[5px] h-[32px] w-[32px] rounded-full bg-[var(--fg)] transition-[left] duration-300 motion-reduce:transition-none', on ? 'left-[27px]' : 'left-[5px]')} />
        </button>
      </div>
      <p id={noteId} className="text-[13px] text-[var(--mut)]" data-testid="team-public-note">{reason ?? (on ? PUBLIC_ON_NOTE : PUBLIC_OFF_NOTE)}</p>
      {error && <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid="team-public-error">{error}</p>}
    </div>
  );
}
