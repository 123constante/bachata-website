import { Link } from 'react-router-dom';
import { Suspense, useState, type ReactNode } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { POSTPAY_TICKETS_TAB_ENABLED } from '@/lib/postpayTicketsTabFlag';
import { Card, SummaryRow } from '@/modules/organiser/ui';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { mainAction, nextStepCopy, profileName, roleCityLine } from './model';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, HIDDEN_STATE_WORD } from '../../copy/sharedCopy';
import { DisabledRow, LINK_GHOST_SM, LINK_PRIMARY, LinkRow, ScreenTitle, SectionTitle } from '../blocks';
import { Avatar, QueryGate, StrengthBar } from './ui';
import { DANCER_LAYOUT_C_ENABLED } from '../home/layoutCFlag';
import { ACCOUNT_SETTINGS_PATH, INSTALL_STEPS, SITE_HOME_PATH, detectPlatform, installOrder, optionsRows } from '../options/optionsModel';
import { Sheet } from '../options/optionsUi';
import FeedbackSheet from '../options/FeedbackSheet';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { toDancerError } from '../../api/errors';

/**
 * Layout C (brief dancer-layout-c-s2): Me carries the old Options rows under "Settings", in this
 * order. The rows themselves (labels, hrefs, organiser logic) are optionsRows; only the pick and the
 * order live here. Share my page and My page are on Home (slice S1); Sign out is in Account settings (S3).
 */
export const ME_SETTINGS_ORDER = ['account', 'areas', 'switch-organiser', 'feedback', 'help', 'install', 'terms', 'privacy'] as const;
export type MeSettingsRowId = (typeof ME_SETTINGS_ORDER)[number];
export type MeSettingsRow = { id: MeSettingsRowId; label: string; href?: string; sublabel?: string };

export const meSettingsRows = (otherRoles: readonly string[]): MeSettingsRow[] => {
  const opts = optionsRows({ other_roles: otherRoles, is_active: true });
  return ME_SETTINGS_ORDER.map((id) => {
    if (id === 'account') return { id, label: ACCOUNT_SETTINGS_LABEL, href: ACCOUNT_SETTINGS_PATH };
    const r = opts.find((o) => o.id === id)!;
    return { id, label: r.label, href: r.href, sublabel: r.sublabel };
  });
};

/** The preview twin (TICKET_TEASER) draws these two rows as its locked ghosts; everything else stays live. */
export type MeSettingsGhost = (row: { id: 'feedback' | 'install'; label: string }) => ReactNode;

