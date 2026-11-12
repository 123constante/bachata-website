import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/modules/organiser/ui';
import { claimMyDancerProfile, type ClaimOutcome } from '@/lib/claimMyDancerProfile';
import { invalidateMyPersonaCaches } from '@/lib/myPersona';
import { NO_PROFILE_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import { LINK_GHOST_SM } from '../blocks';
import { buttonStyle } from '../nights/nightsStyles';
import { CLAIM_COPY } from './homeModel';

/** D4: no dancer profile on this account. The button re-runs the existing no-arg claim and shows the answer. */
export const ClaimCard = ({ run = claimMyDancerProfile, reload = () => window.location.reload() }: { run?: () => Promise<ClaimOutcome>; reload?: () => void }) => {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = outcome ? CLAIM_COPY[outcome.status] : null;
  const onClaim = async () => {
    setBusy(true);
    try {
      const o = await run();
      setOutcome(o);
      if (o.status === 'linked' || o.status === 'already_linked') void invalidateMyPersonaCaches(qc);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid="home-a-unclaimed">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Welcome</h1>
        <p className="da-muted" style={{ margin: '4px 0 0', fontSize: 15 }}>We may already have a page for you.</p>
      </div>
      <Card variant="padded" role="status" testId="home-claim-card">
        <div style={{ display: 'grid', gap: 12 }}>
          {copy ? (
            <>
              <b style={{ fontSize: 18 }} data-testid="claim-title">{copy.title}</b>
              <p className="da-muted" style={{ margin: 0, fontSize: 15 }} data-testid="claim-body">{copy.body}</p>
            </>
          ) : (
            <>
              <b style={{ fontSize: 18 }}>Claim your page</b>
              <p className="da-muted" style={{ margin: 0, fontSize: 15 }}>If the Bachata Calendar team made a page for the email you signed in with, this links it to you.</p>
            </>
          )}
          {(!outcome || outcome.status === 'unavailable') && (
            <button type="button" className="da-tap" disabled={busy} data-testid="claim-button" style={{ ...buttonStyle, border: 0 }} onClick={() => void onClaim()}>
              {busy ? 'Checking\u2026' : outcome ? 'Try again' : 'Claim your page'}
            </button>
          )}
          {(outcome?.status === 'linked' || outcome?.status === 'already_linked') && (
            <button type="button" className="da-tap" data-testid="claim-reload" style={{ ...buttonStyle, border: 0 }} onClick={reload}>Show my page</button>
          )}
          {outcome && outcome.status !== 'unavailable' && outcome.status !== 'linked' && outcome.status !== 'already_linked' && (
            <button type="button" className="da-tap" data-testid="claim-recheck" style={{ background: 'none', border: '1px solid var(--da-border)', borderRadius: 12, color: 'var(--da-text)', fontWeight: 700 }} onClick={() => void onClaim()}>Check again</button>
          )}
          {/* walk bug 1: the Message us control is always on the claim card (owner decision), not only after an answer */}
          <MessageUsLink message={NO_PROFILE_MESSAGE} className={LINK_GHOST_SM} />
        </div>
      </Card>
    </div>
  );
};

export default ClaimCard;
