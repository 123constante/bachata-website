import { Suspense, useState } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { GhostButton, SummaryRow } from '@/modules/organiser/ui';
import { Sheet } from './optionsUi';

// On demand: the shared sign-out-to-home module is then not a first-load chunk of /app/*
// (perf-budgets chunk ratchet). Its failure line is SignOutConfirm's SIGN_OUT_FAILED_COPY.
const SignOutConfirm = lazyWithRetry(() => import('./SignOutConfirm'));

/**
 * The ONE Sign out control of the dancer app: the row, then the "Sign out?" sheet with the
 * shared confirm (leaves for the site home, then signs out and clears local data). Used by
 * the full Options screen and by the no-profile way out on Options and Home (walk bug 1).
 */
const SignOutControl = ({ testId = 'opt-sign-out' }: { testId?: string }) => {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <SummaryRow label="Sign out" onPress={() => setOpen(true)} testId={testId} />
      {open && (
        <Sheet title="Sign out?" testId="opt-signout-sheet" onClose={() => setOpen(false)} closeDisabled={signingOut}>
          <p className="mb-[8px] mt-0 text-[14px]">You can sign back in any time with your email.</p>
          <Suspense
            fallback={
              <GhostButton disabled testId="opt-signout-loading">
                Yes, sign out
              </GhostButton>
            }
          >
            <SignOutConfirm onBusyChange={setSigningOut} />
          </Suspense>
        </Sheet>
      )}
    </>
  );
};

export default SignOutControl;