/** "Settings" head, its rows, then the "Back to the Bachata Calendar website" card. Shared by Me and the preview Me. */
export const MeSettings = ({ otherRoles, ghost }: { otherRoles: readonly string[]; ghost?: MeSettingsGhost }) => {
  const [sheet, setSheet] = useState<'install' | 'feedback' | null>(null);
  const platform = detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints);
  return (
    <>
      <div data-testid="me-settings">
        <SectionTitle as="p" testId="me-settings-head">Settings</SectionTitle>
        <Card>
          {meSettingsRows(otherRoles).map((row) => {
            const testId = `me-set-${row.id}`;
            if (row.id === 'feedback' || row.id === 'install') {
              if (ghost) return <div key={row.id} data-testid={testId} data-locked="true">{ghost({ id: row.id, label: row.label })}</div>;
              const id = row.id;
              return <SummaryRow key={row.id} label={row.label} onPress={() => setSheet(id)} testId={testId} />;
            }
            return /^https?:/.test(row.href ?? '') ? (
              <LinkRow key={row.id} href={row.href} external label={row.label} testId={testId} />
            ) : (
              <LinkRow key={row.id} to={row.href} label={row.label} sublabel={row.sublabel} testId={testId} />
            );
          })}
        </Card>
      </div>
      <Card>
        <LinkRow to={SITE_HOME_PATH} label={<>&larr; Back to the Bachata Calendar website</>} testId="me-back-to-site" />
      </Card>
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}
      {sheet === 'install' && (
        <Sheet title="Add to my phone's home screen" testId="opt-install-sheet" onClose={() => setSheet(null)}>
          {installOrder(platform).map((k) => (
            <div key={k} data-testid={`opt-install-${k}`} className="mb-[10px]">
              <h3 className="mb-[4px] mt-0 text-[15px] font-bold">{INSTALL_STEPS[k].title}</h3>
              <ol className="m-0 pl-[20px] text-[14px]">
                {INSTALL_STEPS[k].steps.map((st) => <li key={st}>{st}</li>)}
              </ol>
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
};

// Lazy: the panel is flag-gated and must not add a first-load chunk to the app shell.
const AccountLinkPanel = lazyWithRetry(() => import('../tickets/AccountLinkPanel').then((m) => ({ default: m.AccountLinkPanel })));

/**
 * /app/me (mockup "5 Me"). Everything here is read from the server's own shape:
 * strength, next step and role/city line come from ./model (the same mapping Edit uses).
 * Badges and year-in-review render nothing in release 1a.
 */
const MeScreen = () => {
  const q = useMyDancerEdit();
  const gate = QueryGate({ q, id: 'me' });
  if (gate) {
    // Layout C: Options (where the no-profile way out lived) is gone, so Me keeps it: never trapped.
    const code = q.isError ? toDancerError(q.error).code : null;
    const stuck = DANCER_LAYOUT_C_ENABLED && (code === 'no_profile' || code === 'profile_mismatch');
    return <>{gate}{stuck && <NoProfileWayOut />}</>;
  }
  const p = q.data!;
  const action = mainAction(p);
  const hasName = Boolean(p.display_name?.trim() || p.first_name?.trim());

  return (
    <section data-testid="dancer-screen-me" className="grid gap-[12px]">
      <ScreenTitle>Me</ScreenTitle>

      {!p.is_active && (
        <Card variant="padded" role="status" testId="me-paused" className="border-[var(--danger)]">
          <p className="m-0 text-[15px] font-bold">Your profile is {HIDDEN_STATE_WORD}</p>
          <p className="mb-[8px] mt-[4px] text-[14px] text-[var(--mut)]">
            {HIDDEN_STATE_LINE} You can show it again in {ACCOUNT_SETTINGS_LABEL}.
          </p>
          <Link to={APP_ACCOUNT_SETTINGS_PATH} className={LINK_GHOST_SM}>
            Open account settings
          </Link>
        </Card>
      )}

      <Card variant="padded" testId="me-card" className="grid gap-[10px]">
        <div className="flex items-center gap-[12px]">
          <span className="da-ring-avatar"><Avatar profile={p} size={64} /></span>
          <div className="min-w-0">
            <p data-testid="me-name" className="m-0 break-words text-[20px] font-extrabold">
              {profileName(p)}
            </p>
            <p data-testid="me-role-city" className="mb-0 mt-[2px] text-[14px] text-[var(--mut)]">
              {roleCityLine(p)}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-[6px] flex justify-between text-[14px] font-semibold">
            <span>Profile strength</span>
            <span data-testid="me-strength-pct">{p.strength.pct}%</span>
          </div>
          <StrengthBar pct={p.strength.pct} />
          <p data-testid="me-next-step" className="mb-0 mt-[8px] text-[14px] text-[var(--mut)]">
            {nextStepCopy(p)}
          </p>
          {/* Audit M24 / Going P2: no "unlock at 70%" line. Saying I'm going needs a FINISHED
              profile (set_my_going_v1 refuses profile_incomplete), and the event page's going tile
              names what is missing and links to it; the next step above already leads there. */}
        </div>

        <Link to={action.href} className={LINK_PRIMARY} data-testid="me-main-action">
          {action.label}
        </Link>
      </Card>

      {BUYER_ONBOARDING_ENABLED && POSTPAY_TICKETS_TAB_ENABLED && <Suspense fallback={null}><AccountLinkPanel onLinked={() => undefined} /></Suspense>}

      <div>
        <SectionTitle as="p">My profile</SectionTitle>
        <Card>
          {!action.isEdit && <LinkRow to="/app/me/edit" label="Edit my profile" testId="me-edit" />}
          {/* Layout C: My page moved to Home "Be found" (slice S1). */}
          {!DANCER_LAYOUT_C_ENABLED && <LinkRow to="/app/page" label="My page: how it looks and who visited" testId="me-my-page" />}
          {p.is_active ? (
            <LinkRow href={`/dancers/${p.profile_id}`} label="See my public page" testId="me-public-page" />
          ) : (
            <DisabledRow label="See my public page" reason="Your profile is hidden, so there is no public page to see." testId="me-public-page" reasonTestId="me-public-page-reason" />
          )}
        </Card>
        {!hasName && (
          <p className="mb-0 mt-[8px] text-[13px] text-[var(--mut)]">
            People will not find your page by name until you add one.
          </p>
        )}
      </div>

      {DANCER_LAYOUT_C_ENABLED && <MeSettings otherRoles={p.other_roles} />}
    </section>
  );
};

export default MeScreen;
