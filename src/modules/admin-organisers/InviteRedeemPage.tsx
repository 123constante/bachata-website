import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { DancerProfileGate } from '@/components/account/DancerProfileGate';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildSignInHref } from '@/lib/authRouting';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { redeemOrganiserInvite } from './adminApi';
import { INVITE_PATH, REDEEM_COPY, TOKEN_RE, interpretRedeem, type RedeemCopy } from './inviteModel';

/**
 * One in-flight redeem per token for the whole page lifetime. StrictMode mounts
 * effects twice and a refresh remounts the page; the RPC must run once (a second
 * call would answer already_member or used and hide the real outcome). Keyed by
 * token, holds only the promise, and is cleared when the attempt settles.
 */
const inFlight = new Map<string, Promise<ReturnType<typeof interpretRedeem>>>();

const BTN = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground';
const LINK = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium';

/** The token leaves the address bar (and so history, the share sheet and Referer) once the link is finished with. */
const stripToken = () => {
  try {
    window.history.replaceState(window.history.state, '', INVITE_PATH);
  } catch {
    /* a sandboxed frame may refuse; the page works either way */
  }
};

function Card({ copy, children }: { copy: RedeemCopy; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 pt-10 text-center" data-testid="invite-card" role="status">
      <h1 className="text-lg font-semibold" data-testid="invite-title">{copy.title}</h1>
      <p className="text-sm text-muted-foreground" data-testid="invite-body">{copy.body}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Joining an organiser team is organiser onboarding, so a signed-in person with
 * an unfinished dancer profile finishes it first (DancerProfileGate; the token
 * rides in returnTo and the link is used on the way back). Signed out passes
 * through to the page's own sign-in card.
 */
export default function InviteRedeemPage() {
  useNoindexMeta(true);
  return (
    <DancerProfileGate fallback={<GlobalLayout><div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div></GlobalLayout>}>
      <InviteRedeem />
    </DancerProfileGate>
  );
}

function InviteRedeem() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authStatus } = useAuth();
  const [copy, setCopy] = useState<RedeemCopy | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef(token);
  if (token) tokenRef.current = token;

  // Never leak the token in a Referer header to anything this page links or loads.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const run = useCallback(async () => {
    const t = tokenRef.current;
    if (!TOKEN_RE.test(t)) {
      setCopy(REDEEM_COPY.invalid);
      stripToken();
      return;
    }
    setBusy(true);
    let attempt = inFlight.get(t);
    if (!attempt) {
      attempt = redeemOrganiserInvite(t)
        .then(({ data, error }) => interpretRedeem(data, error))
        .catch(() => interpretRedeem(null, { message: 'network' }))
        .finally(() => { inFlight.delete(t); });
      inFlight.set(t, attempt);
    }
    const outcome = await attempt;
    setBusy(false);
    if (outcome.kind === 'redeemed') {
      stripToken();
      // The person may have opened Home in the last minute and cached "no organisers": refetch it before they land.
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      navigate(ORG_PATHS.home, { replace: true });
      return;
    }
    if (outcome.copy.terminal) stripToken();
    setCopy(outcome.copy);
  }, [navigate, queryClient]);

  const started = useRef(false);
  useEffect(() => {
    if (authStatus !== 'ready' || !user || started.current) return;
    started.current = true;
    void run();
  }, [authStatus, user, run]);

  let body: React.ReactNode;
  if (authStatus === 'resolving') {
    body = <div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div>;
  } else if (!user && TOKEN_RE.test(token)) {
    const here = `${INVITE_PATH}/${token}`;
    body = (
      <Card copy={{ title: 'Join your organiser team', body: 'Someone has invited you to manage an organiser on Bachata Calendar. Sign in with your own email, then you will come straight back here and the link is used.', action: 'sign_in', terminal: false }}>
        <Link to={buildSignInHref(here)} className={BTN} data-testid="invite-sign-in">Sign in</Link>
      </Card>
    );
  } else if (copy || !user) {
    body = (
      <Card copy={copy ?? REDEEM_COPY.invalid}>
        {copy?.action === 'sign_in' && <Link to={buildSignInHref(TOKEN_RE.test(token) ? `${INVITE_PATH}/${token}` : null)} className={BTN} data-testid="invite-sign-in">Sign in</Link>}
        {copy?.action === 'retry' && <button type="button" className={BTN} disabled={busy} onClick={() => void run()} data-testid="invite-retry">Try again</button>}
        {copy?.action !== 'retry' && <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>}
      </Card>
    );
  } else {
    body = <div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-working" role="status" aria-live="polite"><p className="text-sm text-muted-foreground">Using your link&hellip;</p><Skeleton className="h-16 w-full" /></div>;
  }
  return <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>{body}</GlobalLayout>;
}
