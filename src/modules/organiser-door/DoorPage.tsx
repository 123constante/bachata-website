// /run-events: the S5 public door. Door env off -> closed page; signed out -> email code; signed in -> start your page.
import { useCallback, useEffect, useRef, useState } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useAuth } from '@/hooks/useAuth';
import { classifySendError } from '@/modules/admin-organisers/join/joinModel';
import { fetchLookalikes, sendDoorCode, startOrganiser, verifyDoorCode } from './doorApi';
import {
  CLOSED_SCREEN, DOOR_ENV_VALUE, TURNSTILE_ENV_VALUE, doorIsOn, shouldAskLookalikes, startView, turnstileSiteKey,
  type LookalikeState, type StartView,
} from './doorModel';
import { PublicDoor, ResultScreen, StartYourPage } from './DoorScreens';

const LOOKALIKE_DEBOUNCE_MS = 600;
const SEND_FAILED = 'We could not send the code. Please try again in a moment.';
const WRONG_CODE = 'That code did not work. Check it against the latest email, or send a new code.';

export function DoorBody({ doorOn = doorIsOn(DOOR_ENV_VALUE), siteKey = turnstileSiteKey(TURNSTILE_ENV_VALUE), signedIn, resolving }: {
  doorOn?: boolean; siteKey?: string | null; signedIn: boolean; resolving: boolean;
}) {
  const [view, setView] = useState<StartView | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [lookalikes, setLookalikes] = useState<LookalikeState>({ kind: 'idle' });
  const draft = useRef({ name: '', city: '' });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = useCallback((name: string, city: string) => {
    draft.current = { name, city };
    clearTimeout(timer.current);
    const mine = ++seq.current;
    if (!shouldAskLookalikes(name, city)) { setLookalikes({ kind: 'idle' }); return; }
    timer.current = setTimeout(() => {
      void fetchLookalikes(name, city).then((s) => {
        if (mine !== seq.current) return;
        if (s.kind === 'some' || s.kind === 'none' || s.kind === 'rate_limited' || s.kind === 'error') setLookalikes(s);
      });
    }, LOOKALIKE_DEBOUNCE_MS);
  }, []);

  const submit = useCallback(async (name: string, city: string) => {
    if (inFlight.current) return; // double-tap sends once
    inFlight.current = true;
    setBusy(true);
    const outcome = await startOrganiser(name, city);
    inFlight.current = false;
    setBusy(false);
    setView(startView(outcome));
  }, []);

  if (!doorOn) return <ResultScreen screen={CLOSED_SCREEN} testId="door-closed" />;
  if (resolving) return <p className="text-sm" role="status" data-testid="door-loading">One moment&hellip;</p>;
  if (view?.kind === 'closed') return <ResultScreen screen={CLOSED_SCREEN} testId="door-closed" />;
  if (view?.kind === 'screen') {
    return <ResultScreen screen={view.screen} tone={view.tone} testId="door-result" onRetry={() => setView(null)} />;
  }
  if (!signedIn) {
    return (
      <PublicDoor
        turnstileKey={siteKey}
        onSend={async (email, token) => {
          const { error } = await sendDoorCode(email, token);
          if (!error) return null;
          const kind = classifySendError(error).kind;
          if (kind === 'rate_limited') return 'We sent you a code a moment ago. Wait a minute, then try again.';
          if (kind === 'blocked_domain') return 'Please use your own email address.';
          return SEND_FAILED;
        }}
        onVerify={async (email, code) => {
          const { error } = await verifyDoorCode(email, code);
          return error ? WRONG_CODE : null;
        }}
      />
    );
  }
  return (
    <StartYourPage
      lookalikes={lookalikes}
      busy={busy}
      inlineError={view?.kind === 'inline' ? view.message : null}
      onChange={onChange}
      onSubmit={(n, c) => void submit(n, c)}
    />
  );
}

export default function DoorPage() {
  const { user, authStatus } = useAuth();
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('organiser.door')}>
      <div className="mx-auto w-full max-w-md p-3">
        <DoorBody signedIn={Boolean(user)} resolving={authStatus === 'resolving'} />
      </div>
    </GlobalLayout>
  );
}
