import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { claimMyDancerProfile, type ClaimOutcome } from '@/lib/claimMyDancerProfile';
import { invalidateMyPersonaCaches } from '@/lib/myPersona';
import { LINK_GHOST_SM } from '../blocks';
import { MessageUsLink } from '../me/ui';
import { NO_PROFILE_MESSAGE } from '../../api/messageUs';
import { CLAIM_BUTTON, CLAIM_COPY, CLAIM_DISMISS, claimView } from './homeModel';

/**
 * D4: a signed-in person with no linked profile. The button re-runs the same no-arg
 * claim_my_dancer_profile_v1() as sign-in (owner decision, admin 1534) and shows the status it
 * returns. "Not me" is the one dismissal. No DB change.
 */
/** `onLinked` resolves true once the refetch has FOUND the profile; false = cache lag, so we keep a Reload. */
export const ClaimYourPage = ({ onLinked, onDismiss, dismissed = false }: { onLinked: () => Promise<boolean | void> | boolean | void; onDismiss: () => void; dismissed?: boolean }) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null);
  const [notLoaded, setNotLoaded] = useState(false);
  const view = outcome ? claimView(outcome.status) : null;
  const copy = view ? CLAIM_COPY[view] : null;
  // Success copy only once the profile has really loaded; otherwise a plain reload line.
  const linkedPending = view === 'linked' && notLoaded;
  const success = !!(copy && copy.ok) && !linkedPending;

  const run = async () => {
    setBusy(true);
    const result = await claimMyDancerProfile();
    setOutcome(result);
    if (claimView(result.status) === 'linked') {
      await invalidateMyPersonaCaches(queryClient).catch(() => undefined);
      const found = await Promise.resolve(onLinked()).catch(() => false);
      setNotLoaded(found === false);
    }
    setBusy(false);
  };

  return (
    <div data-testid="claim-your-page" style={{ display: 'grid', gap: 8 }}>
      {dismissed ? (
        <b>We can&rsquo;t find a dancer profile for you yet.</b>
      ) : (
      <b>{linkedPending ? 'Almost there' : copy ? copy.title : 'We may have a page made for you'}</b>
      )}
      {!dismissed && <p style={{ margin: 0, fontSize: 14 }} role="status" data-testid="claim-status">
        {linkedPending ? 'We linked your page, but it has not loaded yet. Reload to see it.' : copy ? copy.body : 'If the Bachata Calendar team made a page for your email, claim it here.'}
      </p>}
      {!dismissed && (!copy || copy.retry) && (
        <button type="button" className="da-tap" disabled={busy} onClick={() => void run()} data-testid="claim-button"
          style={{ minHeight: 52, borderRadius: 12, border: 0, fontWeight: 700, fontSize: 16, background: 'var(--btn)', color: 'var(--btnfg)' }}>
          {busy ? 'Checking\u2026' : copy ? 'Try again' : CLAIM_BUTTON}
        </button>
      )}
      {linkedPending && (
        <button type="button" className="da-tap" onClick={() => window.location.reload()} data-testid="claim-reload"
          style={{ minHeight: 52, borderRadius: 12, border: 0, fontWeight: 700, fontSize: 16, background: 'var(--btn)', color: 'var(--btnfg)' }}>
          Reload
        </button>
      )}
      {!success && <MessageUsLink message={NO_PROFILE_MESSAGE} className={LINK_GHOST_SM} />}
      {!dismissed && !outcome && (
        <button type="button" className="da-tap" onClick={onDismiss} data-testid="claim-dismiss"
          style={{ background: 'none', border: '1px solid var(--da-border)', borderRadius: 12, color: 'inherit', minHeight: 44, fontWeight: 700 }}>
          {CLAIM_DISMISS}
        </button>
      )}
    </div>
  );
};
