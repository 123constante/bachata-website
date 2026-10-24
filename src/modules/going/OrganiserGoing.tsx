import { Link } from 'react-router-dom';
import { emitProfileView } from '@/lib/profileViewEmit';
import { hrefFor } from '@/lib/searchEntities';
import { GOING_COPY, moreSentence, personLinkLabel } from './goingCopy';
import type { MyEventGoingNight } from './goingRpc';
import { organiserNightView, type OrganiserGoingView } from './goingState';
import { ORGANISER_GOING_THEME, type GoingTheme } from './goingTheme';
import { GoingFace } from './GoingPeople';

/*
 * The organiser's "who is going" parts (Going P3). Self-contained: no routing,
 * no page placement, no sheet chrome -- the organiser rebuild mounts them in
 * its own slots (Home "Next up", the date sheet row, Stats "By event") and owns
 * opening its sheet. Every prop that carries a night takes the
 * get_my_event_going_v1 night EXACTLY as the RPC returns it (MyEventGoingNight).
 * Sizes are explicit px: the public site's html font-size makes rem render ~16% small.
 */

/** The tap target floor (explicit px). */
export const ORGANISER_GOING_TAP_PX = 44;

const Chevron = ({ color }: { color: string }) => (
  <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} className="shrink-0">
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type SummaryProps = {
  night: MyEventGoingNight;
  /** The count line alone -- the only variant today, and the default. */
  variant?: 'compact';
  /** Tap on the count (open the list). No navigation of its own; absent = plain text. */
  onOpen?: (night: MyEventGoingNight) => void;
  theme?: GoingTheme;
};

/**
 * "12 going" for ONE night. A button (>= 44px) only when there is a list to
 * open AND the host passed onOpen; 0 going and a cancelled night with nobody
 * are plain text ("Nobody has said they're going yet" / "This date is
 * cancelled" -- never "0 going").
 */
export const GoingNightSummary = ({ night, variant = 'compact', onOpen, theme = ORGANISER_GOING_THEME }: SummaryProps) => {
  const v = organiserNightView(night);
  const color = v.kind === 'some' ? theme.fg : theme.muted;
  const text = (
    <span className="min-w-0 text-[15px] leading-[20px]" style={{ color, fontWeight: v.kind === 'some' ? 600 : 400, overflowWrap: 'anywhere' }}>
      {v.text}
    </span>
  );
  if (v.openable && onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(night)}
        aria-haspopup="dialog"
        aria-label={v.when ? `${v.text}, ${v.when}. ${GOING_COPY.orgSheetTitle}` : `${v.text}. ${GOING_COPY.orgSheetTitle}`}
        className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[12px] border-0 bg-transparent p-0 text-left"
        style={{ minHeight: ORGANISER_GOING_TAP_PX, minWidth: ORGANISER_GOING_TAP_PX, font: 'inherit', cursor: 'pointer' }}
        data-testid="going-night-summary"
        data-kind={v.kind}
        data-variant={variant}
      >
        {text}
        <Chevron color={theme.muted} />
      </button>
    );
  }
  return (
    <p
      className="m-0 flex min-w-0 items-center"
      style={{ minHeight: ORGANISER_GOING_TAP_PX }}
      data-testid="going-night-summary"
      data-kind={v.kind}
      data-variant={variant}
    >
      {text}
    </p>
  );
};

type SheetProps = {
  night: MyEventGoingNight;
  theme?: GoingTheme;
  /** For the profile-view telemetry of a tapped person. */
  eventId?: string | null;
  /** The list scrolls inside this height (200 people never push the sheet past the screen). */
  listMaxHeight?: string;
};

const ROW = 'flex w-full items-center gap-3 px-1 py-2';

/**
 * The full list for ONE night, for inside the host's sheet: a "Who's going"
 * heading, the night (starts_at_local as stored, full weekday), then every
 * person -- first name, photo only when photo_url is set (else the initials
 * circle), a link to the dancer page only when dancer_profile_id is set. The
 * list scrolls inside the sheet.
 */
