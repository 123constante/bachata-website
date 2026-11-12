import { Suspense, useEffect, useId, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { ACCOUNT_SETTINGS_PATH, APP_ACCOUNT_SETTINGS_PATH, ORGANISER_HOME_PATH, switcherItems, type SwitcherWhere } from '@/lib/accountRouting';
import { ACCOUNT_SETTINGS_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { dancerMessageUsUrl } from '@/lib/contactLinks';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { PersonAvatar } from './PersonAvatar';
import { useProfileSides } from './useProfileSides';
import { SIGN_OUT_FAILED, useSignOutToHome } from './signOutToHome';

/** Re-exported for older importers; the one value lives in ./signOutToHome. */
export { SIGN_OUT_FAILED };

// The area entries load with the open sheet, never on the page's first load.
const SwitcherAreas = lazyWithRetry(() => import('@/modules/areas/home/SwitcherAreas'));

/** Add a profile (dancer app only): the two real ways on. Words match Options' own rows. */
export const ADD_PROFILE_LABEL = 'Add a profile';
export const ADD_ORGANISER_LABEL = 'Run events? Become an organiser';
export const ADD_OTHER_LABEL = 'DJ or teach? Message us';
export const ADD_OTHER_MESSAGE = 'Hi, I would like to add a DJ or teacher profile to my account.';
/** The tag on the profile the screen is showing (words, not only a tick). */
export const SHOWING_LABEL = 'Showing';
const SIDE_GROUP_LABEL = { dancer: 'Dancer', organiser: 'Organiser' } as const;
/** The strip button's word: Switch with 2+ profiles, Account with one (D129: nothing to switch to). */
export const stripLabel = (several: boolean): string => (several ? 'Switch' : 'Account');

/** The confirm step's words: the same promise Options makes before it signs out. */
export const SIGN_OUT_CONFIRM_LINE = 'You can sign back in any time with your email.';

/**
 * "Switch profile": the top-right picture in the dancer app AND the organiser
 * area -- ONE component, both areas (owner workflow 2026-10-15). The sheet
 * lists every side the person really has (lib/accountRouting switcherItems:
 * organisers first, a tick on the current one), then Account settings and Sign
 * out. One tap switches. A single-side person sees their one side, settings
 * and sign out: nothing to switch, no switching words. Below the sides: the
 * teacher / DJ areas the person holds and a "Your areas" link (SwitcherAreas).
 *
 * Sign out asks first (audit L23, like Options and Account settings) and goes
 * through useSignOutToHome, which lands on the site home (H10).
 *
 * Surface: inside the dancer app the sheet is the plum dancer surface (L10). It
 * is portalled to <body>, outside the shell's [data-profile="dancer"], so it
 * carries that attribute itself; the theme's root rule then also sets a page
 * background and min-height, which the inline style overrides. The organiser
 * area keeps the site tokens (bg-background / text-foreground).
 */
export function ProfileSwitcher({ where }: { where: SwitcherWhere }) {
  const { signOutToHome, busy } = useSignOutToHome();
  const { state } = useProfileSides();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const titleId = useId();
  const dancer = where.area === 'dancer';

  const close = () => {
    setOpen(false);
    setConfirming(false);
    setAdding(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const items = state.status === 'ready' ? switcherItems(state.sides, where) : [];
  const current = items.find((i) => i.current);
  const several = items.length > 1;

  const row = 'flex min-h-[56px] w-full items-center gap-[12px] px-[16px] text-left text-[15px]';
  const muted = dancer ? 'da-muted' : 'text-muted-foreground';
  const sheetSurface: CSSProperties | undefined = dancer
    ? { background: 'var(--da-surface)', color: 'var(--da-text)', minHeight: 'auto', borderTop: '1px solid var(--da-border)' }
    : undefined;
  return (
    <>
      <button
        type="button"
        aria-label={several ? 'Switch profile' : 'Your account'}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={several ? 'profile-switcher-button' : 'profile-account-button'}
        onClick={() => setOpen(true)}
        className={
          dancer
            ? 'flex h-[44px] shrink-0 items-center gap-[8px] rounded-full pl-[6px] pr-[12px] text-[14px] font-semibold'
            : 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full'
        }
        style={dancer ? { border: '1px solid var(--da-border)', background: 'var(--da-surface)', color: 'var(--da-text)' } : undefined}
      >
        {/* No side known yet: the same PersonAvatar glyph disc, not a second, bare picture of a person. */}
        {current ? <SideAvatar side={current} size={32} /> : <PersonAvatar photoUrl={null} name={null} size={32} />}
        {dancer && <span data-testid="profile-switcher-label">{stripLabel(several)}</span>}
      </button>
      {/* Portalled to <body>: a shell header is its own stacking context, and the dancer app's
          bottom tabs covered the sheet's last row (Sign out) at 390x844. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" data-testid="profile-switcher-backdrop" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="profile-switcher-sheet"
            data-profile={dancer ? 'dancer' : undefined}
            onClick={(e) => e.stopPropagation()}
            style={sheetSurface}
            className={`max-h-[calc(100dvh-16px)] w-full max-w-[480px] overflow-y-auto rounded-t-[16px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[8px] shadow-xl ${dancer ? '' : 'bg-background text-foreground'}`}
          >
            <div className="flex items-center justify-between px-[16px]">
              <h2 id={titleId} className="text-[16px] font-bold">
                {adding ? ADD_PROFILE_LABEL : several ? 'Switch profile' : 'Your account'}
              </h2>
              <button type="button" onClick={close} className="min-h-[44px] min-w-[44px] text-[15px] font-semibold" data-testid="profile-switcher-close">
                Close
              </button>
            </div>
            {state.status === 'loading' && (
              <p className={`px-[16px] py-[12px] text-[14px] ${muted}`} aria-busy="true">
                Loading your profiles&hellip;
              </p>
            )}
            {state.status === 'failed' && (
              <p className={`px-[16px] py-[12px] text-[14px] ${muted}`} data-testid="profile-switcher-failed">
                We could not load your profiles. Close this and try again in a moment.
              </p>
            )}
            {adding && (
              <div data-testid="profile-switcher-add-sheet">
                <Link to={ORGANISER_HOME_PATH} onClick={close} className={`${row} font-semibold`} data-testid="profile-switcher-add-organiser">
                  {ADD_ORGANISER_LABEL}
                </Link>
                <a
                  href={dancerMessageUsUrl(ADD_OTHER_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${row} font-semibold`}
                  data-testid="profile-switcher-add-other"
                >
                  {ADD_OTHER_LABEL}
                </a>
                <button type="button" onClick={() => setAdding(false)} className={`${row} font-semibold`} data-testid="profile-switcher-add-back">
                  Back
                </button>
              </div>
            )}
            {!adding && (
            <div className="border-b border-border" style={dancer ? { borderColor: 'var(--da-border)' } : undefined} data-testid="profile-switcher-sides">
              {/* Grouped Dancer / Organiser (the DJ and teacher areas follow below, from SwitcherAreas). */}
              {(['dancer', 'organiser'] as const).map((kind) => {
                const group = items.filter((i) => i.kind === kind);
                if (group.length === 0) return null;
                return (
                  <section key={kind} aria-label={SIDE_GROUP_LABEL[kind]} data-testid={`profile-switcher-group-${kind}`}>
                    <h3 className={`px-[16px] pt-[8px] text-[12px] font-bold uppercase tracking-wide ${muted}`}>{SIDE_GROUP_LABEL[kind]}</h3>
                    <ul>
                      {group.map((item) => (
                        <li key={item.key}>
                          <Link
                            to={item.to}
                            aria-current={item.current ? 'true' : undefined}
                            data-testid={`profile-switcher-side-${item.key}`}
                            onClick={close}
                            className={row}
                          >
                            <SideAvatar side={item} size={36} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{sideTitle(item)}</span>
                              <span className={`block text-[13px] ${muted}`}>{sideKind(item)}</span>
                            </span>
                            {item.current && (
                              <span className="flex shrink-0 items-center gap-[4px] text-[13px] font-bold" data-testid="profile-switcher-showing">
                                <Check aria-hidden="true" style={{ width: 18, height: 18 }} />
                                {SHOWING_LABEL}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
            )}
            {!adding && dancer && state.status === 'ready' && (
              <button type="button" onClick={() => setAdding(true)} className={`${row} border-b font-semibold`} style={{ borderColor: 'var(--da-border)' }} data-testid="profile-switcher-add">
                <Plus aria-hidden="true" style={{ width: 20, height: 20 }} />
                {ADD_PROFILE_LABEL}
              </button>
            )}
            {!adding && state.status === 'ready' && (
              <div className="border-b border-border" style={dancer ? { borderColor: 'var(--da-border)' } : undefined}>
                <Suspense fallback={null}><SwitcherAreas rowClass={row} mutedClass={muted} onPick={close} /></Suspense>
              </div>
            )}
            {!adding && (<>
            {/* Inside the dancer app, settings keeps "Back to Options" (review #789 S1). */}
            <Link to={where.area === 'dancer' ? APP_ACCOUNT_SETTINGS_PATH : ACCOUNT_SETTINGS_PATH} onClick={close} className={`${row} font-semibold`} data-testid="profile-switcher-settings">
              {ACCOUNT_SETTINGS_LABEL}
            </Link>
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className={`${row} font-semibold`} data-testid="profile-switcher-sign-out">
                Sign out
              </button>
            ) : (
              <div className="px-[16px] pb-[4px] pt-[4px]" data-testid="profile-switcher-signout-step">
                <p className="text-[15px] font-semibold">Sign out?</p>
                <p className={`mt-[2px] text-[14px] ${muted}`}>{SIGN_OUT_CONFIRM_LINE}</p>
                <div className="mt-[8px] grid grid-cols-2 gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                    className="min-h-[44px] rounded-[10px] border text-[15px] font-semibold"
                    style={dancer ? { borderColor: 'var(--da-border)' } : undefined}
                    data-testid="profile-switcher-signout-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutToHome()}
                    disabled={busy}
                    className={`min-h-[44px] rounded-[10px] text-[15px] font-bold ${dancer ? '' : 'bg-primary text-primary-foreground'}`}
                    style={dancer ? { background: 'var(--da-accent)', color: 'var(--da-on-accent)' } : undefined}
                    data-testid="profile-switcher-signout-confirm"
                  >
                    {busy ? <>Signing out&hellip;</> : 'Yes, sign out'}
                  </button>
                </div>
              </div>
            )}
            </>)}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ProfileSwitcher;
