import { useCallback, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { EmberWorld } from '@/modules/organiser/ui';
import '@/modules/organiser/theme.css';
import { DiscardSheet } from './DiscardSheet';
import { GuardedLink } from './GuardedLink';
import { useRegisterLeaveAsk } from './leaveGuard';
import { SiteHomeLink } from './SiteHomeLink';
import { PAGE_TITLE } from './typeScale';
import { useAreaLeaveBlocker } from './useAreaLeaveBlocker';

export interface AreaFrameProps {
  title: ReactNode;
  back?: { to: string; label: string };
  children: ReactNode;
  testId?: string;
}

/** Person-area page frame: the Ember look, the site home link, a back link and one phone-width column. */
export function AreaFrame({ title, back, children, testId }: AreaFrameProps) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const ask = useCallback((go: () => void) => setPending(() => go), []);
  useRegisterLeaveAsk(ask);
  // Back/Forward, header links, switcher rows: the router blocker asks with the same sheet (B4).
  const blocker = useAreaLeaveBlocker();
  const blocked = blocker.state === 'blocked';
  return (
    <EmberWorld data-testid={testId} className="org-theme min-h-[100dvh]">
      <header className="border-b border-[var(--line)] bg-[var(--bg)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-[640px] px-[8px] pb-[12px]">
          <SiteHomeLink />
          {back && (
            <GuardedLink to={back.to} data-testid="area-back" className="flex h-[44px] w-fit min-w-[44px] items-center gap-[2px] rounded-[12px] px-[8px] text-[15px] font-semibold text-[var(--gold-fg)]">
              <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" />
              {back.label}
            </GuardedLink>
          )}
          <h1 className={`px-[8px] ${PAGE_TITLE}`}>{title}</h1>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[640px] space-y-[16px] px-[16px] py-[16px]" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      <DiscardSheet
        open={pending !== null || blocked}
        onKeep={() => {
          setPending(null);
          if (blocked) blocker.reset?.();
        }}
        onDiscard={() => {
          if (blocked) {
            blocker.proceed?.();
            return;
          }
          const go = pending;
          setPending(null);
          go?.();
        }}
      />
    </EmberWorld>
  );
}
