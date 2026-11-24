import { useNavigate } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { useStripe } from '../tickets/data';
import { P3_TICKET_PATHS } from '../tickets/paths';
import { r4StripeCardOf } from './r4StripeCardModel';

/** One outlined card (look A) saying where payouts stand. Renders nothing when connected, for other roles, or flag off. */
export function StripeStatusCard({ organiserId, role, hasNight = true }: { organiserId: string | undefined; role: string | null | undefined; hasNight?: boolean }) {
  const navigate = useNavigate();
  const { query } = useStripe(flags.stripeNudgeV2 ? organiserId : undefined);
  const m = r4StripeCardOf({ flagOn: flags.stripeNudgeV2, role, loaded: query.isSuccess, hasNight, row: query.data });
  if (!m) return null;
  return (
    <div className="r4-card" data-testid="stripe-status-card" data-kind={m.kind}
      style={{ border: '1px solid #C2410C', borderRadius: 8, padding: 12, background: '#FFFFFF' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }} data-testid="stripe-card-title">{m.title}</div>
      {m.body && <p style={{ fontSize: 14, margin: '4px 0 12px' }} data-testid="stripe-card-body">{m.body}</p>}
      {m.pct !== null && (
        <div role="img" aria-label={`${m.pct}% done`} data-testid="stripe-card-bar" style={{ height: 6, borderRadius: 3, background: '#E9E9E9', margin: '8px 0 12px', overflow: 'hidden' }}>
          <div style={{ width: `${m.pct}%`, height: 6, background: '#C2410C' }} />
        </div>
      )}
      <button type="button" className="r4-btn r4-btn-42" onClick={() => navigate(P3_TICKET_PATHS.getPaid(organiserId))} data-testid="stripe-card-go">{m.button}</button>
    </div>
  );
}
