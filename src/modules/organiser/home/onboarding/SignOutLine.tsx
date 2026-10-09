import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GhostButton, PrimaryButton, SheetView, useShake } from '../../ui';

/**
 * "Signed in as <email> . Not you? Sign out": the way out of the first-time
 * screen for someone who signed in with the wrong email. The confirm sheet is
 * the same flow as the Profile tab's (useAuth().signOut, then the start page).
 */
export function SignOutLine({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();

  const close = () => {
    setOpen(false);
    setNote(null);
  };
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
    <>
      <p className="flex flex-wrap items-center gap-x-[4px] text-[13px] text-[var(--mut)]" data-testid="onboarding-signedin-line">
        <span className="min-w-0 max-w-full break-all" data-testid="onboarding-signedin-as">
          {email ? <>Signed in as {email}.</> : <>Signed in.</>}
        </span>
        <span>Not you?</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={email ? `Sign out of ${email}` : 'Sign out'}
          className="inline-flex min-h-[44px] items-center px-[4px] text-[13px] font-semibold text-[var(--gold)] underline underline-offset-2"
          data-testid="onboarding-signout"
        >
          Sign out
        </button>
      </p>
      <SheetView open={open} onOpenChange={(o) => { if (!o) close(); }} title="Sign out" testId="onboarding-signout-sheet">
        <div className={`space-y-[12px] p-[16px] ${shakeProps.className}`} onAnimationEnd={shakeProps.onAnimationEnd}>
          <p className="break-words text-[15px] text-[var(--fg)]">
            {email ? `Sign out of ${email} on this device?` : 'Sign out of Bachata Calendar on this device?'}
          </p>
          {note && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="onboarding-signout-error">{note}</p>}
          <GhostButton onClick={close} disabled={busy} testId="onboarding-signout-no">No, stay signed in</GhostButton>
          <PrimaryButton onClick={() => void go()} loading={busy} loadingLabel="Signing out" testId="onboarding-signout-yes">Yes, sign out</PrimaryButton>
        </div>
      </SheetView>
    </>
  );
}
