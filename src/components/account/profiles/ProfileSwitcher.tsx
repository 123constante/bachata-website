import { useEffect, useId, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { ACCOUNT_SETTINGS_PATH, switcherItems, type SwitcherWhere } from '@/lib/accountRouting';
import { ACCOUNT_SETTINGS_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { PersonAvatar } from './PersonAvatar';
import { useProfileSides } from './useProfileSides';
import { SIGN_OUT_FAILED, useSignOutToHome } from './signOutToHome';

/** Re-exported for older importers; the one value lives in ./signOutToHome. */
export { SIGN_OUT_FAILED };

/** The confirm step's words: the same promise Options makes before it signs out. */
export const SIGN_OUT_CONFIRM_LINE = 'You can sign back in any time with your email.';

/**
 * "Switch profile": the top-right picture in the dancer app AND the organiser
 * area -- ONE component, both areas (owner workflow 2026-10-15). The sheet
 * lists every side the person really has (lib/accountRouting switcherItems:
 * organisers first, a tick on the current one), then Account settings and Sign
 * out. One tap switches. A single-side person sees their one side, settings
 * and sign out: nothing to switch, no switching words.
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
  const titleId = useId();
  const dancer = where.area === 'dancer';

  const close = () => {
    setOpen(false);
    setConfirming(false);
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
        data-testid="profile-switcher-button"
        onClick={() => setOpen(true)}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full"
      >
        {/* No side known yet: the same PersonAvatar glyph disc, not a second, bare picture of a person. */}
        {current ? <SideAvatar side={current} size={32} /> : <PersonAvatar photoUrl={null} name={null} size={32} />}
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
            className={`w-full max-w-[480px] rounded-t-[16px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[8px] shadow-xl ${dancer ? '' : 'bg-background text-foreground'}`}
          >
            <div className="flex items-center justify-between px-[16px]">
              <h2 id={titleId} className="text-[16px] font-bold">
                {several ? 'Switch profile' : 'Your account'}
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
            <ul className="border-b border-border" style={dancer ? { borderColor: 'var(--da-border)' } : undefined} data-testid="profile-switcher-sides">
              {items.map((item) => (
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
                    {item.current && <Check aria-label="Current profile" className="shrink-0" style={{ width: 20, height: 20 }} />}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={ACCOUNT_SETTINGS_PATH} onClick={close} className={`${row} font-semibold`} data-testid="profile-switcher-settings">
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
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ProfileSwitcher;
