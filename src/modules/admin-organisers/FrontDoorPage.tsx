import { useState } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AddOrganiser } from './AddOrganiser';
import { FrontDoorList } from './FrontDoorList';
import { NeedsYou } from './NeedsYou';
import { useNeedsYouCount } from './useNeedsYouCount';
import { badgeText } from './needsYouModel';
import { BTN } from './frontDoorUi';

type Tab = 'add' | 'list' | 'needs';

function FrontDoorBody() {
  const [tab, setTab] = useState<Tab>('add');
  const badge = badgeText(useNeedsYouCount());
  const tabBtn = (t: Tab, label: string, extra?: string | null) => (
    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`fd-tab-${t}`}
      className={`min-h-[44px] flex-1 rounded-lg px-2 text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
      {label}{extra && <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground" data-testid="needs-badge">{extra}</span>}
    </button>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-24 pt-3" data-testid="front-door">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Add and manage organisers</h1>
        <a href="/admin/organisers" className={BTN} data-testid="fd-back">Access</a>
      </div>
      <div role="tablist" className="flex gap-1.5">
        {tabBtn('add', 'Add')}
        {tabBtn('list', 'Organisers')}
        {tabBtn('needs', 'Needs you', badge)}
      </div>
      {tab === 'add' && <AddOrganiser onOpenList={() => setTab('list')} />}
      {tab === 'list' && <FrontDoorList onAdd={() => setTab('add')} />}
      {tab === 'needs' && <NeedsYou onAdd={() => setTab('add')} />}
    </div>
  );
}

function Gate() {
  const admin = useIsAdmin();
  if (admin.isAdmin) return <GlobalLayout breadcrumbs={buildBreadcrumbs('admin.organisers')}><FrontDoorBody /></GlobalLayout>;
  return (
    <GlobalLayout>
      {admin.isPending ? (
        <div className="mx-auto max-w-2xl space-y-2 px-3 pt-3" data-testid="fd-checking"><Skeleton className="h-8 w-48" /><Skeleton className="h-11 w-full" /></div>
      ) : (
        <div className="mx-auto max-w-md px-4 pt-16 text-center" data-testid="fd-not-available">
          <h1 className="text-lg font-semibold">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is not available.</p>
          <a href="/" className="mt-4 inline-block text-sm underline">Go to Bachata Calendar</a>
        </div>
      )}
    </GlobalLayout>
  );
}

/** /admin/organisers/front-door. Admin only; anyone else gets a plain not-found. */
export default function FrontDoorPage() {
  useNoindexMeta(true);
  return <AuthGuard><Gate /></AuthGuard>;
}