export const GoingPeopleSheet = ({
  night,
  theme = ORGANISER_GOING_THEME,
  eventId = null,
  listMaxHeight = 'min(60vh, 520px)',
}: SheetProps) => {
  const v = organiserNightView(night);
  return (
    <section data-testid="going-people-sheet" data-kind={v.kind} aria-label={GOING_COPY.orgSheetTitle}>
      <h3 className="m-0 text-[20px] font-semibold leading-[26px]" style={{ color: theme.fg }}>
        {GOING_COPY.orgSheetTitle}
      </h3>
      {v.when && (
        <p className="m-0 mt-1 text-[14px] leading-[20px]" style={{ color: theme.muted }} data-testid="going-sheet-when">
          {v.when}
        </p>
      )}
      <p
        className="m-0 mt-2 text-[15px] leading-[20px]"
        style={{ color: v.kind === 'some' ? theme.fg : theme.muted, fontWeight: v.kind === 'some' ? 600 : 400 }}
        data-testid="going-sheet-count"
      >
        {v.text}
      </p>
      {night.people.length > 0 && (
        <ul
          className="m-0 mt-2 list-none p-0"
          style={{ maxHeight: listMaxHeight, overflowY: 'auto', overscrollBehavior: 'contain' }}
          aria-label={v.text}
          data-testid="going-sheet-list"
        >
          {night.people.map((p, i) => {
            const inner = (
              <>
                <GoingFace person={p} size={40} theme={theme} />
                <span className="min-w-0 flex-1 text-[16px] font-medium leading-[22px]" style={{ color: theme.fg, overflowWrap: 'anywhere' }}>
                  {p.first_name}
                </span>
              </>
            );
            return (
              <li key={`${p.dancer_profile_id ?? 'n'}-${i}`} style={i > 0 ? { borderTop: `1px solid ${theme.hairline}` } : undefined}>
                {p.dancer_profile_id ? (
                  <Link
                    to={hrefFor('dancer', p.dancer_profile_id)}
                    className={ROW}
                    style={{ minHeight: 56, color: 'inherit', textDecoration: 'none' }}
                    aria-label={personLinkLabel(p.first_name)}
                    data-testid="going-sheet-link"
                    onClick={() =>
                      emitProfileView({ personId: p.dancer_profile_id as string, profileType: 'dancer', context: 'organiser-going', eventId })
                    }
                  >
                    {inner}
                    <Chevron color={theme.muted} />
                  </Link>
                ) : (
                  <div className={ROW} style={{ minHeight: 56 }} data-testid="going-sheet-person">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {v.extra > 0 && (
        <p className="m-0 mt-2 text-[14px] leading-[20px]" style={{ color: theme.muted }} data-testid="going-sheet-more">
          {moreSentence(v.extra)}
        </p>
      )}
    </section>
  );
};

type LoadStateProps = {
  /** useMyEventGoing's view. */
  view: OrganiserGoingView;
  /** The error state's Try again (useMyEventGoing's retry). Required: an error is never a dead end. */
  onRetry: () => void;
  /** The signed-out state's Sign in again; absent = the words alone say what to do. */
  onSignIn?: () => void;
  /** A retry is in flight. */
  busy?: boolean;
  theme?: GoingTheme;
};

/**
 * The read's own states in words: loading, error + Try again, and the three
 * refusals (signed out, event not found, not an organiser of it). Renders
 * nothing when the read is ready (the nights render) or the switch is off.
 */
export const GoingLoadState = ({ view, onRetry, onSignIn, busy = false, theme = ORGANISER_GOING_THEME }: LoadStateProps) => {
  if (view.state === 'off' || view.state === 'ready' || !view.words) return null;
  const handler = view.action?.kind === 'retry' ? onRetry : view.action?.kind === 'sign_in' ? onSignIn : undefined;
  return (
    <div
      role={view.state === 'loading' ? 'status' : view.state === 'error' ? 'alert' : undefined}
      aria-live={view.state === 'loading' ? 'polite' : undefined}
      className="flex flex-wrap items-center gap-x-3"
      style={{ minHeight: ORGANISER_GOING_TAP_PX }}
      data-testid="going-load-state"
      data-state={view.state}
    >
      <p className="m-0 min-w-0 flex-1 text-[15px] leading-[20px]" style={{ color: theme.muted, overflowWrap: 'anywhere' }}>
        {view.words}
      </p>
      {view.action && handler && (
        <button
          type="button"
          onClick={handler}
          disabled={busy}
          className="rounded-[15px] px-[14px] text-[15px] font-semibold"
          style={{ minHeight: ORGANISER_GOING_TAP_PX, ...theme.ghost, cursor: busy ? 'wait' : 'pointer' }}
          data-testid="going-load-action"
        >
          {view.action.label}
        </button>
      )}
    </div>
  );
};
