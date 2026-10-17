import { Suspense, useState } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { ROW, Sheet } from './optionsUi';

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
      <button type="button" style={ROW} onClick={() => setOpen(true)} data-testid={testId}>Sign out</button>
      {open && (
        <Sheet title="Sign out?" testId="opt-signout-sheet" onClose={() => setOpen(false)} closeDisabled={signingOut}>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>You can sign back in any time with your email.</p>
          <Suspense
            fallback={
              <button type="button" className="da-tap" style={{ ...ROW, justifyContent: 'center' }} disabled data-testid="opt-signout-loading">
                Yes, sign out
              </button>
            }
          >
            <SignOutConfirm buttonStyle={{ ...ROW, justifyContent: 'center' }} onBusyChange={setSigningOut} />
          </Suspense>
        </Sheet>
      )}
    </>
  );
};

export default SignOutControl;
