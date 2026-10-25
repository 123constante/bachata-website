import { GOING_COPY, organiserTotalText } from './goingCopy';
import type { MyOrganiserGoingTotalResult } from './useMyOrganiserGoingTotal';
import { ORGANISER_GOING_THEME, type GoingTheme } from './goingTheme';
import { GoingLoadState, ORGANISER_GOING_TAP_PX } from './OrganiserGoing';

/*
 * The Stats total (mockup C3, R.stats: the second `card stat` of the `pair`).
 * The INSIDE of that card only -- the host owns the card. Pure: it takes
 * useMyOrganiserGoingTotal's result as props, so it needs no providers.
 * Sizes are explicit px: the public site's html font-size makes rem render ~16% small.
 */

/** Pass the hook's result whole: `<GoingTotalStat {...useMyOrganiserGoingTotal()} />`. */
type Props = MyOrganiserGoingTotalResult & {
  /** The signed-out state's Sign in again; absent = the words alone say what to do. */
  onSignIn?: () => void;
  theme?: GoingTheme;
};

/**
 * "7" over "going across 4 nights"; at 0 "No one going yet" plus what to do.
 * Loading, error (+ Try again) and signed out (+ Sign in again) are
 * GoingLoadState's -- the same words and controls as every organiser going read.
 * A failed re-read keeps the total, says it may be out of date and offers Try again.
 * Renders nothing while the going switch is off.
 */
export const GoingTotalStat = ({
  view,
  total,
  retry,
  fetching,
  refreshFailed,
  onSignIn,
  theme = ORGANISER_GOING_THEME,
}: Props) => {
  if (view.state === 'off') return null;
  if (view.state !== 'ready' || !total) {
    return (
      <div data-testid="going-total-stat" data-state={view.state}>
        <GoingLoadState view={view} onRetry={retry} onSignIn={onSignIn} busy={fetching} theme={theme} />
      </div>
    );
  }
  const t = organiserTotalText(total);
  return (
    <div data-testid="going-total-stat" data-state="ready" data-zero={t.figure === null}>
      {t.figure !== null ? (
        <>
          <div className="text-[30px] font-semibold leading-[33px]" style={{ color: theme.fg, overflowWrap: 'anywhere' }} data-testid="going-total-figure">
            {t.figure}
          </div>
          <div className="text-[14px] leading-[20px]" style={{ color: theme.muted }} data-testid="going-total-label">
            {t.label}
          </div>
        </>
      ) : (
        <>
          <div className="text-[18px] font-semibold leading-[24px]" style={{ color: theme.fg }} data-testid="going-total-figure">
            {t.label}
          </div>
          <p className="m-0 mt-1 text-[14px] leading-[20px]" style={{ color: theme.muted }} data-testid="going-total-hint">
            {t.hint}
          </p>
        </>
      )}
      {refreshFailed && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3" data-testid="going-total-stale">
          <p className="m-0 min-w-0 flex-1 text-[14px] leading-[20px]" style={{ color: theme.muted }}>
            {GOING_COPY.orgTotalStale}
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={fetching}
            className="rounded-[15px] px-[14px] text-[15px] font-semibold"
            style={{ minHeight: ORGANISER_GOING_TAP_PX, ...theme.ghost, cursor: fetching ? 'wait' : 'pointer' }}
            data-testid="going-total-retry"
          >
            {GOING_COPY.retry}
          </button>
        </div>
      )}
    </div>
  );
};
