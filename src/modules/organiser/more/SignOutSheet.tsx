import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GhostButton, PrimaryButton, SheetView, useShake } from '../ui';

/**
 * Sign out, confirmed. TODO(orchestrator): switch `go` to the shared
 * `useSignOutToHome` once website #789 is merged; the hook does not exist on
 * this base, so the existing signOut() + navigate('/') call is kept as it was.
 */
export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();
  const go = async () => {
    setBusy(true);
    setNote(null);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === 'failed') {
      setNote('Sign-out did not complete. Check your connection and try again.');
      shake();
      return;
    }
    navigate('/', { replace: true });
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
