import type { ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The page-level states the four /account screens share, so each says the
 * same thing in the same place. A read that cannot start because the phone is
 * offline is PAUSED by React Query, not loading and not failed: it has no data,
 * and a page that took "no data" for "no organisers" told an offline organiser
 * to set one up. These states keep that case apart from an empty account.
 *
 * `titleAs="h1"` on a page that has no heading of its own until it loads, so a
 * screen reader still finds a page title in every state.
 */

type TitleTag = 'h1' | 'p';

export function PageLoading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2" role="status" data-testid="page-loading">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function PageOffline({ titleAs: Title = 'p' }: { titleAs?: TitleTag }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-1" role="status" data-testid="page-offline">
      <Title className="text-sm font-semibold flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" /> You&rsquo;re offline
      </Title>
      <p className="text-xs text-muted-foreground">This page will load by itself when your connection is back.</p>
    </div>
  );
}

export function PageLoadError({ title, onRetry, titleAs: Title = 'p' }: { title: string; onRetry: () => void; titleAs?: TitleTag }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2" role="alert" data-testid="page-load-error">
      <Title className="text-sm font-semibold">{title}</Title>
      <p className="text-xs text-muted-foreground">Check your connection, then try again.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}
