import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { buildSignInHref } from '@/lib/authRouting';
import { dancerMessageUsUrl } from '@/lib/contactLinks';
import { cn } from '@/lib/utils';
import { fetchLinkCity, fetchLinkLookup, linkCityKey, linkLookupKey, recordLinkJoin } from './linkApi';
import { CONTACT_MESSAGE, isPlausibleCode, joinRefusal, landingView, type JoinState, type LandingAction, type LookupState, type Viewer } from './linkLandingModel';

// 44px tap targets in explicit px: the phone html font is about 13.5px, so rem sizes render small.
const BTN = 'inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] border px-3.5 py-2 text-[15px] font-semibold no-underline disabled:cursor-not-allowed disabled:opacity-60';
const BTN_PRIMARY = `${BTN} border-primary bg-primary text-primary-foreground`;
const BTN_PLAIN = `${BTN} border-border bg-secondary text-foreground`;

/**
 * /join/a/:code -- one permanent shared link per ambassador. Reads the link (anon-safe), and on the
 * Join tap ONLY records the join. Never on load, never twice per tap. The city is a fixed chip:
 * this page never shows a city picker (search_cities hides inactive cities).
 */
export default function AmbassadorLinkPage() {
  useNoindexMeta(true);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  const { code: rawCode = '' } = useParams<{ code: string }>();
  const code = rawCode.trim();
  const plausible = isPlausibleCode(code);
  const { user, isLoading } = useAuth();

  const lookup = useQuery({ queryKey: linkLookupKey(code), queryFn: () => fetchLinkLookup(code), enabled: plausible, retry: false, staleTime: 60_000 });
  const slug = lookup.data?.status === 'ok' ? lookup.data.citySlug : '';
  const city = useQuery({ queryKey: linkCityKey(slug), queryFn: () => fetchLinkCity(slug), enabled: !!slug, retry: false, staleTime: 5 * 60_000 });

  const [join, setJoin] = useState<JoinState>({ kind: 'idle' });
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: () => recordLinkJoin(code),
    onSuccess: (result) => setJoin({ kind: 'done', result }),
    onError: (err) => setJoin({ kind: 'refused', refusal: joinRefusal(err) }),
    onSettled: () => { inFlight.current = false; },
  });
  const onJoin = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setJoin({ kind: 'pending' });
    mutation.mutate();
  };

  const viewer: Viewer = isLoading ? 'resolving' : !user?.id ? 'signed-out' : user.is_anonymous ? 'anonymous' : 'signed-in';
  const lookupState: LookupState = !plausible ? { status: 'not_found' } : lookup.isPending ? 'loading' : lookup.isError ? 'error' : lookup.data;
  const view = landingView({
    viewer,
    lookup: lookupState,
    join,
    returnTo: `/join/a/${encodeURIComponent(code)}`,
    signInHref: (r, mode) => buildSignInHref(r, mode),
    contactHref: dancerMessageUsUrl(CONTACT_MESSAGE + (typeof window !== 'undefined' ? window.location.href : '')),
  });
  const chip = view.city ? (view.kind === 'joined' || view.kind === 'already_joined' ? view.city : city.data?.name ?? view.city) : null;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('ambassador.link')}>
      <main className="mx-auto flex w-full max-w-[420px] flex-col gap-3 p-3" data-testid="ambassador-link" data-state={view.kind} aria-busy={view.kind === 'loading'}>
        {chip && (
          <span className="self-start rounded-full border border-border bg-secondary px-3 py-1 text-[13px] font-semibold" data-testid="link-city-chip">
            {chip}
          </span>
        )}
        <h1 className="m-0 text-[20px] font-semibold leading-tight" data-testid="link-heading">{view.heading}</h1>
        {view.body && <p className="m-0 text-[14px] text-muted-foreground" data-testid="link-body">{view.body}</p>}
        {view.notice && <p role="status" className="m-0 rounded-[10px] border border-border p-3 text-[14px]" data-testid="link-notice">{view.notice}</p>}
        {view.actions.length > 0 && (
          <div className="flex flex-col gap-2">
            {view.actions.map((a, i) => <ActionButton key={`${a.kind}-${i}`} action={a} onJoin={onJoin} onRetry={() => lookup.refetch()} />)}
          </div>
        )}
      </main>
    </GlobalLayout>
  );
}

function ActionButton({ action, onJoin, onRetry }: { action: LandingAction; onJoin: () => void; onRetry: () => void }) {
  const cls = action.primary ? BTN_PRIMARY : BTN_PLAIN;
  if (action.kind === 'link') {
    return action.external
      ? <a href={action.href} target="_blank" rel="noopener noreferrer" className={cls}>{action.label}</a>
      : <Link to={action.href} className={cls}>{action.label}</Link>;
  }
  if (action.kind === 'retry') return <button type="button" className={cls} onClick={onRetry}>{action.label}</button>;
  return (
    <>
      <button type="button" className={cls} onClick={onJoin} disabled={action.disabled} aria-describedby={action.reason ? 'link-join-reason' : undefined} data-testid="link-join">
        {action.label}
      </button>
      {action.reason && <p id="link-join-reason" className="m-0 text-center text-[13px] text-muted-foreground" data-testid="link-join-reason">{action.reason}</p>}
    </>
  );
}

