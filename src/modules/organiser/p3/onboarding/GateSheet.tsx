import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sheet } from '../screens/Sheet';
import { fetchOnboardingStatus, onboardingStatusKey } from './statusQuery';
import { GATE_COPY, gateView } from './gateModel';

/**
 * A1 "A few details first" (plan Appendix A1), as a sheet over whatever screen was refused, so "Not now"
 * leaves the person exactly where they were. It re-reads the ONE status query (Home's banner and You share
 * the key) on open: a refusal means what the cache holds may be stale. Loaded only when a refusal happens.
 */
export default function GateSheet({ organiserId, onClose, fetcher = fetchOnboardingStatus }: {
  organiserId: string | null;
  onClose: () => void;
  fetcher?: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: onboardingStatusKey(user?.id),
    queryFn: fetcher,
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
  const view = gateView(q.isSuccess ? q.data : undefined, organiserId);
  const admin = view.kind === 'admin';
  // An admin is never routed here (the server never refuses one): close without drawing anything.
  useEffect(() => {
    if (admin) onClose();
  }, [admin, onClose]);
  if (admin) return null;
  return (
    <Sheet title={GATE_COPY.title} onClose={onClose}>
      <div data-testid="p3-gate">
        <p className="p3-plain" data-testid="p3-gate-body">{GATE_COPY.body}</p>
        {view.kind === 'unknown' && (q.isError || !user?.id) && (
          <div className="p3-stack-s p3-gap-t">
            <p className="p3-error" role="alert" data-testid="p3-gate-read-failed">{GATE_COPY.readFailed}</p>
            <button type="button" className="p3-btn p3-btn-line" onClick={() => void q.refetch()} data-testid="p3-gate-retry">{GATE_COPY.retry}</button>
          </div>
        )}
        {view.kind === 'unknown' && !q.isError && !!user?.id && (
          <ul className="p3-card p3-tight p3-list p3-gap-t" aria-busy="true" data-testid="p3-gate-loading">
            <li className="p3-gate-row p3-mut">{GATE_COPY.loading}</li>
          </ul>
        )}
        {view.kind === 'left' && (
          <>
            <p className="p3-note p3-gap-t" data-testid="p3-gate-count">{view.count}</p>
            <ul className="p3-card p3-tight p3-list" data-testid="p3-gate-rows">
              {view.rows.map((r) => <li key={r} className="p3-gate-row">{r}</li>)}
            </ul>
          </>
        )}
        {view.kind === 'done' && <p className="p3-note p3-gap-t" data-testid="p3-gate-done">{GATE_COPY.done}</p>}
      </div>
      {/* sticky, so Continue and Not now stay in view however many rows are listed (prod max 10) */}
      <div className="p3-sheet-foot"><div className="p3-stack-s">
        {view.kind === 'done' ? (
          <button type="button" className="p3-btn" onClick={onClose} data-testid="p3-gate-close">{GATE_COPY.close}</button>
        ) : (
          <>
            <Link className="p3-btn p3-gate-go" to={view.to} onClick={onClose} data-testid="p3-gate-go">{GATE_COPY.go}</Link>
            <button type="button" className="p3-btn p3-btn-line" onClick={onClose} data-testid="p3-gate-not-now">{GATE_COPY.notNow}</button>
          </>
        )}
      </div></div>
    </Sheet>
  );
}
