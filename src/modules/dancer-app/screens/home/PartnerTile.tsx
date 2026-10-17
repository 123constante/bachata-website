import { useFeatureInterest } from '../../api/useFeatureInterest';
import { toDancerError } from '../../api/errors';
import { buttonStyle } from '../nights/nightsStyles';

export const PARTNER_TITLE = 'Partner search: coming soon';
export const PARTNER_BODY = 'Find someone to practise and dance with.';
export const PARTNER_ASK = 'Tell me when it\u2019s ready';
export const PARTNER_DONE = 'We\u2019ll tell you';
export const PARTNER_DONE_BODY = 'We\u2019ll let you know the moment partner search opens.';

/** "Tell me when partner search is ready": one tap, then the button is off and says why. */
export const PartnerTile = () => {
  const { registered, register, loading } = useFeatureInterest('partner_search');
  const failed = register.isError ? toDancerError(register.error).message : null;
  return (
    <div className="da-card" data-testid="tile-partner" style={{ display: 'grid', gap: 6, padding: 14 }}>
      <b style={{ fontSize: 14 }}>{PARTNER_TITLE}</b>
      <span className="da-muted" style={{ fontSize: 13 }}>{registered ? PARTNER_DONE_BODY : PARTNER_BODY}</span>
      <button
        type="button"
        className="da-tap"
        data-testid="partner-notify"
        disabled={registered || loading || register.isPending}
        style={{ ...buttonStyle, opacity: registered || loading || register.isPending ? 0.7 : 1 }}
        onClick={() => register.mutate()}
      >
        {registered ? PARTNER_DONE : register.isPending ? 'Saving\u2026' : PARTNER_ASK}
      </button>
      {failed && <span role="alert" data-testid="partner-error" style={{ fontSize: 13, color: 'var(--da-danger)' }}>{failed}</span>}
    </div>
  );
};
