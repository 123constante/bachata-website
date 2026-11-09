import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { continueAsLanding } from '@/lib/auth-otp-routing';
import {
  APP_HOME_PATH,
  APP_WELCOME_PATH,
  LIVE_TONIGHT,
  eventDayLanding,
  liveTonightIds,
  type AreaPage,
  type ChooserLanding,
  type ProfileSide,
} from '@/lib/accountRouting';
import { isOrganiserAreaPath } from '@/lib/organiserAreaHome';
import { AccountShell } from '@/modules/areas/shared/AccountShell';
import { PAGE_TITLE } from '@/modules/areas/shared/typeScale';
import { AREA_HREF, AREA_NAME } from '@/modules/areas/home/areaStatus';
import { fetchMyRoles, myRolesQueryKey, type RoleRow } from '@/modules/areas/home/rolesApi';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { useProfileSides } from './useProfileSides';

/** L18: the switch promise, only where it is true. */
export const SWITCH_HINT = 'You can switch later by tapping your picture, top right.';

/**
 * Lands in a shell that carries the Switch-profile picture: the dancer app or the organiser area.
 * Not the dancer setup: focus mode (audit H5) hides the picture there until the profile is done.
 */
const hasSwitcher = (to: string): boolean => {
  const p = to.split(/[?#]/, 1)[0].toLowerCase();
  if (p === APP_WELCOME_PATH) return false;
  const app = APP_HOME_PATH.slice(0, APP_HOME_PATH.lastIndexOf('/'));
  return p === app || p.startsWith(`${app}/`) || isOrganiserAreaPath(p);
};

/** The hint when EVERY button lands where the picture is; none otherwise (no text points at a missing control). */
export const switchHint = (sides: readonly Pick<ProfileSide, 'to'>[]): string | null =>
  sides.length > 0 && sides.every((s) => hasSwitcher(s.to)) ? SWITCH_HINT : null;

/** Slice 1b: the teacher and DJ pages the person holds (my_roles_v1 active rows), in a fixed order. */
export const areaPagesOf = (rows: readonly RoleRow[] | null | undefined): AreaPage[] | null | undefined => {
  if (rows === undefined || rows === null) return rows;
  const held = new Set(rows.filter((r) => r.active).map((r) => r.role));
  return (['teacher', 'dj'] as const).filter((r) => held.has(r)).map((role) => ({ role, key: role, to: AREA_HREF[role] }));
};

const rowClass = (primary: boolean) =>
  `flex min-h-[72px] w-full items-center gap-[12px] rounded-[var(--r-card)] border p-[16px] ${
    primary ? 'border-[var(--gold)] bg-[var(--btn)] text-[var(--btnfg)]' : 'border-[var(--line)] bg-[var(--card)] text-[var(--fg)]'
  }`;

/**
 * /account/continue -- where a sign-in with no returnTo lands (lib/auth-otp-routing).
 * lib/accountRouting's signInLanding() decides: one side -> straight there
 * (replace, so Back does not return here); two or more -> "Continue as...", one
 * large button per side, organisers first and visually primary. Shown on every
 * sign-in; never to a single-side person.
 * While P3 is live (slice 1b) eventDayLanding widens it: teacher and DJ pages are entries too, a
 * live event today on one organiser page lands there, and two live pages are both marked "Live tonight".
 */
/** Flag on (P3 live): the teacher / DJ entries and the live-tonight facts join the landing. */
const ContinueAsLive = () => {
  const { user } = useAuth();
  const { facts, state } = useProfileSides();
  const enabled = Boolean(user?.id);
  // Same keys and fetchers as useProfileSides / the switcher, so these are one cache entry each.
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled });
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles, enabled, retry: false });
  const live = useMemo(() => liveTonightIds(home.data ?? (home.isError ? null : undefined)), [home.data, home.isError]);
  const areas = areaPagesOf(roles.data ?? (roles.isError ? null : undefined));
  const landing = eventDayLanding({
    base: continueAsLanding(facts, true),
    sides: state.status === 'ready' ? state.sides : [],
    areas,
    liveTonight: live,
    p3Live: true,
  });
  return <ContinueAsView landing={landing} />;
};

/** Flag off: today's landing, no new reads (A8). */
const ContinueAsToday = () => {
  const { facts } = useProfileSides();
  const landing = eventDayLanding({ base: continueAsLanding(facts, false), sides: [], areas: [], liveTonight: null, p3Live: false });
  return <ContinueAsView landing={landing} />;
};

// F4: a brand-new organiser lands on P3's Welcome while P3 is live (lib/auth-otp-routing newOrganiserLanding).
// Waiting on an open access request with no page: P3's Welcome too while P3 is live (owner decision 2026-10-30).
export const ContinueAsScreen = ({ p3Live = false }: { p3Live?: boolean }) => (p3Live ? <ContinueAsLive /> : <ContinueAsToday />);

const ContinueAsView = ({ landing }: { landing: ChooserLanding }) => {
  if (landing.kind === 'go') return <Navigate to={landing.to} replace />;
  if (landing.kind === 'wait') {
    return (
      <AccountShell>
        <div aria-busy="true" data-testid="continue-as-loading">
          <p className="text-[14px] text-[var(--mut)]">Signing you in&hellip;</p>
        </div>
      </AccountShell>
    );
  }
  const hint = switchHint([...landing.sides, ...landing.areas]);
  return (
    <AccountShell>
    <div data-testid="continue-as">
      <h1 className={PAGE_TITLE}>Continue as&hellip;</h1>
      {hint && (
        <p className="mt-[4px] text-[14px] text-[var(--mut)]" data-testid="continue-as-hint">
          {hint}
        </p>
      )}
      <ul className="mt-[12px] space-y-[12px]">
        {landing.sides.map((side) => {
          const primary = side.kind === 'organiser';
          const tonight = side.kind === 'organiser' && landing.liveTonight.has(side.organiserId);
          return (
            <li key={side.key}>
              <Link to={side.to} replace data-testid={`continue-as-${side.key}`} className={rowClass(primary)}>
                <SideAvatar side={side} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">{sideTitle(side)}</span>
                  <span className={`block text-[14px] ${primary ? 'opacity-90' : 'text-[var(--mut)]'}`}>{sideKind(side)}</span>
                </span>
                {tonight && (
                  <span
                    className="shrink-0 rounded-[8px] bg-[var(--ok-bg)] px-[8px] py-[2px] text-[12px] font-semibold text-[var(--ok-fg)]"
                    data-testid="continue-as-live-tonight"
                  >
                    {LIVE_TONIGHT}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        {landing.areas.map((area) => (
          <li key={area.key}>
            <Link to={area.to} replace data-testid={`continue-as-${area.key}`} className={rowClass(false)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{AREA_NAME[area.role]}</span>
                <span className="block text-[14px] text-[var(--mut)]">Your {AREA_NAME[area.role]} page</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
    </AccountShell>
  );
};

/**
 * `p3Live` comes from the route (AnimatedRoutes: organiserP3 AND organiserSelfServe): importing the flags module
 * here split a chunk onto the /auth/callback and /app/* first loads (perf-budgets chunk ratchet).
 */
const ContinueAsPage = ({ p3Live = false }: { p3Live?: boolean }) => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <ContinueAsScreen p3Live={p3Live} />
    </AuthGuard>
  );
};

export default ContinueAsPage;
