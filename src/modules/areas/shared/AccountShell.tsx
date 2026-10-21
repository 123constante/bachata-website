import type { ReactNode } from 'react';
import { EmberWorld } from '@/modules/organiser/ui';
import '@/modules/organiser/theme.css';
import { SiteHomeLink } from './SiteHomeLink';

/**
 * The Ember look for an account screen that keeps the site's header (GlobalLayout): the ground, the
 * "Bachata Calendar" home link (D120) and one phone-width column. Account screens have no unsaved-edit forms
 * that leave the page, so the home link needs no Discard sheet here (it still goes through the guard).
 */
export function AccountShell({ children, testId, narrow = true }: { children: ReactNode; testId?: string; narrow?: boolean }) {
  return (
    <EmberWorld data-testid={testId} className="org-theme min-h-[80dvh]">
      <div className={`mx-auto w-full ${narrow ? 'max-w-md' : 'max-w-[640px]'} px-[16px] pb-24 pt-[4px]`}>
        <SiteHomeLink className="-ml-[8px]" />
        <div className="space-y-3 pt-[4px]">{children}</div>
      </div>
    </EmberWorld>
  );
}
