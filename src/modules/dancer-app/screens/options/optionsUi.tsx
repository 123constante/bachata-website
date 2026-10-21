import type { ReactNode } from 'react';
import { GhostButton, SheetView } from '@/modules/organiser/ui';

/**
 * A dancer-app bottom sheet on the rebuild's SheetView (focus trap, Escape, slide-up). `closeDisabled` holds the sheet
 * open while a send or sign-out is in flight, so the confirm is never unmounted half way. The body keeps its own
 * "Close" button (the header X is named "Dismiss" so the two are not confused).
 */
export const Sheet = ({ title, testId, onClose, closeDisabled = false, children }: { title: string; testId: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }) => (
  <SheetView open onOpenChange={(o) => { if (!o && !closeDisabled) onClose(); }} title={title} testId={testId} closeLabel="Dismiss">
    {children}
    <GhostButton className="mt-[12px]" onClick={onClose} disabled={closeDisabled}>
      Close
    </GhostButton>
  </SheetView>
);
