import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Check, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ACCOUNT_SETTINGS_PATH, switcherItems, type SwitcherWhere } from '@/lib/accountRouting';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { useProfileSides } from './useProfileSides';

/** Shown when sign-out does not complete (the same words the dancer home and the dancer app's Options use). */
export const SIGN_OUT_FAILED = 'Sign-out did not complete. Check your connection and try again.';

/**
 * "Switch profile": the top-right picture in the dancer app AND the organiser
 * area -- ONE component, both areas (owner workflow 2026-10-15). The sheet
 * lists every side the person really has (lib/accountRouting switcherItems:
 * organisers first, a tick on the current one), then Account settings and Sign
 * out. One tap switches. A single-side person sees their one side, settings
 * and sign out: nothing to switch, no switching words.
 *
 * Colours are the site's own tokens (bg-background / text-foreground), which
 * hold under both the dancer theme and .org-theme.
 */
export function ProfileSwitcher({ where }: { where: SwitcherWhere }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useProfileSides();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const items = state.status === 'ready' ? switcherItems(state.sides, where) : [];
  const current = items.find((i) => i.current);
  const several = items.length > 1;

  const onSignOut = async () => {
    setBusy(true);
    setSignOutFailed(false);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === 'failed') {
      setSignOutFailed(true);
      return;
    }
    setOpen(false);
    navigate('/', { replace: true });
  };

  const row = 'flex min-h-[56px] w-full items-center gap-[12px] px-[16px] text-left text-[15px]';
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
        {current ? <SideAvatar side={current} size={32} /> : <UserRound aria-hidden="true" style={{ width: 20, height: 20 }} />}
      </button>
      {/* Portalled to <body>: a shell header is its own stacking context, and the dancer app's
          bottom tabs covered the sheet's last row (Sign out) at 390x844. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" data-testid="profile-switcher-backdrop" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="profile-switcher-sheet"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-t-[16px] bg-background pb-[calc(12px+env(safe-area-inset-bottom))] pt-[8px] text-foreground shadow-xl"
          >
            <div className="flex items-center justify-between px-[16px]">
              <h2 id={titleId} className="text-[16px] font-bold">
                {several ? 'Switch profile' : 'Your account'}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] min-w-[44px] text-[15px] font-semibold" data-testid="profile-switcher-close">
                Close
              </button>
            </div>
            {state.status === 'loading' && (
              <p className="px-[16px] py-[12px] text-[14px] text-muted-foreground" aria-busy="true">
                Loading your profiles&hellip;
              </p>
            )}
            {state.status === 'failed' && (
              <p className="px-[16px] py-[12px] text-[14px] text-muted-foreground" data-testid="profile-switcher-failed">
                We could not load your profiles. Close this and try again in a moment.
              </p>
            )}
            <ul className="border-b border-border" data-testid="profile-switcher-sides">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    aria-current={item.current ? 'true' : undefined}
                    data-testid={`profile-switcher-side-${item.key}`}
                    onClick={() => setOpen(false)}
                    className={row}
                  >
                    <SideAvatar side={item} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{sideTitle(item)}</span>
                      <span className="block text-[13px] text-muted-foreground">{sideKind(item)}</span>
                    </span>
                    {item.current && <Check aria-label="Current profile" className="shrink-0" style={{ width: 20, height: 20 }} />}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={ACCOUNT_SETTINGS_PATH} onClick={() => setOpen(false)} className={`${row} font-semibold`} data-testid="profile-switcher-settings">
              Account settings
            </Link>
            <button type="button" onClick={() => void onSignOut()} disabled={busy} className={`${row} font-semibold`} data-testid="profile-switcher-sign-out">
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
            {signOutFailed && (
              <p role="alert" className="px-[16px] text-[14px] text-destructive">
                {SIGN_OUT_FAILED}
              </p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ProfileSwitcher;
