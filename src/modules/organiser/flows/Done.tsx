import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { londonTodayKey } from '@/lib/londonDate';
import { useOrgSurface } from '@/modules/organiser/shell/surface';
import { GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { useEventWorkspace } from '@/modules/organiser/events/eventsApi';
import { lifecycleRows } from '@/modules/organiser/events/lifecycleModel';
import { GO_BACK_LABEL, NEXT_LABEL, backToEventLabel, readDoneState, returnToSeriesId } from './doneState';
import { ItsLiveOffer } from './ItsLiveOffer';

/** C38: the public page of the event this flow changed: a link when live, off with the reason for a draft. */
function SeeItLive({ seriesId }: { seriesId: string }) {
  const ws = useEventWorkspace(seriesId);
  const see = ws.data ? lifecycleRows(ws.data, londonTodayKey()).seeLive : null;
  if (!see) return null;
  return see.href ? (
    <a href={see.href} target="_blank" rel="noopener noreferrer" data-testid="org-done-live"
      className="flex min-h-[48px] items-center justify-center gap-2 text-[15px] font-semibold text-[var(--gold)]">
      See it live <ExternalLink aria-hidden="true" className="h-[16px] w-[16px]" />
    </a>
  ) : (
    <div>
      {/* Off, but reachable with Tab and read with its reason (PAR-B N9). */}
      <a role="link" aria-disabled="true" tabIndex={0} aria-describedby="org-done-live-reason" data-testid="org-done-live"
        className="flex min-h-[48px] cursor-not-allowed items-center justify-center text-[15px] text-[var(--mut)]">See it live</a>
      <p id="org-done-live-reason" className="text-center text-[13px] text-[var(--mut)]" data-testid="org-done-live-reason">{see.reason}</p>
    </div>
  );
}

/**
 * W2 walk fix 10: the primary way back to where the editor was opened from: an
 * event by its name; any other organiser screen as plain "Go back", never a name
 * the button does not go to.
 */
function BackToEvent({ back }: { back: string }) {
  const navigate = useNavigate();
  const target = returnToSeriesId(back);
  const ws = useEventWorkspace(target ?? undefined);
  return (
    <PrimaryButton testId="org-done-back" onClick={() => navigate(back, { replace: true })}>
      {target ? backToEventLabel(ws.data?.series.name) : GO_BACK_LABEL}
    </PrimaryButton>
  );
}

/**
 * The one Done screen every flow ends on (D29, D51): the confirmation line and
 * ONE button "Back to Home", plus the `next` button when the flow gives one
 * (D61), and "See it live" when the flow names an event (C38). No Undo (D49).
 * A reload has no router state, so it goes Home. Opened with a returnTo (`back`,
 * W2 walk fix 10), "Back to <event name>" is the primary and Home comes second;
 * a `next` to that same place is not shown twice.
 * The frame and the hub ("Back to Home") come from the surface: in P3 (W4a fix 1)
 * Done is P3's frame and its hub button is "Back to You".
 */
export default function Done() {
  const location = useLocation();
  const navigate = useNavigate();
  const { Shell, hub } = useOrgSurface();
  const state = readDoneState(location.state);
  if (!state) return <Navigate to={hub.to} replace />;
  const toHub = () => navigate(hub.to, { replace: true });
  return (
    <Shell title={state.title}>
      <div className="flex flex-col gap-3 p-3" data-testid="org-done">
        <p className="flex items-center gap-2 text-[16px] font-bold" role="status" data-testid="org-done-message">
          <CheckCircle2 aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--ok-fg)]" />
          {state.message}
        </p>
        {state.back ? (
          <>
            <BackToEvent back={state.back} />
            <GhostButton testId="org-done-home" onClick={toHub}>
              Back to {hub.label}
            </GhostButton>
          </>
        ) : (
          <PrimaryButton testId="org-done-home" onClick={toHub}>
            Back to {hub.label}
          </PrimaryButton>
        )}
        {state.next && state.next !== state.back && (
          <GhostButton testId="org-done-next" onClick={() => navigate(state.next as string, { replace: true })}>
            {state.nextLabel ?? NEXT_LABEL}
          </GhostButton>
        )}
        {state.seriesId && <SeeItLive seriesId={state.seriesId} />}
        {state.offer && <ItsLiveOffer roles={state.offer} />}
      </div>
    </Shell>
  );
}
