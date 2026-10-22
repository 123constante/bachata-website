import { PrimaryButton, SheetView } from '@/modules/organiser/ui';

/** "Discard changes?" (D119 #2): Keep editing is the one primary; Discard leaves, as the prototype's red quiet text (N3). */
export function DiscardSheet({ open, onKeep, onDiscard }: { open: boolean; onKeep: () => void; onDiscard: () => void }) {
  return (
    <SheetView
      open={open}
      onOpenChange={(o) => { if (!o) onKeep(); }}
      title="Discard changes?"
      description="You have edits that are not saved."
      testId="discard-sheet"
      footer={
        <div className="space-y-[8px]">
          <PrimaryButton testId="discard-keep" onClick={onKeep}>Keep editing</PrimaryButton>
          <button
            type="button"
            data-testid="discard-leave"
            onClick={onDiscard}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-ctl)] text-[15px] font-semibold text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Discard
          </button>
        </div>
      }
    >
      <p className="text-[15px] text-[var(--mut)]">What you changed is not saved yet. If you leave now, it is lost.</p>
    </SheetView>
  );
}
