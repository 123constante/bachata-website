import { selfServeErrorCode } from '@/modules/organiser/shared/selfServeErrors';

/** The page a P3 Team screen is about, when the person holds 2+ pages (one page: nothing added). */
export function PageNameCaption({ name, show }: { name: string | null | undefined; show: boolean }) {
  if (!show || !name) return null;
  return <p className="truncate text-sm text-[var(--mut)]" data-testid="p3-team-page-name">{name}</p>;
}

/** A failed join-requests read says so. A contributor's not_authorised is expected, so it stays silent. */
export function requestsErrorShown(q: { isError: boolean; error: unknown }): boolean {
  return q.isError && selfServeErrorCode(q.error) !== 'not_authorised';
}

export function RequestsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 text-sm text-[var(--mut)]" data-testid="p3-team-requests-error">
      <span className="min-w-0 flex-1">We couldn&rsquo;t load join requests.</span>
      <button type="button" onClick={onRetry} style={{ minHeight: 44, minWidth: 44 }} className="shrink-0 rounded-[12px] bg-[var(--card2)] px-3 text-sm font-semibold text-[var(--fg)]" data-testid="p3-team-requests-retry">Try again</button>
    </div>
  );
}
