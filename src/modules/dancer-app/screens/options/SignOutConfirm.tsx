import { useEffect, useState } from 'react';
import { GhostButton } from '@/modules/organiser/ui';
import { SIGN_OUT_FAILED, useSignOutToHome } from '@/components/account/profiles/signOutToHome';

/** The one sign-out failure line (owned by signOutToHome, shared with the profile switcher). */
export const SIGN_OUT_FAILED_COPY = SIGN_OUT_FAILED;

/**
 * The Options sign-out confirm. Loaded on demand (OptionsScreen lazy-loads it when the
 * sheet opens), so the shared sign-out-to-home module is not a first-load chunk of /app/*.
 *
 * Audit H10: leave for the site home FIRST, then sign out (useSignOutToHome). On 'ok' the
 * screen has already unmounted. On 'failed' the hook comes back to Options and toasts the
 * same line; if this sheet is still mounted it shows it too. `onBusyChange` lets the sheet
 * disable its Close while the hook waits, so the confirm is never unmounted half way.
 */
const SignOutConfirm = ({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) => {
  const { signOutToHome, busy } = useSignOutToHome();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  const doSignOut = async () => {
    setFailed(false);
    if ((await signOutToHome()) === 'failed') setFailed(true);
  };

  return (
    <>
      {failed && <p role="alert" className="mb-[8px] mt-0 text-[14px] text-[var(--danger)]">{SIGN_OUT_FAILED_COPY}</p>}
      <GhostButton onClick={() => void doSignOut()} disabled={busy} testId="opt-signout-confirm">
        {busy ? <>Signing out&hellip;</> : failed ? 'Retry' : 'Yes, sign out'}
      </GhostButton>
    </>
  );
};

export default SignOutConfirm;
