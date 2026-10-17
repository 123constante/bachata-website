import { useState } from 'react';
import { SIGN_OUT_FAILED, useSignOutToHome } from '@/components/account/profiles/signOutToHome';
import { GhostButton, PrimaryButton, SheetView, useShake } from '../ui';

/**
 * Sign out, confirmed, through the shared useSignOutToHome: leave for the site
 * home first, then sign out (audit H10). On a failure the hook comes back here
 * and toasts; the sheet shows the same line if it is still open.
 */
export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOutToHome, busy } = useSignOutToHome();
  const [note, setNote] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();
  const go = async () => {
    setNote(null);
    if ((await signOutToHome()) === 'failed') {
      setNote(SIGN_OUT_FAILED);
      shake();
    }
  };
  return (
    <SheetView open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Sign out" testId="signout-sheet">
      <div className={`space-y-[12px] p-[16px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd}>
        <p className="text-[15px] text-[var(--fg)]">Sign out of Bachata Calendar on this device?</p>
        {note && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="signout-error">{note}</p>}
        <GhostButton onClick={onClose} disabled={busy} testId="signout-no">No, stay signed in</GhostButton>
        <PrimaryButton onClick={() => void go()} loading={busy} loadingLabel="Signing out" testId="signout-yes">Yes, sign out</PrimaryButton>
      </div>
    </SheetView>
  );
}
