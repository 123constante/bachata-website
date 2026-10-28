import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useAuth } from '@/hooks/useAuth';
import { buildSignInHref } from '@/lib/authRouting';
import {
  approveEntity,
  fetchCityScopes,
  fetchQueuePage,
  queueKey,
  rejectEntity,
  scopesKey,
  type QueuePage,
} from './ambassadorApi';
import {
  decisionError,
  decisionToast,
  itemKey,
  loadErrorKind,
  moreText,
  reviewPath,
  sortOldestFirst,
  type DecisionError,
  type QueueItem,
  type TargetType,
} from './ambassadorModel';
import { ApproveSheet, RejectSheet } from './DecisionSheets';
import { CaughtUpState, ErrorState, LoadingState, NoAccessState, QueueList, ReviewView, SignedOutState } from './QueueViews';

type Sheet = { kind: 'approve' | 'reject'; key: string } | null;

/** The route is `/ambassador` (the list) or `/ambassador/review/:targetType/:targetId`. */
export function parseReviewPath(pathname: string): { targetType: TargetType; targetId: string } | null {
  const m = pathname.match(/^\/ambassador\/review\/(organiser|series)\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    return { targetType: m[1] as TargetType, targetId: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

function Queue() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [now] = useState(() => new Date());
  const [party, setParty] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState<DecisionError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef(0);
  const review = parseReviewPath(location.pathname);

  const scopes = useQuery({ queryKey: scopesKey(userId), enabled: !!userId, queryFn: () => fetchCityScopes(userId) });
  const cityIds = useMemo(() => (scopes.data ?? []).map((s) => s.id), [scopes.data]);
  const key = queueKey(cityIds);
  // Paged by hand, not with useInfiniteQuery: this page is its only user, and it would pull the
  // infinite observer into the shared vendor-query chunk that /app/* loads first (+0.3 KB gz).
  // Same cache shape, and a refetch reloads every page already shown, as useInfiniteQuery does.
  const queue = useQuery({
    queryKey: key,
    enabled: cityIds.length > 0,
    queryFn: async (): Promise<InfiniteData<QueuePage, number>> => {
      const shown = qc.getQueryData<InfiniteData<QueuePage, number>>(key)?.pages.length || 1;
      const pages: QueuePage[] = [];
      let offset: number | undefined = 0;
      while (offset !== undefined && pages.length < shown) {
        const page = await fetchQueuePage(cityIds, offset);
        pages.push(page);
        offset = page.full ? page.offset + 100 : undefined;
      }
      return { pages, pageParams: pages.map((p) => p.offset) };
    },
  });
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle');
  const fetchNextPage = async () => {
    const last = queue.data?.pages[queue.data.pages.length - 1];
    if (!last?.full || more === 'loading') return;
    setMore('loading');
    try {
      const offset = last.offset + 100;
      // A query of its own so the next page gets the app's retry default, like the rest of the list.
      const page = await qc.fetchQuery({
        queryKey: [...key, 'page', offset],
        queryFn: () => fetchQueuePage(cityIds, offset),
        retry: qc.getDefaultOptions().queries?.retry,
        staleTime: 0,
      });
      qc.setQueryData<InfiniteData<QueuePage, number>>(key, (old) =>
        old && { pages: [...old.pages, page], pageParams: [...old.pageParams, offset] },
      );
      setMore('idle');
    } catch {
      setMore('error');
    }
  };

  const items = useMemo(() => sortOldestFirst((queue.data?.pages ?? []).flatMap((p) => p.items)), [queue.data]);
  const current = review ? items.find((i) => i.key === itemKey(review.targetType, review.targetId)) ?? null : null;
  const sheetItem = sheet ? items.find((i) => i.key === sheet.key) ?? null : null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Back from a review lands on the list where it was left.
  const reviewing = review !== null;
  const wasReviewing = useRef(false);
  useLayoutEffect(() => {
    const wasBack = wasReviewing.current && !reviewing;
    if (reviewing && !wasReviewing.current) window.scrollTo(0, 0);
    wasReviewing.current = reviewing;
    if (reviewing) return;
    if (!wasBack) return;
    window.scrollTo(0, scrollRef.current);
    // A second pass after the browser and the layout have settled: one restore alone landed short.
    const raf = requestAnimationFrame(() => window.scrollTo(0, scrollRef.current));
    return () => cancelAnimationFrame(raf);
  }, [reviewing]);

  const openReview = (item: QueueItem) => {
    scrollRef.current = window.scrollY;
    navigate(reviewPath(item), { state: { fromList: true } });
  };
  const backToList = useCallback(() => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate('/ambassador', { replace: true });
  }, [location.state, navigate]);

  const closeSheet = () => {
    setSheet(null);
    setSheetError(null);
  };

  const takeOff = (item: QueueItem) => {
    qc.setQueryData<InfiniteData<QueuePage, number>>(key, (old) =>
      old && { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.key !== item.key) })) },
    );
    closeSheet();
    if (review) backToList();
  };

  const decide = useMutation({
    mutationFn: async (v: { item: QueueItem; reason?: string }) => {
      if (v.reason === undefined) await approveEntity(v.item.targetType, v.item.targetId);
      else await rejectEntity(v.item.targetType, v.item.targetId, v.reason);
    },
    onSuccess: (_d, v) => {
      takeOff(v.item);
      setToast(decisionToast(v.reason === undefined ? 'Approved' : 'Rejected', v.item.name, items.length - 1));
    },
    onError: (err, v) => {
      const e = decisionError(err);
      if (e.kind === 'party') {
        setParty((p) => new Set(p).add(v.item.key));
        closeSheet();
        return;
      }
      if (e.kind === 'gone') {
        // Nothing left to decide: off the list, the same as a decision that went through.
        takeOff(v.item);
        setToast(e.message);
        return;
      }
      setSheetError(e);
    },
  });

  const cityNames = (scopes.data ?? []).map((s) => s.name).join(' and ');
  const signInHref = buildSignInHref(`${location.pathname}${location.search}`);
  const lastPage = queue.data?.pages[queue.data.pages.length - 1];
  const fullCityNames = (scopes.data ?? []).filter((s) => lastPage?.fullCityIds.includes(s.id)).map((s) => s.name);
  const failed = (err: unknown, retry: () => void) => {
    const kind = loadErrorKind(err);
    if (kind === 'access') return <NoAccessState />;
    if (kind === 'auth') return <SignedOutState signInHref={signInHref} />;
    return <ErrorState onRetry={retry} />;
  };

  let body: React.ReactNode;
  if (scopes.isPending) body = <LoadingState />;
  else if (scopes.isError) body = failed(scopes.error, () => void scopes.refetch());
  else if (cityIds.length === 0) body = <NoAccessState />;
  else if (queue.isPending) body = <LoadingState />;
  else if (queue.isError && items.length === 0) body = failed(queue.error, () => void queue.refetch());
  else if (items.length === 0 && !review) body = <CaughtUpState cityNames={cityNames} />;
  else {
    body = (
      <>
        <div hidden={reviewing}>
          <QueueList
            items={items}
            party={party}
            now={now}
            showCity={cityIds.length > 1}
            more={lastPage?.full ? { text: moreText(lastPage.offset, fullCityNames), loading: more === 'loading', error: more === 'error', onMore: () => void fetchNextPage() } : null}
            onOpen={openReview}
          />
        </div>
        {review && current && (
          <ReviewView
            item={current}
            party={party.has(current.key)}
            now={now}
            onBack={backToList}
            onApprove={() => setSheet({ kind: 'approve', key: current.key })}
            onReject={() => setSheet({ kind: 'reject', key: current.key })}
          />
        )}
        {review && !current && (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center" data-testid="review-gone">
            <h2 className="m-0 text-[17px] font-semibold">No longer waiting</h2>
            <p className="m-0 max-w-[300px] text-[14px] text-muted-foreground">
              This one is not in your queue any more. It may have been decided already. Go back to the list to see what is left.
            </p>
            <button type="button" className="min-h-[44px] rounded-[10px] border border-border bg-secondary px-3.5 py-2 text-[14px] font-semibold" onClick={backToList}>Back to the list</button>
          </div>
        )}
      </>
    );
  }

  const showCount = !reviewing && items.length > 0;
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[430px] flex-col" data-testid="ambassador-queue">
      <header className="flex items-center gap-2 border-b border-border px-3 pt-3 pb-2">
        <h1 className="m-0 flex-1 text-[17px] font-semibold leading-tight">
          Pending review
          {cityNames && <small className="block text-[12px] font-normal text-muted-foreground">{cityNames}</small>}
        </h1>
        {showCount && (
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-primary px-2 text-[14px] font-bold text-primary-foreground" aria-label={`${items.length} waiting`} data-testid="queue-count">
            {items.length}
          </span>
        )}
      </header>
      {body}
      {sheet && sheetItem && sheet.kind === 'approve' && (
        <ApproveSheet item={sheetItem} busy={decide.isPending} error={sheetError} signInHref={signInHref} onCancel={closeSheet} onConfirm={() => decide.mutate({ item: sheetItem })} />
      )}
      {sheet && sheetItem && sheet.kind === 'reject' && (
        <RejectSheet item={sheetItem} busy={decide.isPending} error={sheetError} signInHref={signInHref} onCancel={closeSheet} onSubmit={(reason) => decide.mutate({ item: sheetItem, reason })} />
      )}
      {/* Portalled to <body>, as the sheets are: `filter` on .route-shell would pin a `fixed` toast to the shell, below the fold. */}
      {toast &&
        createPortal(
          <div role="status" className="fixed bottom-24 left-1/2 z-[70] w-max max-w-[calc(100%-24px)] -translate-x-1/2 rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-[13px] text-foreground shadow-lg" data-testid="toast">
            {toast}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** /ambassador and /ambassador/review/:targetType/:targetId. Signed out: sign in and return. Not linked from anywhere yet. */
export default function AmbassadorQueuePage() {
  useNoindexMeta(true);
  const location = useLocation();
  const inReview = parseReviewPath(location.pathname) !== null;
  return (
    <AuthGuard>
      <GlobalLayout breadcrumbs={buildBreadcrumbs(inReview ? 'ambassador.review' : 'ambassador')}>
        <Queue />
      </GlobalLayout>
    </AuthGuard>
  );
}
